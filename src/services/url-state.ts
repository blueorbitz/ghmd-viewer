/**
 * URL hash state encoding/decoding for the GitHub Markdown Viewer.
 *
 * Hash format:
 *   #/{owner}/{repo}/{branch}/{folderPath}?file={relativeMdFilePath}
 *
 * Special routes:
 *   #/share/{base64url-payload}   — share link
 *   #/oauth/callback              — OAuth callback
 */

export interface HashState {
  owner: string
  repo: string
  branch: string
  folderPath: string
  file?: string
}

export type Route =
  | { type: 'input' }
  | { type: 'reader'; state: HashState }
  | { type: 'oauth-callback'; params: URLSearchParams }
  | { type: 'share'; payload: string }
  | { type: 'security' }
  | { type: 'shares' }

/**
 * Encode a navigation state into a URL hash string.
 * Each path segment is URI-encoded to handle special characters (spaces, #, ?, &, etc.)
 * The file query parameter is also encoded.
 */
export function encodeHashState(state: HashState): string {
  const ownerEncoded = encodeURIComponent(state.owner)
  const repoEncoded = encodeURIComponent(state.repo)
  const branchEncoded = encodeURIComponent(state.branch)
  // Encode each folder path segment individually to preserve '/' as separator
  const folderPathEncoded = state.folderPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  const base = `#/${ownerEncoded}/${repoEncoded}/${branchEncoded}/${folderPathEncoded}`
  if (state.file) {
    return `${base}?file=${encodeURIComponent(state.file)}`
  }
  return base
}

/**
 * Parse the current URL hash into a Route.
 * Handles decoding of URI-encoded segments.
 * Returns { type: 'input' } for invalid/malformed hashes (fewer than 4 segments).
 */
export function parseHash(hash: string): Route {
  // Remove leading '#' if present
  const raw = hash.startsWith('#') ? hash.slice(1) : hash

  if (!raw || raw === '/') {
    return { type: 'input' }
  }

  // OAuth callback: #/oauth/callback?code=...&state=...
  if (raw.startsWith('/oauth/callback')) {
    const queryStart = raw.indexOf('?')
    const params =
      queryStart >= 0 ? new URLSearchParams(raw.slice(queryStart + 1)) : new URLSearchParams()
    return { type: 'oauth-callback', params }
  }

  // Share link: #/share/{base64url-payload}
  if (raw.startsWith('/share/')) {
    const payload = raw.slice('/share/'.length)
    return { type: 'share', payload }
  }

  // Security page: #/security
  if (raw === '/security') {
    return { type: 'security' }
  }

  // Shares management: #/shares
  if (raw === '/shares') {
    return { type: 'shares' }
  }

  // Reader route: #/{owner}/{repo}/{branch}/{folderPath}?file={filePath}
  // Split path from query string — only split on first '?' to handle encoded '?' in segments
  const queryIndex = raw.indexOf('?')
  const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex + 1) : undefined

  const segments = pathPart.split('/').filter(Boolean)

  if (segments.length < 4) {
    return { type: 'input' }
  }

  // Decode each segment to handle URI-encoded characters
  const owner = decodeURIComponent(segments[0])
  const repo = decodeURIComponent(segments[1])
  const branch = decodeURIComponent(segments[2])
  const folderSegments = segments.slice(3).map((s) => decodeURIComponent(s))
  const folderPath = folderSegments.join('/')

  // Validate that all required fields are non-empty after decoding
  if (!owner || !repo || !branch || !folderPath) {
    return { type: 'input' }
  }

  const params = queryPart ? new URLSearchParams(queryPart) : undefined
  const file = params?.get('file') ?? undefined

  return {
    type: 'reader',
    state: { owner, repo, branch, folderPath, file: file || undefined },
  }
}

/**
 * Navigate to a new hash state by updating window.location.hash.
 */
export function navigateToHash(state: HashState): void {
  window.location.hash = encodeHashState(state)
}

/**
 * Navigate to the input view (root).
 * This clears the hash, which routes to the InputView where the user can enter a new URL.
 */
export function navigateToInput(): void {
  window.location.hash = ''
}
