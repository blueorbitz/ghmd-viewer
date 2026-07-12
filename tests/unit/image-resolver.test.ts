import { describe, it, expect } from 'vitest'
import {
  resolveImageUrl,
  isAbsoluteUrl,
  resolveRelativePath,
} from '@/services/image-resolver'

describe('image-resolver', () => {
  describe('isAbsoluteUrl', () => {
    it('returns true for https URLs', () => {
      expect(isAbsoluteUrl('https://example.com/image.png')).toBe(true)
    })

    it('returns true for http URLs', () => {
      expect(isAbsoluteUrl('http://example.com/image.png')).toBe(true)
    })

    it('returns true for protocol-relative URLs', () => {
      expect(isAbsoluteUrl('//cdn.example.com/image.png')).toBe(true)
    })

    it('returns false for relative paths', () => {
      expect(isAbsoluteUrl('./image.png')).toBe(false)
      expect(isAbsoluteUrl('../assets/logo.png')).toBe(false)
      expect(isAbsoluteUrl('images/photo.jpg')).toBe(false)
    })

    it('is case-insensitive for protocol', () => {
      expect(isAbsoluteUrl('HTTPS://example.com/img.png')).toBe(true)
      expect(isAbsoluteUrl('Http://example.com/img.png')).toBe(true)
    })
  })

  describe('resolveRelativePath', () => {
    it('resolves a simple relative path from base', () => {
      expect(resolveRelativePath('image.png', 'docs/guides')).toBe('docs/guides/image.png')
    })

    it('resolves a ./ prefixed path', () => {
      expect(resolveRelativePath('./image.png', 'docs/guides')).toBe('docs/guides/image.png')
    })

    it('resolves ../ to go up one level', () => {
      expect(resolveRelativePath('../assets/logo.png', 'docs/guides')).toBe('docs/assets/logo.png')
    })

    it('resolves multiple ../ references', () => {
      expect(resolveRelativePath('../../root-img.png', 'docs/guides/sub')).toBe('docs/root-img.png')
    })

    it('handles nested relative paths', () => {
      expect(resolveRelativePath('sub/nested/img.png', 'docs')).toBe('docs/sub/nested/img.png')
    })

    it('handles empty base path', () => {
      expect(resolveRelativePath('image.png', '')).toBe('image.png')
    })

    it('handles base path with leading/trailing slashes', () => {
      expect(resolveRelativePath('image.png', '/docs/guides/')).toBe('docs/guides/image.png')
    })
  })

  describe('resolveImageUrl', () => {
    const defaultParams = {
      basePath: 'docs/guides',
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'main',
    }

    describe('absolute URLs', () => {
      it('returns absolute https URLs unchanged', () => {
        const url = 'https://cdn.example.com/image.png'
        expect(resolveImageUrl(url, defaultParams.basePath, defaultParams.owner, defaultParams.repo, defaultParams.branch, false)).toBe(url)
      })

      it('returns absolute http URLs unchanged', () => {
        const url = 'http://example.com/photo.jpg'
        expect(resolveImageUrl(url, defaultParams.basePath, defaultParams.owner, defaultParams.repo, defaultParams.branch, true, 'https://backend.example.com')).toBe(url)
      })

      it('returns protocol-relative URLs unchanged', () => {
        const url = '//cdn.example.com/image.png'
        expect(resolveImageUrl(url, defaultParams.basePath, defaultParams.owner, defaultParams.repo, defaultParams.branch, false)).toBe(url)
      })
    })

    describe('public repos — relative paths', () => {
      it('resolves to raw.githubusercontent.com URL', () => {
        const result = resolveImageUrl(
          'screenshot.png',
          'docs/guides',
          'octocat',
          'hello-world',
          'main',
          false,
        )
        expect(result).toBe('https://raw.githubusercontent.com/octocat/hello-world/main/docs/guides/screenshot.png')
      })

      it('resolves ../ paths correctly', () => {
        const result = resolveImageUrl(
          '../assets/logo.png',
          'docs/guides',
          'octocat',
          'hello-world',
          'main',
          false,
        )
        expect(result).toBe('https://raw.githubusercontent.com/octocat/hello-world/main/docs/assets/logo.png')
      })

      it('encodes branch names with special characters', () => {
        const result = resolveImageUrl(
          'img.png',
          'docs',
          'octocat',
          'hello-world',
          'feature/new-branch',
          false,
        )
        expect(result).toBe('https://raw.githubusercontent.com/octocat/hello-world/feature%2Fnew-branch/docs/img.png')
      })
    })

    describe('private repos — relative paths', () => {
      it('routes through auth backend proxy', () => {
        const result = resolveImageUrl(
          'diagram.png',
          'docs/guides',
          'myorg',
          'private-repo',
          'main',
          true,
          'https://auth.example.com',
        )
        expect(result).toBe('https://auth.example.com/api/proxy/raw/myorg/private-repo/docs/guides/diagram.png?ref=main')
      })

      it('handles ../ paths with proxy', () => {
        const result = resolveImageUrl(
          '../assets/logo.png',
          'docs/guides',
          'myorg',
          'private-repo',
          'develop',
          true,
          'https://auth.example.com',
        )
        expect(result).toBe('https://auth.example.com/api/proxy/raw/myorg/private-repo/docs/assets/logo.png?ref=develop')
      })

      it('encodes branch ref parameter', () => {
        const result = resolveImageUrl(
          'img.png',
          'docs',
          'myorg',
          'private-repo',
          'feature/special',
          true,
          'https://auth.example.com',
        )
        expect(result).toBe('https://auth.example.com/api/proxy/raw/myorg/private-repo/docs/img.png?ref=feature%2Fspecial')
      })

      it('strips trailing slashes from backend URL', () => {
        const result = resolveImageUrl(
          'img.png',
          'docs',
          'myorg',
          'private-repo',
          'main',
          true,
          'https://auth.example.com/',
        )
        expect(result).toBe('https://auth.example.com/api/proxy/raw/myorg/private-repo/docs/img.png?ref=main')
      })

      it('falls back to public URL when backendUrl is not provided for private repo', () => {
        const result = resolveImageUrl(
          'img.png',
          'docs',
          'myorg',
          'private-repo',
          'main',
          true,
          undefined,
        )
        // Without a backend URL, falls through to the public URL format
        expect(result).toBe('https://raw.githubusercontent.com/myorg/private-repo/main/docs/img.png')
      })
    })
  })
})
