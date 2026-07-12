import { describe, it, expect, vi } from 'vitest'
import { parseGitHubUrl, buildGitHubUrl, resolveGitHubUrl } from '@/services/github-url-parser'

describe('parseGitHubUrl', () => {
  describe('valid URLs', () => {
    it('parses a standard GitHub folder URL', () => {
      const result = parseGitHubUrl('https://github.com/octocat/hello-world/tree/main/docs')
      expect(result).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
        branch: 'main',
        path: 'docs',
      })
    })

    it('parses a URL with nested path', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/develop/src/components/ui')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'develop',
        path: 'src/components/ui',
      })
    })

    it('parses a URL with www.github.com', () => {
      const result = parseGitHubUrl('https://www.github.com/owner/repo/tree/main/folder')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        path: 'folder',
      })
    })

    it('handles URL with trailing slash', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/main/docs/')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        path: 'docs',
      })
    })

    it('handles URL with query parameters (ignores them)', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/main/docs?tab=readme')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        path: 'docs',
      })
    })

    it('handles URL with hash fragment (ignores it)', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/main/docs#section')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        path: 'docs',
      })
    })
  })

  describe('invalid URLs', () => {
    it('returns null for empty string', () => {
      expect(parseGitHubUrl('')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(parseGitHubUrl('   ')).toBeNull()
      expect(parseGitHubUrl('\t\n')).toBeNull()
    })

    it('returns null for non-URL strings', () => {
      expect(parseGitHubUrl('not a url')).toBeNull()
      expect(parseGitHubUrl('hello world')).toBeNull()
    })

    it('returns null for non-GitHub domains', () => {
      expect(parseGitHubUrl('https://gitlab.com/owner/repo/tree/main/docs')).toBeNull()
      expect(parseGitHubUrl('https://bitbucket.org/owner/repo/tree/main/docs')).toBeNull()
      expect(parseGitHubUrl('https://example.com/owner/repo/tree/main/docs')).toBeNull()
    })

    it('returns null for non-https protocol', () => {
      expect(parseGitHubUrl('http://github.com/owner/repo/tree/main/docs')).toBeNull()
    })

    it('returns null for URLs missing /tree/ segment', () => {
      expect(parseGitHubUrl('https://github.com/owner/repo')).toBeNull()
      expect(parseGitHubUrl('https://github.com/owner/repo/blob/main/file.md')).toBeNull()
    })

    it('returns null for URLs without a path after branch', () => {
      expect(parseGitHubUrl('https://github.com/owner/repo/tree/main')).toBeNull()
    })

    it('returns null for URLs with only owner', () => {
      expect(parseGitHubUrl('https://github.com/owner')).toBeNull()
    })

    it('returns null for GitHub root URL', () => {
      expect(parseGitHubUrl('https://github.com')).toBeNull()
      expect(parseGitHubUrl('https://github.com/')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('trims whitespace from input', () => {
      const result = parseGitHubUrl('  https://github.com/owner/repo/tree/main/docs  ')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        path: 'docs',
      })
    })

    it('handles repos with dots and hyphens in name', () => {
      const result = parseGitHubUrl('https://github.com/my-org/my.repo-name/tree/main/docs')
      expect(result).toEqual({
        owner: 'my-org',
        repo: 'my.repo-name',
        branch: 'main',
        path: 'docs',
      })
    })

    it('handles branch names with version-like patterns', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/v1.0.0/docs')
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        branch: 'v1.0.0',
        path: 'docs',
      })
    })
  })
})

describe('buildGitHubUrl', () => {
  it('builds a URL from parsed components', () => {
    const url = buildGitHubUrl({
      owner: 'octocat',
      repo: 'hello-world',
      branch: 'main',
      path: 'docs',
    })
    expect(url).toBe('https://github.com/octocat/hello-world/tree/main/docs')
  })

  it('builds a URL with nested path', () => {
    const url = buildGitHubUrl({
      owner: 'owner',
      repo: 'repo',
      branch: 'develop',
      path: 'src/components/ui',
    })
    expect(url).toBe('https://github.com/owner/repo/tree/develop/src/components/ui')
  })
})

describe('resolveGitHubUrl', () => {
  it('returns null for invalid URLs', async () => {
    const mockFetch = vi.fn()
    expect(await resolveGitHubUrl('', mockFetch)).toBeNull()
    expect(await resolveGitHubUrl('not a url', mockFetch)).toBeNull()
    expect(await resolveGitHubUrl('https://gitlab.com/owner/repo/tree/main/docs', mockFetch)).toBeNull()
  })

  it('resolves a URL with a simple branch name', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })

    const result = await resolveGitHubUrl(
      'https://github.com/owner/repo/tree/main/docs',
      mockFetch,
    )

    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'docs',
    })
  })

  it('resolves a branch name with slashes', async () => {
    // Mock: "feature/fix" branch exists, "feature/fix/docs" does not
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('branches/feature%2Ffix%2Fdocs')) {
        return Promise.resolve({ ok: false, status: 404 })
      }
      if (url.includes('branches/feature%2Ffix')) {
        return Promise.resolve({ ok: true })
      }
      if (url.includes('branches/feature')) {
        return Promise.resolve({ ok: true })
      }
      return Promise.resolve({ ok: false, status: 404 })
    })

    const result = await resolveGitHubUrl(
      'https://github.com/owner/repo/tree/feature/fix/docs/readme',
      mockFetch,
    )

    // Tries from longest branch candidate to shortest.
    // "feature/fix/docs" (404) → "feature/fix" (200) → resolves here
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'feature/fix',
      path: 'docs/readme',
    })
  })

  it('falls back to simple parser when all API calls fail', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await resolveGitHubUrl(
      'https://github.com/owner/repo/tree/main/docs',
      mockFetch,
    )

    // Falls back to simple parsing
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'docs',
    })
  })

  it('falls back to simple parser when no branch is found via API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

    const result = await resolveGitHubUrl(
      'https://github.com/owner/repo/tree/main/docs/subfolder',
      mockFetch,
    )

    // Falls back to simple parsing (first segment as branch)
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'docs/subfolder',
    })
  })
})
