import type { GitHubContentItem, RepoAccessResult } from '@/types/github'
import type { FileTreeNode } from '@/types/app'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com'
const MAX_DISCOVERY_DEPTH = 10

/**
 * Custom error class for authentication-related failures when accessing private repos.
 * Thrown when the auth backend returns 401 (session expired).
 */
export class SessionExpiredError extends Error {
  constructor(message: string = 'Session expired. Please re-authenticate.') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/**
 * Custom error class for GitHub App installation access errors.
 * Thrown when the auth backend returns 403 because the repo is not
 * in the GitHub App installation allowlist.
 */
export class InstallationAccessError extends Error {
  constructor(
    message: string = 'Repository not accessible. Add this repository to your GitHub App installation settings.',
  ) {
    super(message)
    this.name = 'InstallationAccessError'
  }
}

/**
 * Get the auth backend URL from the VITE_AUTH_BACKEND_URL environment variable.
 * Returns the URL with trailing slashes removed, or null if not configured.
 */
function getAuthBackendUrl(): string | null {
  const url = import.meta.env.VITE_AUTH_BACKEND_URL
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim().replace(/\/+$/, '')
  }
  return null
}

/**
 * Check if a filename has a markdown extension (case-insensitive).
 * Exported separately for testability.
 */
export function isMarkdownFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.md')
}

/**
 * Filter an array of GitHubContentItem to only include markdown files.
 * Uses case-insensitive `.md` extension matching.
 */
export function filterMarkdownFiles(items: GitHubContentItem[]): GitHubContentItem[] {
  return items.filter((item) => item.type === 'file' && isMarkdownFile(item.name))
}

/**
 * Determine if a GitHub API error response indicates rate limiting.
 * Checks for 403 status with rate-limit headers showing zero remaining requests.
 */
function isRateLimited(response: Response): boolean {
  if (response.status !== 403) return false
  const remaining = response.headers.get('x-ratelimit-remaining')
  return remaining === '0'
}

/**
 * Fetch the public contents of a directory in a GitHub repository.
 *
 * Makes an unauthenticated GET request to:
 *   /repos/{owner}/{repo}/contents/{path}?ref={branch}
 *
 * @throws Error with descriptive message for API failures
 */
export async function fetchPublicContents(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  fetchFn: typeof fetch = fetch,
): Promise<GitHubContentItem[]> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`

  let response: Response
  try {
    response = await fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    })
  } catch (error) {
    throw new Error(
      `Network error while fetching contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Folder not found. Check the repository URL and path.')
    }
    if (isRateLimited(response)) {
      const resetHeader = response.headers.get('x-ratelimit-reset')
      const resetTime = resetHeader ? new Date(Number(resetHeader) * 1000).toLocaleTimeString() : 'soon'
      throw new Error(
        `GitHub API rate limit reached. Resets at ${resetTime}. Authenticate for higher limits.`,
      )
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  const data: unknown = await response.json()

  // The contents API returns an array for directories
  if (!Array.isArray(data)) {
    throw new Error('Expected a directory listing but received a file response.')
  }

  return data.map((item: Record<string, unknown>) => ({
    name: item.name as string,
    path: item.path as string,
    type: item.type as 'file' | 'dir',
    size: item.size as number | undefined,
    download_url: (item.download_url as string | null) ?? null,
  }))
}

/**
 * Check if a repository is publicly accessible.
 *
 * Makes an unauthenticated HEAD/GET request to the repo endpoint.
 * - 200: public repo
 * - 404: either private or truly not found (indistinguishable without auth)
 * - 403 with rate limit: rate limited
 * - Network error: network_error
 */
export async function checkRepoAccess(
  owner: string,
  repo: string,
  fetchFn: typeof fetch = fetch,
): Promise<RepoAccessResult> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`

  let response: Response
  try {
    response = await fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    })
  } catch (error) {
    return {
      accessible: false,
      reason: 'network_error',
      message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  if (response.ok) {
    return { accessible: true, isPrivate: false }
  }

  if (response.status === 404) {
    return {
      accessible: false,
      reason: 'not_found',
      message: 'Repository not found or is private.',
    }
  }

  if (isRateLimited(response)) {
    return {
      accessible: false,
      reason: 'rate_limited',
      message: 'GitHub API rate limit reached. Please try again later or authenticate.',
    }
  }

  return {
    accessible: false,
    reason: 'network_error',
    message: `Unexpected response: ${response.status} ${response.statusText}`,
  }
}

/**
 * Fetch the raw content of a file from a public GitHub repository.
 *
 * Uses raw.githubusercontent.com for direct content access, or the
 * download_url if available from a prior contents API call.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const url = `${GITHUB_RAW_BASE}/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`

  let response: Response
  try {
    response = await fetchFn(url)
  } catch (error) {
    throw new Error(
      `Network error while fetching file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('File not found.')
    }
    throw new Error(`Failed to fetch file content: ${response.status} ${response.statusText}`)
  }

  return response.text()
}


/**
 * Fetch the contents of a directory from a private GitHub repository
 * via the auth backend proxy.
 *
 * Routes requests through: /api/proxy/contents/{owner}/{repo}/{path}?ref={branch}
 * Includes session credentials (httpOnly cookie) for authentication.
 *
 * @throws {SessionExpiredError} when the backend returns 401 (session expired)
 * @throws {InstallationAccessError} when the backend returns 403 (repo not in installation)
 * @throws Error for network or other failures
 *
 * Requirements: 3.1, 3.5, 3.6, 3.7, 4.4
 */
