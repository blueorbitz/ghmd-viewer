import type { ShareLinkParams, ShareLinkPayload, DecryptResult } from '@/types/share';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const MIN_PASSPHRASE_LENGTH = 8;
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 720;

/**
 * Validates that the passphrase meets minimum length requirement.
 * @throws Error if passphrase is too short.
 */
function validatePassphrase(passphrase: string): void {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long`
    );
  }
}

/**
 * Validates that the expiration time is within the allowed range.
 * @throws Error if expiresInHours is out of range.
 */
function validateExpiration(expiresInHours: number): void {
  if (expiresInHours < MIN_EXPIRY_HOURS || expiresInHours > MAX_EXPIRY_HOURS) {
    throw new Error(
      `Expiration must be between ${MIN_EXPIRY_HOURS} and ${MAX_EXPIRY_HOURS} hours`
    );
  }
}

/**
 * Encodes a Uint8Array to a base64url string (no padding, URL-safe characters).
 */
function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a base64url string to a Uint8Array.
 */
function fromBase64Url(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives an AES-GCM 256-bit key from a passphrase using PBKDF2.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Creates an encrypted share link.
 *
 * Encrypts the session token with AES-GCM using a PBKDF2-derived key from the passphrase.
 * Returns a full URL with the encrypted payload encoded as base64url in the hash fragment.
 */
export async function createShareLink(params: ShareLinkParams): Promise<string> {
  validatePassphrase(params.passphrase);
  validateExpiration(params.expiresInHours);

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(params.passphrase, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(params.sessionToken);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );

  const expiresAt = Date.now() + params.expiresInHours * 60 * 60 * 1000;

  const payload: ShareLinkPayload = {
    encryptedData: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
    salt: toBase64Url(salt),
    expiresAt,
    owner: params.owner,
    repo: params.repo,
    branch: params.branch,
    path: params.path,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64Url = toBase64Url(new TextEncoder().encode(payloadJson));

  return `${window.location.origin}${window.location.pathname}#/share/${payloadBase64Url}`;
}

/**
 * Parses a share link URL hash and extracts the encrypted payload.
 *
 * Expected format: #/share/{base64url-payload}
 * Returns null if the hash does not match the expected format or the payload is invalid.
 */
export function parseShareLink(hash: string): ShareLinkPayload | null {
  const prefix = '#/share/';
  if (!hash.startsWith(prefix)) {
    return null;
  }

  const encodedPayload = hash.slice(prefix.length);
  if (!encodedPayload) {
    return null;
  }

  try {
    const payloadBytes = fromBase64Url(encodedPayload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadJson) as ShareLinkPayload;

    // Validate required fields
    if (
      typeof payload.encryptedData !== 'string' ||
      typeof payload.iv !== 'string' ||
      typeof payload.salt !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      typeof payload.owner !== 'string' ||
      typeof payload.repo !== 'string' ||
      typeof payload.branch !== 'string' ||
      typeof payload.path !== 'string'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Decrypts a share link payload using the provided passphrase.
 *
 * Derives the AES-GCM key from the passphrase and salt, then decrypts the ciphertext.
 * Returns the original session token on success, or an error on failure.
 */
export async function decryptPayload(
  payload: ShareLinkPayload,
  passphrase: string
): Promise<DecryptResult> {
  try {
    const salt = fromBase64Url(payload.salt);
    const iv = fromBase64Url(payload.iv);
    const ciphertext = fromBase64Url(payload.encryptedData);

    const key = await deriveKey(passphrase, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );

    const sessionToken = new TextDecoder().decode(decrypted);
    return { success: true, sessionToken };
  } catch {
    return { success: false, error: 'invalid_passphrase' };
  }
}

/**
 * Checks whether a share link payload has expired.
 *
 * Returns true if the current time exceeds the expiresAt timestamp.
 */
export function isExpired(payload: ShareLinkPayload): boolean {
  return Date.now() > payload.expiresAt;
}

// Export validation helpers for testing
export { validatePassphrase, validateExpiration, toBase64Url, fromBase64Url };
