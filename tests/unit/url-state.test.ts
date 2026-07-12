import { describe, it, expect } from 'vitest'
import { encodeHashState, parseHash, type HashState } from '@/services/url-state'

describe('url-state', () => {
  describe('encodeHashState', () => {
    it('encodes a basic state without file', () => {
      const state: HashState = {
        owner: 'octocat',
        repo: 'docs',
        branch: 'main',
        folderPath: 'guides',
      }
      expect(encodeHashState(state)).toBe('#/octocat/docs/main/guides')
    })

    it('encodes a state with file', () => {
      const state: HashState = {
        owner: 'octocat',
        repo: 'docs',
        branch: 'main',
        folderPath: 'guides',
        file: 'getting-started.md',
      }
      expect(encodeHashState(state)).toBe(
        '#/octocat/docs/main/guides?file=getting-started.md',
      )
    })

    it('encodes a nested folder path', () => {
      const state: HashState = {
        owner: 'myorg',
        repo: 'private-docs',
        branch: 'main',
        folderPath: 'api/v2',
        file: 'reference/auth.md',
      }
      expect(encodeHashState(state)).toBe(
        '#/myorg/private-docs/main/api/v2?file=reference%2Fauth.md',
      )
    })

    it('encodes special characters in segments', () => {
      const state: HashState = {
        owner: 'my-org',
        repo: 'my repo',
        branch: 'feature/test',
        folderPath: 'docs & guides',
      }
      expect(encodeHashState(state)).toBe(
        '#/my-org/my%20repo/feature%2Ftest/docs%20%26%20guides',
      )
    })

    it('encodes file path with special characters', () => {
      const state: HashState = {
        owner: 'org',
        repo: 'repo',
        branch: 'main',
        folderPath: 'docs',
        file: 'path/to/file with spaces.md',
      }
      expect(encodeHashState(state)).toBe(
        '#/org/repo/main/docs?file=path%2Fto%2Ffile%20with%20spaces.md',
      )
    })
  })

  describe('parseHash', () => {
    it('returns input route for empty hash', () => {
      expect(parseHash('')).toEqual({ type: 'input' })
      expect(parseHash('#')).toEqual({ type: 'input' })
      expect(parseHash('#/')).toEqual({ type: 'input' })
    })

    it('parses a reader route without file', () => {
      const result = parseHash('#/octocat/docs/main/guides')
      expect(result).toEqual({
        type: 'reader',
        state: {
          owner: 'octocat',
          repo: 'docs',
          branch: 'main',
          folderPath: 'guides',
          file: undefined,
        },
      })
    })

    it('parses a reader route with file', () => {
      const result = parseHash('#/octocat/docs/main/guides?file=getting-started.md')
      expect(result).toEqual({
        type: 'reader',
        state: {
          owner: 'octocat',
          repo: 'docs',
          branch: 'main',
          folderPath: 'guides',
          file: 'getting-started.md',
        },
      })
    })

    it('parses a nested folder path', () => {
      const result = parseHash('#/myorg/repo/develop/src/docs')
      expect(result).toEqual({
        type: 'reader',
        state: {
          owner: 'myorg',
          repo: 'repo',
          branch: 'develop',
          folderPath: 'src/docs',
          file: undefined,
        },
      })
    })

    it('parses oauth callback route', () => {
      const result = parseHash('#/oauth/callback?code=abc123&state=xyz')
      expect(result).toEqual({
        type: 'oauth-callback',
        params: new URLSearchParams('code=abc123&state=xyz'),
      })
    })

    it('parses oauth callback route without params', () => {
      const result = parseHash('#/oauth/callback')
      expect(result).toEqual({
        type: 'oauth-callback',
        params: new URLSearchParams(),
      })
    })

    it('parses share route', () => {
      const result = parseHash('#/share/eyJhbGciOiJSUzI1NiJ9')
      expect(result).toEqual({
        type: 'share',
        payload: 'eyJhbGciOiJSUzI1NiJ9',
      })
    })

    it('returns input for hash with fewer than 4 path segments', () => {
      expect(parseHash('#/owner/repo')).toEqual({ type: 'input' })
      expect(parseHash('#/owner/repo/branch')).toEqual({ type: 'input' })
    })

    it('handles encoded file path in query param', () => {
      const result = parseHash('#/org/repo/main/docs?file=reference%2Fauth.md')
      expect(result).toEqual({
        type: 'reader',
        state: {
          owner: 'org',
          repo: 'repo',
          branch: 'main',
          folderPath: 'docs',
          file: 'reference/auth.md',
        },
      })
    })

    it('decodes URI-encoded path segments', () => {
      const result = parseHash('#/my-org/my%20repo/feature%2Ftest/docs%20%26%20guides')
      expect(result).toEqual({
        type: 'reader',
        state: {
          owner: 'my-org',
          repo: 'my repo',
          branch: 'feature/test',
          folderPath: 'docs & guides',
          file: undefined,
        },
      })
    })

    it('returns input for empty file query param', () => {
      const result = parseHash('#/org/repo/main/docs?file=')
      expect(result).toEqual({
        type: 'reader',
        state: {
          owner: 'org',
          repo: 'repo',
          branch: 'main',
          folderPath: 'docs',
          file: undefined,
        },
      })
    })
  })

  describe('round-trip', () => {
    it('encode then parse produces original state', () => {
      const state: HashState = {
        owner: 'octocat',
        repo: 'docs',
        branch: 'main',
        folderPath: 'guides',
        file: 'getting-started.md',
      }
      const hash = encodeHashState(state)
      const parsed = parseHash(hash)
      expect(parsed).toEqual({ type: 'reader', state })
    })

    it('round-trips nested folder paths', () => {
      const state: HashState = {
        owner: 'myorg',
        repo: 'private-docs',
        branch: 'develop',
        folderPath: 'api/v2/reference',
        file: 'auth.md',
      }
      const hash = encodeHashState(state)
      const parsed = parseHash(hash)
      expect(parsed).toEqual({ type: 'reader', state })
    })

    it('round-trips state with special characters', () => {
      const state: HashState = {
        owner: 'my-org',
        repo: 'my repo',
        branch: 'feature/test',
        folderPath: 'docs & guides',
        file: 'path/to/file with spaces.md',
      }
      const hash = encodeHashState(state)
      const parsed = parseHash(hash)
      expect(parsed).toEqual({ type: 'reader', state })
    })

    it('round-trips state with unicode characters', () => {
      const state: HashState = {
        owner: 'org',
        repo: 'repo',
        branch: 'main',
        folderPath: 'docs/日本語',
        file: 'ファイル.md',
      }
      const hash = encodeHashState(state)
      const parsed = parseHash(hash)
      expect(parsed).toEqual({ type: 'reader', state })
    })
  })
})
