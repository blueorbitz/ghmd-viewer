import type { ParsedGitHubUrl } from '@/types/github'

/**
 * Parse a GitHub folder URL into its components.
 *
 * Expected format: https://github.com/{owner}/{repo}/tree/{branch}/{path}
 *
 * Returns null for:
 * - Empty or whitespace-only strings
 * - Non-GitHub domains
 * - URLs missing the /tree/ segment
 * - URLs without enough path segments (owner, repo, branch, path)
 * - Malformed URLs
 *
 * For branch names with slashes, the parser assumes the first segment
 * after "tree/" is the branch name. A separate async function
 * (resolveGitHubUrl) can use the GitHub API to resolve ambiguity.
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  // Reject empty or whitespace-only strings
  if (!url || !url.trim()) {
    return null
  }

  const trimmed = url.trim()

  // Parse as URL — reject malformed URLs
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  // Only accept GitHub domains (github.com)
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    return null
  }

  // Only accept https protocol
  if (parsed.protocol !== 'https:') {
    return null
  }

  // Split pathname into segments, filtering empty strings
  const segments = parsed.pathname.split('/').filter(Boolean)

  // Minimum: owner / repo / tree / branch / path (at least one path segment)
  // segments: [owner, repo, 'tree', branch, ...pathSegments]
  if (segments.length < 5) {
    return null
  }

  const [owner, repo, treeKeyword, ...rest] = segments

  // Must have the /tree/ segment
  if (treeKeyword !== 'tree') {
    return null
  }

  // Validate owner and repo are non-empty
  if (!owner || !repo) {
    return null
  }

  // First segment after 'tree' is the branch, rest is the path
  // For branch names with slashes, this simple parser takes only the first segment.
  // Use resolveGitHubUrl() for API-based ambiguity resolution.
  const branch = rest[0]
  const pathSegments = rest.slice(1)

  if (!branch) {
    return null
  }

  // Path must have at least one segment (pointing to a folder)
  if (pathSegments.length === 0) {
    return null
  }

  const path = pathSegments.join('/')

  return {
    owner,
    repo,
    branch,
    path,
  }
}

/**
 * Reconstruct a GitHub URL from parsed components.
 * Useful for round-trip validation.
 */
export function buildGitHubUrl(parsed: ParsedGitHubUrl): string {
  return `https://github.com/${parsed.owner}/${parsed.repo}/tree/${parsed.branch}/${parsed.path}`
}

/**
 * Async variant that uses the GitHub API to resolve branch name ambiguity
 * when the branch name contains slashes.
 *
 * For example, given:
 *   https://github.com/owner/repo/tree/feature/fix/docs/readme
 *
 * The branch could be "feature", "feature/fix", or "feature/fix/docs".
 * This function tries each possible split by checking if the branch exists
 * via the GitHub API.
 *
 * @param url - The GitHub URL to parse
 * @param fetchFn - Optional fetch function for testing (defaults to global fetch)
 * @returns ParsedGitHubUrl with the correct branch/path split, or null if invalid
 */
export async function resolveGitHubUrl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<ParsedGitHubUrl | null> {
  // First, do basic validation
  if (!url || !url.trim()) {
    return null
  }

  const trimmed = url.trim()

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    return null
  }

  if (parsed.protocol !== 'https:') {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)

  if (segments.length < 5) {
    return null
  }

  const [owner, repo, treeKeyword, ...rest] = segments

  if (treeKeyword !== 'tree') {
    return null
  }

  if (!owner || !repo || rest.length < 2) {
    return null
  }

  // Try each possible branch/path split, from longest branch to shortest
  // We try longer branch names first since they're more specific
  for (let i = rest.length - 1; i >= 1; i--) {
    const candidateBranch = rest.slice(0, i).join('/')
    const candidatePath = rest.slice(i).join('/')

    if (!candidatePath) continue

    try {
      const response = await fetchFn(
        `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(candidateBranch)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/vnd.github.v3+json' },
        },
      )

      if (response.ok) {
        return {
          owner,
          repo,
          branch: candidateBranch,
          path: candidatePath,
        }
      }
    } catch {
      // Network error — continue trying other splits
    }
  }

  // Fallback: use the simple parser (first segment as branch)
  return parseGitHubUrl(url)
}
