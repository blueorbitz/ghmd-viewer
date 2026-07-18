import type { AuthResult, AuthService } from '@/types/auth';

const STORAGE_KEY = 'ghmd-authenticated';

/**
 * Creates an AuthService instance that manages the GitHub App OAuth flow
 * and session state via the configured backend.
 *
 * Requirements: 3.2, 3.3, 3.7, 3.8, 3.9, 5.3, 12.4, 12.5
 */
export function createAuthService(): AuthService {
  const backendUrl = getBackendUrl();

  function getBackendUrl(): string | null {
    const url = import.meta.env.VITE_AUTH_BACKEND_URL;
    if (typeof url === 'string' && url.trim().length > 0) {
      // Remove trailing slash for consistency
      return url.trim().replace(/\/+$/, '');
    }
    return null;
  }

  /**
   * Initiate the OAuth flow by redirecting to the backend login endpoint.
   * The backend generates a CSRF state and redirects to GitHub.
   *
   * @param returnUrl - The current hash to return to after auth completes
   */
  function initiateOAuth(returnUrl: string): void {
    if (!backendUrl) {
      throw new Error('Auth backend URL is not configured');
    }

    const loginUrl = new URL(`${backendUrl}/api/auth/login`);
    loginUrl.searchParams.set('return_hash', returnUrl);

    window.location.href = loginUrl.toString();
  }

  /**
   * Handle the OAuth callback. Since the backend handles the actual callback
   * and redirects back to the SPA with a cookie already set, this method
   * validates that the auth succeeded by checking the session status.
   *
   * @param code - The authorization code from the callback (unused on frontend; backend handles exchange)
   * @param state - The CSRF state parameter (unused on frontend; backend validates it)
   */
  async function handleOAuthCallback(
    _code: string,
    _state: string,
  ): Promise<AuthResult> {
    if (!backendUrl) {
      return {
        success: false,
        error: 'exchange_failed',
        message: 'Auth backend URL is not configured',
      };
    }

    // The backend already handled the code exchange and set the cookie.
    // Verify the session is active by checking status.
    try {
      const response = await fetch(`${backendUrl}/api/auth/status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'exchange_failed',
          message: `Auth status check failed with status ${response.status}`,
        };
      }

      const data = await response.json();

      if (data.authenticated) {
        localStorage.setItem(STORAGE_KEY, 'true');
        return { success: true };
      }

      return {
        success: false,
        error: 'exchange_failed',
        message: 'Authentication was not confirmed by the backend',
      };
    } catch (error) {
      return {
        success: false,
        error: 'exchange_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Network error during auth verification',
      };
    }
  }

  /**
   * Quick synchronous check using localStorage flag.
   * For a definitive check, use verifySession() which calls the backend.
   */
  function isAuthenticated(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  /**
   * Logout: POST to the backend to invalidate the session,
   * then clear the local storage flag.
   */
  async function logout(): Promise<void> {
    // Clear local flag first
    localStorage.removeItem(STORAGE_KEY);

    if (!backendUrl) {
      return;
    }

    try {
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Logout request failed (network issue), but local state is cleared
    }
  }

  /**
   * Login with a Personal Access Token by sending it to the backend
   * for validation against the GitHub API.
   *
   * The PAT is transmitted only in the request body and is never persisted
   * client-side. On success, the backend sets a session cookie and we
   * update the local auth flag.
   *
   * Requirements: 3.4, 3.5, 3.6, 3.7, 5.5, 5.6
   */
  async function loginWithPat(
    token: string,
    scope?: { owner: string; repo: string },
  ): Promise<AuthResult> {
    if (!backendUrl) {
      return {
        success: false,
        error: 'pat_login_failed',
        message: 'Auth backend URL is not configured',
      };
    }

    try {
      const body: { token: string; scope?: { owner: string; repo: string } } = { token };
      if (scope) {
        body.scope = scope;
      }

      const response = await fetch(`${backendUrl}/api/auth/pat-login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let message = `PAT login failed with status ${response.status}`;
        try {
          const data = await response.json();
          if (data.error && typeof data.error === 'string') {
            message = data.error;
          }
        } catch {
          // Could not parse error body, use default message
        }
        return {
          success: false,
          error: 'pat_login_failed',
          message,
        };
      }

      const data = await response.json();

      if (data.authenticated) {
        localStorage.setItem(STORAGE_KEY, 'true');
        return { success: true };
      }

      return {
        success: false,
        error: 'pat_login_failed',
        message: 'Authentication was not confirmed by the backend',
      };
    } catch (error) {
      return {
        success: false,
        error: 'pat_login_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to reach the server. Check your connection and try again.',
      };
    }
  }

  /**
   * Check if private repo features are available.
   * Returns true only when VITE_AUTH_BACKEND_URL is configured and non-empty.
   */
  function isPrivateAccessAvailable(): boolean {
    return backendUrl !== null;
  }

  return {
    initiateOAuth,
    handleOAuthCallback,
    loginWithPat,
    isAuthenticated,
    logout,
    getBackendUrl: () => backendUrl,
    isPrivateAccessAvailable,
  };
}
