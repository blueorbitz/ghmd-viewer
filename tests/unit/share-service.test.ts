import { describe, it, expect, beforeEach } from 'vitest';
import {
  createShareLink,
  parseShareLink,
  decryptPayload,
  isExpired,
  validatePassphrase,
  validateExpiration,
  toBase64Url,
  fromBase64Url,
} from '@/services/share-service';
import type { ShareLinkParams, ShareLinkPayload } from '@/types/share';

describe('ShareService', () => {
  describe('validatePassphrase', () => {
    it('should throw for passphrases shorter than 8 characters', () => {
      expect(() => validatePassphrase('')).toThrow();
      expect(() => validatePassphrase('short')).toThrow();
      expect(() => validatePassphrase('1234567')).toThrow();
    });

    it('should not throw for passphrases with 8 or more characters', () => {
      expect(() => validatePassphrase('12345678')).not.toThrow();
      expect(() => validatePassphrase('a long passphrase')).not.toThrow();
    });
  });

  describe('validateExpiration', () => {
    it('should throw for expiration less than 1 hour', () => {
      expect(() => validateExpiration(0)).toThrow();
      expect(() => validateExpiration(-1)).toThrow();
      expect(() => validateExpiration(0.5)).toThrow();
    });

    it('should throw for expiration greater than 720 hours', () => {
      expect(() => validateExpiration(721)).toThrow();
      expect(() => validateExpiration(1000)).toThrow();
    });

    it('should not throw for valid expiration values', () => {
      expect(() => validateExpiration(1)).not.toThrow();
      expect(() => validateExpiration(720)).not.toThrow();
      expect(() => validateExpiration(24)).not.toThrow();
    });
  });

  describe('toBase64Url / fromBase64Url', () => {
    it('should round-trip encode and decode bytes', () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
      const encoded = toBase64Url(original);
      const decoded = fromBase64Url(encoded);
      expect(decoded).toEqual(original);
    });

    it('should produce URL-safe characters (no +, /, or =)', () => {
      // Use bytes that would produce +, /, and = in standard base64
      const bytes = new Uint8Array([251, 255, 254, 253, 252]);
      const encoded = toBase64Url(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should handle empty array', () => {
      const empty = new Uint8Array(0);
      const encoded = toBase64Url(empty);
      const decoded = fromBase64Url(encoded);
      expect(decoded).toEqual(empty);
    });
  });

  describe('createShareLink', () => {
    beforeEach(() => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'https://example.com',
          pathname: '/viewer/',
        },
        writable: true,
      });
    });

    it('should create a valid share link URL', async () => {
      const params: ShareLinkParams = {
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
        sessionToken: 'ghs_test123',
        passphrase: 'mysecretpassphrase',
        expiresInHours: 24,
      };

      const url = await createShareLink(params);

      expect(url).toMatch(/^https:\/\/example\.com\/viewer\/#\/share\/.+$/);
    });

    it('should reject passphrase shorter than 8 characters', async () => {
      const params: ShareLinkParams = {
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
        sessionToken: 'ghs_test123',
        passphrase: 'short',
        expiresInHours: 24,
      };

      await expect(createShareLink(params)).rejects.toThrow(
        'Passphrase must be at least 8 characters'
      );
    });

    it('should reject expiration out of range', async () => {
      const params: ShareLinkParams = {
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
        sessionToken: 'ghs_test123',
        passphrase: 'mysecretpassphrase',
        expiresInHours: 800,
      };

      await expect(createShareLink(params)).rejects.toThrow(
        'Expiration must be between 1 and 720 hours'
      );
    });
  });

  describe('parseShareLink', () => {
    it('should return null for non-share hashes', () => {
      expect(parseShareLink('#/octocat/repo/main/docs')).toBeNull();
      expect(parseShareLink('#/')).toBeNull();
      expect(parseShareLink('')).toBeNull();
      expect(parseShareLink('#/share/')).toBeNull();
    });

    it('should return null for invalid base64url payload', () => {
      expect(parseShareLink('#/share/not-valid-json!!!')).toBeNull();
    });

    it('should parse a valid share link payload', () => {
      const payload: ShareLinkPayload = {
        encryptedData: 'abc123',
        iv: 'def456',
        salt: 'ghi789',
        expiresAt: Date.now() + 3600000,
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
      };

      const payloadJson = JSON.stringify(payload);
      const payloadBase64Url = toBase64Url(new TextEncoder().encode(payloadJson));
      const hash = `#/share/${payloadBase64Url}`;

      const result = parseShareLink(hash);

      expect(result).not.toBeNull();
      expect(result!.owner).toBe('octocat');
      expect(result!.repo).toBe('hello-world');
      expect(result!.branch).toBe('main');
      expect(result!.path).toBe('docs');
      expect(result!.encryptedData).toBe('abc123');
      expect(result!.iv).toBe('def456');
      expect(result!.salt).toBe('ghi789');
    });

    it('should return null for payload missing required fields', () => {
      const incomplete = { encryptedData: 'abc', iv: 'def' };
      const encoded = toBase64Url(
        new TextEncoder().encode(JSON.stringify(incomplete))
      );
      expect(parseShareLink(`#/share/${encoded}`)).toBeNull();
    });
  });

  describe('decryptPayload', () => {
    it('should decrypt with the correct passphrase', async () => {
      const params: ShareLinkParams = {
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
        sessionToken: 'ghs_secrettoken123',
        passphrase: 'correctpassphrase',
        expiresInHours: 24,
      };

      // Mock window.location for createShareLink
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com', pathname: '/' },
        writable: true,
      });

      const url = await createShareLink(params);
      const hash = '#' + url.split('#')[1];
      const payload = parseShareLink(hash)!;

      const result = await decryptPayload(payload, 'correctpassphrase');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.sessionToken).toBe('ghs_secrettoken123');
      }
    });

    it('should fail with an incorrect passphrase', async () => {
      const params: ShareLinkParams = {
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
        sessionToken: 'ghs_secrettoken123',
        passphrase: 'correctpassphrase',
        expiresInHours: 24,
      };

      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com', pathname: '/' },
        writable: true,
      });

      const url = await createShareLink(params);
      const hash = '#' + url.split('#')[1];
      const payload = parseShareLink(hash)!;

      const result = await decryptPayload(payload, 'wrongpassphrase!');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('invalid_passphrase');
      }
    });
  });

  describe('isExpired', () => {
    it('should return true for expired payloads', () => {
      const payload: ShareLinkPayload = {
        encryptedData: '',
        iv: '',
        salt: '',
        expiresAt: Date.now() - 1000, // 1 second in the past
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
      };

      expect(isExpired(payload)).toBe(true);
    });

    it('should return false for non-expired payloads', () => {
      const payload: ShareLinkPayload = {
        encryptedData: '',
        iv: '',
        salt: '',
        expiresAt: Date.now() + 3600000, // 1 hour in the future
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
      };

      expect(isExpired(payload)).toBe(false);
    });
  });

  describe('round-trip: createShareLink → parseShareLink → decryptPayload', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.com', pathname: '/app/' },
        writable: true,
      });
    });

    it('should preserve owner, repo, branch, path through round-trip', async () => {
      const params: ShareLinkParams = {
        owner: 'my-org',
        repo: 'private-docs',
        branch: 'feature/branch-name',
        path: 'api/v2/reference',
        sessionToken: 'ghs_abc123xyz',
        passphrase: 'super-secret-pass!',
        expiresInHours: 48,
      };

      const url = await createShareLink(params);
      const hash = '#' + url.split('#')[1];
      const payload = parseShareLink(hash)!;

      expect(payload.owner).toBe('my-org');
      expect(payload.repo).toBe('private-docs');
      expect(payload.branch).toBe('feature/branch-name');
      expect(payload.path).toBe('api/v2/reference');
    });

    it('should set expiresAt in the future based on expiresInHours', async () => {
      const now = Date.now();
      const params: ShareLinkParams = {
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
        sessionToken: 'ghs_test',
        passphrase: 'my-password-123',
        expiresInHours: 2,
      };

      const url = await createShareLink(params);
      const hash = '#' + url.split('#')[1];
      const payload = parseShareLink(hash)!;

      // expiresAt should be roughly 2 hours from now
      const expectedMin = now + 2 * 60 * 60 * 1000 - 5000;
      const expectedMax = now + 2 * 60 * 60 * 1000 + 5000;
      expect(payload.expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(payload.expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });
});
