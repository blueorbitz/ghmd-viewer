/**
 * Result of an OAuth callback or PAT login handling attempt.
 */
export type AuthResult =
  | { success: true }
  | { success: false; error: 'state_mismatch' | 'exchange_failed' | 'cancelled' | 'pat_login_failed'; message: string };

/**
 * Request body for PAT-based login.
 */
export interface PatLoginRequest {
  token: string;
  scope?: {
    owner: string;
    repo: string;
  };
}

/**
 * Response from the auth status endpoint.
 */
export interface AuthStatusResponse {
  authenticated: boolean;
  auth_method?: 'oauth' | 'pat';
}

/**
 * Service interface for managing GitHub App OAuth flow, PAT authentication, and session state.
 */
export interface AuthService {
  /** Initiate OAuth flow (redirect to GitHub). */
  initiateOAuth(returnUrl: string): void;

  /** Handle OAuth callback, validate state and exchange code. */
  handleOAuthCallback(code: string, state: string): Promise<AuthResult>;

  /** Login with a Personal Access Token. */
  loginWithPat(token: string, scope?: { owner: string; repo: string }): Promise<AuthResult>;

  /** Check if user has an active session. */
  isAuthenticated(): boolean;

  /** Logout and clear session. */
  logout(): Promise<void>;

  /** Get the auth backend base URL (null if not configured). */
  getBackendUrl(): string | null;

  /** Check if private repo features are available (backend configured). */
  isPrivateAccessAvailable(): boolean;
}
