/**
 * Image URL resolution for Markdown images.
 *
 * Resolves relative image paths based on repository context:
 * - Absolute URLs → returned as-is
 * - Relative paths + public repo → raw.githubusercontent.com URL
 * - Relative paths + private repo → Auth_Backend proxy URL
 *
 * Requirements: 9.1, 9.2, 9.5
 */

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com'
const DEFAULT_BACKEND_PROXY_PATH = '/api/proxy/raw'

/**
 * Check if a URL is absolute (starts with http:// or https:// or protocol-relative //).
 */
export function isAbsoluteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src) || src.startsWith('//')
}

/**
 * Resolve a relative image path against a base path within the repository.
 *
 * Handles `./`, `../`, and plain relative paths by normalizing them
 * relative to the directory containing the current markdown file.
 *
 * @param relativeSrc - The relative image path from the markdown
 * @param basePath - The directory path of the current markdown file (repo-relative)
 * @returns The resolved repo-relative path
 */
export function resolveRelativePath(relativeSrc: string, basePath: string): string {
  // Normalize the base path — remove leading/trailing slashes
  const normalizedBase = basePath.replace(/^\/+|\/+$/g, '')

  // Split the base path into segments
  const baseSegments = normalizedBase ? normalizedBase.split('/') : []

  // Handle the relative src — strip leading ./
  let src = relativeSrc.replace(/^\.\//, '')

  // Split into segments
  const srcSegments = src.split('/')

  // Start from the base directory and resolve ../ references
  const resolved = [...baseSegments]
  for (const segment of srcSegments) {
    if (segment === '..') {
      resolved.pop()
    } else if (segment !== '.' && segment !== '') {
      resolved.push(segment)
    }
  }

  return resolved.join('/')
}

/**
 * Resolve an image src to a fetchable URL.
 *
 * @param src - The image src attribute from the markdown (relative or absolute)
 * @param basePath - The directory path of the current markdown file (repo-relative, e.g. "docs/guides")
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param isPrivate - Whether the repository is private
 * @param backendUrl - The Auth_Backend base URL (required for private repos)
 * @returns The resolved URL string ready for use in an <img> tag
 */
export function resolveImageUrl(
  src: string,
  basePath: string,
  owner: string,
  repo: string,
  branch: string,
  isPrivate: boolean,
  backendUrl?: string,
): string {
  // Absolute URLs are returned as-is
  if (isAbsoluteUrl(src)) {
    return src
  }

  // Resolve the relative path against the basePath
  const resolvedPath = resolveRelativePath(src, basePath)

  if (isPrivate && backendUrl) {
    // Private repos route through the Auth_Backend proxy
    const cleanBackendUrl = backendUrl.replace(/\/+$/, '')
    return `${cleanBackendUrl}${DEFAULT_BACKEND_PROXY_PATH}/${owner}/${repo}/${resolvedPath}?ref=${encodeURIComponent(branch)}`
  }

  // Public repos use raw.githubusercontent.com
  return `${GITHUB_RAW_BASE}/${owner}/${repo}/${encodeURIComponent(branch)}/${resolvedPath}`
}
