/**
 * Share API service for managing share links.
 *
 * Provides functions to list and revoke share links via the backend API.
 * Uses the same authentication pattern as auth-service.ts (session cookies + CSRF headers).
 *
 * Requirements: 3.1, 4.1, 5.2
 */

export interface ShareEntry {
  token_hash: string;
  scope: { owner: string; repo: string; branch: string; path: string };
  created_at: number;
  expires_at: number;
  auth_method: 'oauth' | 'pat';
  status: 'active' | 'expired';
}

export class ShareApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'ShareApiError';
    this.statusCode = statusCode;
  }
}

function getBackendUrl(): string {
  const url = import.meta.env.VITE_AUTH_BACKEND_URL;
  if (typeof url === 'string' && url.trim().length > 0) {
    return url.trim().replace(/\/+$/, '');
  }
  throw new Error('Auth backend URL is not configured');
}

/**
 * Fetches the list of share links for the authenticated user.
 *
 * Calls GET /api/shares with credentials (session cookie).
 * Returns the list of ShareEntry objects from the user's manifest.
 *
 * @throws ShareApiError with status 401 if not authenticated
 * @throws ShareApiError with status 403 if using a scoped session
 * @throws ShareApiError with status 503 if identity resolution is unavailable
 */
export async function fetchShares(): Promise<ShareEntry[]> {
  const backendUrl = getBackendUrl();
  const response = await fetch(`${backendUrl}/api/shares`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ShareApiError(
      response.status,
      data.error || `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Revokes a share link by its token hash.
 *
 * Calls POST /api/shares/revoke with CSRF header and credentials.
 * Deletes the scoped session file and removes the manifest entry.
 *
 * @param tokenHash - The SHA-256 hash of the scoped session token to revoke
 * @throws ShareApiError with status 401 if not authenticated
 * @throws ShareApiError with status 403 if using a scoped session or missing CSRF header
 * @throws ShareApiError with status 404 if the share link is not found
 * @throws ShareApiError with status 503 if identity resolution is unavailable
 */
export async function revokeShare(tokenHash: string): Promise<void> {
  const backendUrl = getBackendUrl();
  const response = await fetch(`${backendUrl}/api/shares/revoke`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ token_hash: tokenHash }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ShareApiError(
      response.status,
      data.error || `Request failed with status ${response.status}`,
    );
  }
}