export async function fetchPrivateContents(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  backendUrl?: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<GitHubContentItem[]> {
  const baseUrl = backendUrl ?? getAuthBackendUrl()
  if (!baseUrl) {
    throw new Error('Auth backend URL is not configured. Cannot access private repositories.')
  }

  const url = `${baseUrl}/api/proxy/contents/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${path}?ref=${encodeURIComponent(branch)}`

  let response: Response
  try {
    response = await fetchFn(url, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })
  } catch (error) {
    throw new Error(
      `Network error while fetching private contents: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new SessionExpiredError()
    }
    if (response.status === 403) {
      throw new InstallationAccessError()
    }
    if (response.status === 404) {
      throw new Error('Folder not found. Check the repository URL and path.')
    }
    throw new Error(`Proxy API error: ${response.status} ${response.statusText}`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('Expected a directory listing but received a file response.')
  }

  return data.map((item: Record<string, unknown>) => ({
    name: item.name as string,
    path: item.path as string,
    type: item.type as 'file' | 'dir',
    size: item.size as number | undefined,
    download_url: (item.download_url as string | null) ?? null,
  }))
}

/**
 * Fetch the raw content of a file from a private GitHub repository
 * via the auth backend proxy.
 *
 * Routes requests through: /api/proxy/raw/{owner}/{repo}/{path}?ref={branch}
 * Includes session credentials (httpOnly cookie) for authentication.
 *
 * @throws {SessionExpiredError} when the backend returns 401 (session expired)
 * @throws {InstallationAccessError} when the backend returns 403 (repo not in installation)
 * @throws Error for network or other failures
 *
 * Requirements: 3.1, 3.5, 3.6, 3.7, 4.4
 */
export async function fetchPrivateFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  backendUrl?: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const baseUrl = backendUrl ?? getAuthBackendUrl()
  if (!baseUrl) {
    throw new Error('Auth backend URL is not configured. Cannot access private repositories.')
  }

  const url = `${baseUrl}/api/proxy/raw/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${path}?ref=${encodeURIComponent(branch)}`

  let response: Response
  try {
    response = await fetchFn(url, {
      credentials: 'include',
    })
  } catch (error) {
    throw new Error(
      `Network error while fetching private file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new SessionExpiredError()
    }
    if (response.status === 403) {
      throw new InstallationAccessError()
    }
    if (response.status === 404) {
      throw new Error('File not found.')
    }
    throw new Error(`Proxy API error: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

/**
 * Sort FileTreeNode arrays: directories first, then files, both alphabetically.
 */
function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1
    if (a.type === 'file' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Recursively discover markdown files in a GitHub repository directory.
 *
 * Traverses directories up to `maxDepth` levels deep (default 10),
 * building a hierarchical FileTreeNode[] structure containing only
 * markdown files and the directories that contain them.
 *
 * Supports both public (direct GitHub API) and private (proxy) modes
 * via the `fetchContentsFn` parameter.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - Directory path within the repository
 * @param branch - Branch name
 * @param fetchContentsFn - Function to fetch directory contents (enables public/private mode switching)
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @returns Hierarchical tree of markdown files and their parent directories
 */
export async function discoverMarkdownFiles(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  fetchContentsFn: (owner: string, repo: string, path: string, branch: string) => Promise<GitHubContentItem[]>,
  maxDepth: number = MAX_DISCOVERY_DEPTH,
): Promise<FileTreeNode[]> {
  return discoverRecursive(owner, repo, path, branch, fetchContentsFn, 0, maxDepth)
}

/**
 * Internal recursive helper for discoverMarkdownFiles.
 * Returns only markdown files and directories that contain markdown files.
 */
async function discoverRecursive(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  fetchContentsFn: (owner: string, repo: string, path: string, branch: string) => Promise<GitHubContentItem[]>,
  currentDepth: number,
  maxDepth: number,
): Promise<FileTreeNode[]> {
  if (currentDepth >= maxDepth) {
    return []
  }

  let items: GitHubContentItem[]
  try {
    items = await fetchContentsFn(owner, repo, path, branch)
  } catch {
    // If fetching fails for a subdirectory, skip it gracefully
    return []
  }

  const nodes: FileTreeNode[] = []

  // Collect markdown files
  const mdFiles = items.filter((item) => item.type === 'file' && isMarkdownFile(item.name))
  for (const file of mdFiles) {
    nodes.push({
      name: file.name,
      path: file.path,
      type: 'file',
    })
  }

  // Recursively process directories
  const directories = items.filter((item) => item.type === 'dir')
  const dirResults = await Promise.all(
    directories.map(async (dir) => {
      const children = await discoverRecursive(
        owner,
        repo,
        dir.path,
        branch,
        fetchContentsFn,
        currentDepth + 1,
        maxDepth,
      )
      return { dir, children }
    }),
  )

  // Only include directories that contain markdown files (directly or nested)
  for (const { dir, children } of dirResults) {
    if (children.length > 0) {
      nodes.push({
        name: dir.name,
        path: dir.path,
        type: 'directory',
        children: sortFileTree(children),
      })
    }
  }

  return sortFileTree(nodes)
}
