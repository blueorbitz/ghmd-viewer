/**
 * Parameters for creating an encrypted share link.
 */
export interface ShareLinkParams {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  sessionToken: string;
  passphrase: string;
  /** Expiration time in hours (1–720, i.e. up to 30 days). */
  expiresInHours: number;
}

/**
 * The payload embedded in a share link URL hash.
 * Format: #/share/{base64url-encoded-payload}
 */
export interface ShareLinkPayload {
  /** Base64-encoded AES-GCM ciphertext. */
  encryptedData: string;
  /** Base64-encoded initialization vector. */
  iv: string;
  /** Base64-encoded PBKDF2 salt. */
  salt: string;
  /** Expiration as a Unix timestamp in milliseconds. */
  expiresAt: number;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

/**
 * Result of attempting to decrypt a share link payload.
 */
export type DecryptResult =
  | { success: true; sessionToken: string }
  | { success: false; error: 'invalid_passphrase' | 'decryption_error' };
