/**
 * Link resolution utilities for the MarkdownRenderer.
 *
 * Classifies links as external, relative markdown, or other,
 * and resolves relative paths against the current file's base path.
 */

/**
 * Checks if a URL is an external link (starts with http:// or https://).
 */
export function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/**
 * Checks if a link is a relative path ending in .md (case-insensitive).
 * Excludes absolute URLs and protocol-relative URLs.
 */
export function isRelativeMarkdownLink(href: string): boolean {
  if (isExternalLink(href) || href.startsWith('//')) {
    return false
  }
  // Strip any hash fragment or query string before checking extension
  const withoutFragment = href.split('#')[0].split('?')[0]
  return /\.md$/i.test(withoutFragment)
}

/**
 * Resolves a relative path against a base path (directory of the current file).
 *
 * @param basePath - The repo-relative directory path of the current file (e.g., "docs/guides")
 * @param href - The relative link href (e.g., "../intro.md", "./setup.md", "other.md")
 * @returns The resolved repo-relative path (e.g., "docs/intro.md")
 */
export function resolveRelativePath(basePath: string, href: string): string {
  // Strip hash fragment and query string from href for path resolution
  const cleanHref = href.split('#')[0].split('?')[0]

  // Split basePath into segments (filter out empty strings from leading/trailing slashes)
  const baseSegments = basePath.split('/').filter(Boolean)

  // Split the relative href into segments
  const relSegments = cleanHref.split('/').filter(Boolean)

  // Start from the base path segments and apply relative navigation
  const resolved = [...baseSegments]

  for (const segment of relSegments) {
    if (segment === '..') {
      resolved.pop()
    } else if (segment !== '.') {
      resolved.push(segment)
    }
  }

  return resolved.join('/')
}
