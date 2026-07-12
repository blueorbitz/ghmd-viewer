/**
 * Result of an OAuth callback handling attempt.
 */
export type AuthResult =
  | { success: true }
  | { success: false; error: 'state_mismatch' | 'exchange_failed' | 'cancelled'; message: string };

/**
 * Service interface for managing GitHub App OAuth flow and session state.
 */
export interface AuthService {
  /** Initiate OAuth flow (redirect to GitHub). */
  initiateOAuth(returnUrl: string): void;

  /** Handle OAuth callback, validate state and exchange code. */
  handleOAuthCallback(code: string, state: string): Promise<AuthResult>;

  /** Check if user has an active session. */
  isAuthenticated(): boolean;

  /** Logout and clear session. */
  logout(): Promise<void>;

  /** Get the auth backend base URL (null if not configured). */
  getBackendUrl(): string | null;

  /** Check if private repo features are available (backend configured). */
  isPrivateAccessAvailable(): boolean;
}
