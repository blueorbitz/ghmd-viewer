import { describe, it, expect, vi } from 'vitest'
import {
  isMarkdownFile,
  filterMarkdownFiles,
  fetchPublicContents,
  checkRepoAccess,
  fetchFileContent,
  fetchPdfContent,
  fetchPrivateContents,
  fetchPrivateFileContent,
  fetchPrivatePdfContent,
  SessionExpiredError,
  InstallationAccessError,
  discoverMarkdownFiles,
  discoverSupportedFiles,
} from '@/services/github-service'
import type { GitHubContentItem } from '@/types/github'

describe('isMarkdownFile', () => {
  it('returns true for .md extension', () => {
    expect(isMarkdownFile('README.md')).toBe(true)
  })

  it('returns true for uppercase .MD extension', () => {
    expect(isMarkdownFile('CHANGELOG.MD')).toBe(true)
  })

  it('returns true for mixed case .Md extension', () => {
    expect(isMarkdownFile('notes.Md')).toBe(true)
  })

  it('returns false for non-markdown files', () => {
    expect(isMarkdownFile('script.ts')).toBe(false)
    expect(isMarkdownFile('style.css')).toBe(false)
    expect(isMarkdownFile('data.json')).toBe(false)
  })

  it('returns false for files with md in the name but different extension', () => {
    expect(isMarkdownFile('readme.txt')).toBe(false)
    expect(isMarkdownFile('markdown.html')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isMarkdownFile('')).toBe(false)
  })
})

describe('filterMarkdownFiles', () => {
  it('filters only markdown files from a mixed list', () => {
    const items: GitHubContentItem[] = [
      { name: 'README.md', path: 'README.md', type: 'file', download_url: null },
      { name: 'src', path: 'src', type: 'dir' },
      { name: 'index.ts', path: 'index.ts', type: 'file', download_url: null },
      { name: 'CHANGELOG.MD', path: 'CHANGELOG.MD', type: 'file', download_url: null },
    ]

    const result = filterMarkdownFiles(items)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('README.md')
    expect(result[1].name).toBe('CHANGELOG.MD')
  })

  it('excludes directories even if they end in .md', () => {
    const items: GitHubContentItem[] = [
      { name: 'docs.md', path: 'docs.md', type: 'dir' },
    ]

    const result = filterMarkdownFiles(items)
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterMarkdownFiles([])).toEqual([])
  })
})

describe('fetchPublicContents', () => {
  it('fetches and returns directory contents on success', async () => {
    const mockItems = [
      { name: 'README.md', path: 'docs/README.md', type: 'file', size: 100, download_url: 'https://example.com/raw' },
      { name: 'subfolder', path: 'docs/subfolder', type: 'dir', size: 0, download_url: null },
    ]

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockItems),
    })

    const result = await fetchPublicContents('owner', 'repo', 'docs', 'main', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/contents/docs?ref=main',
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'README.md',
      path: 'docs/README.md',
      type: 'file',
      size: 100,
      download_url: 'https://example.com/raw',
    })
    expect(result[1]).toEqual({
      name: 'subfolder',
      path: 'docs/subfolder',
      type: 'dir',
      size: 0,
      download_url: null,
    })
  })

  it('throws error on 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    })

    await expect(fetchPublicContents('owner', 'repo', 'missing', 'main', mockFetch))
      .rejects.toThrow('Folder not found')
  })

  it('throws error on rate limit (403 with x-ratelimit-remaining: 0)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1700000000',
      }),
    })

    await expect(fetchPublicContents('owner', 'repo', 'docs', 'main', mockFetch))
      .rejects.toThrow('rate limit reached')
  })

  it('throws error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    await expect(fetchPublicContents('owner', 'repo', 'docs', 'main', mockFetch))
      .rejects.toThrow('Network error')
  })

  it('throws error when API returns a file instead of directory', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'file.md', type: 'file' }),
    })

    await expect(fetchPublicContents('owner', 'repo', 'file.md', 'main', mockFetch))
      .rejects.toThrow('Expected a directory listing')
  })

  it('encodes branch name in query parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await fetchPublicContents('owner', 'repo', 'docs', 'feature/branch', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/contents/docs?ref=feature%2Fbranch',
      expect.any(Object),
    )
  })
})

describe('checkRepoAccess', () => {
  it('returns accessible=true, isPrivate=false for public repos (200)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })

    const result = await checkRepoAccess('owner', 'repo', mockFetch)
    expect(result).toEqual({ accessible: true, isPrivate: false })
  })

  it('returns not_found for 404 responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    })

    const result = await checkRepoAccess('owner', 'repo', mockFetch)
    expect(result).toEqual({
      accessible: false,
      reason: 'not_found',
      message: 'Repository not found or is private.',
    })
  })

  it('returns rate_limited for 403 with exhausted rate limit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({
        'x-ratelimit-remaining': '0',
      }),
    })

    const result = await checkRepoAccess('owner', 'repo', mockFetch)
    expect(result).toEqual({
      accessible: false,
      reason: 'rate_limited',
      message: 'GitHub API rate limit reached. Please try again later or authenticate.',
    })
  })

  it('returns network_error on fetch failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result = await checkRepoAccess('owner', 'repo', mockFetch)
    expect(result).toEqual({
      accessible: false,
      reason: 'network_error',
      message: 'Network error: Connection refused',
    })
  })

  it('returns network_error for unexpected status codes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    })

    const result = await checkRepoAccess('owner', 'repo', mockFetch)
    expect(result).toEqual({
      accessible: false,
      reason: 'network_error',
      message: 'Unexpected response: 500 Internal Server Error',
    })
  })

  it('calls the correct GitHub API URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    await checkRepoAccess('octocat', 'hello-world', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/octocat/hello-world',
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    )
  })
})

describe('fetchFileContent', () => {
  it('fetches raw content from raw.githubusercontent.com', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Hello World\n\nThis is a test.'),
    })

    const result = await fetchFileContent('owner', 'repo', 'docs/README.md', 'main', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/owner/repo/main/docs/README.md',
    )
    expect(result).toBe('# Hello World\n\nThis is a test.')
  })

  it('throws error on 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(fetchFileContent('owner', 'repo', 'missing.md', 'main', mockFetch))
      .rejects.toThrow('File not found')
  })

  it('throws error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'))

    await expect(fetchFileContent('owner', 'repo', 'docs/file.md', 'main', mockFetch))
      .rejects.toThrow('Network error')
  })

  it('throws descriptive error for other HTTP errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    await expect(fetchFileContent('owner', 'repo', 'docs/file.md', 'main', mockFetch))
      .rejects.toThrow('Failed to fetch file content: 500 Internal Server Error')
  })

  it('encodes branch name in the URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('content'),
    })

    await fetchFileContent('owner', 'repo', 'docs/file.md', 'feature/branch', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/owner/repo/feature%2Fbranch/docs/file.md',
    )
  })
})


describe('discoverMarkdownFiles', () => {
  it('discovers markdown files in a flat directory', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([
      { name: 'README.md', path: 'docs/README.md', type: 'file', download_url: null },
      { name: 'index.ts', path: 'docs/index.ts', type: 'file', download_url: null },
      { name: 'guide.MD', path: 'docs/guide.MD', type: 'file', download_url: null },
    ])

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'guide.MD', path: 'docs/guide.MD', type: 'file' })
    expect(result[1]).toEqual({ name: 'README.md', path: 'docs/README.md', type: 'file' })
  })

  it('recursively discovers markdown files in subdirectories', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner, _repo, path) => {
        if (path === 'docs') {
          return Promise.resolve([
            { name: 'README.md', path: 'docs/README.md', type: 'file', download_url: null },
            { name: 'api', path: 'docs/api', type: 'dir' },
          ])
        }
        if (path === 'docs/api') {
          return Promise.resolve([
            { name: 'endpoints.md', path: 'docs/api/endpoints.md', type: 'file', download_url: null },
          ])
        }
        return Promise.resolve([])
      })

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(2)
    // Directories first, then files
    expect(result[0]).toEqual({
      name: 'api',
      path: 'docs/api',
      type: 'directory',
      children: [{ name: 'endpoints.md', path: 'docs/api/endpoints.md', type: 'file' }],
    })
    expect(result[1]).toEqual({ name: 'README.md', path: 'docs/README.md', type: 'file' })
  })

  it('excludes directories that contain no markdown files', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner, _repo, path) => {
        if (path === 'docs') {
          return Promise.resolve([
            { name: 'README.md', path: 'docs/README.md', type: 'file', download_url: null },
            { name: 'images', path: 'docs/images', type: 'dir' },
          ])
        }
        if (path === 'docs/images') {
          return Promise.resolve([
            { name: 'logo.png', path: 'docs/images/logo.png', type: 'file', download_url: null },
          ])
        }
        return Promise.resolve([])
      })

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ name: 'README.md', path: 'docs/README.md', type: 'file' })
  })

  it('respects max depth limit', async () => {
    // Create a deeply nested structure
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner, _repo, path) => {
        // Always return a directory and a markdown file
        return Promise.resolve([
          { name: 'file.md', path: `${path}/file.md`, type: 'file', download_url: null },
          { name: 'deeper', path: `${path}/deeper`, type: 'dir' },
        ])
      })

    await discoverMarkdownFiles('owner', 'repo', 'root', 'main', mockFetchContents, 3)

    // Should call fetchContents for root (depth 0), root/deeper (depth 1), root/deeper/deeper (depth 2)
    // At depth 3, it should stop recursing
    expect(mockFetchContents).toHaveBeenCalledTimes(3)
  })

  it('sorts directories first, then files, both alphabetically', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([
      { name: 'zebra.md', path: 'docs/zebra.md', type: 'file', download_url: null },
      { name: 'beta', path: 'docs/beta', type: 'dir' },
      { name: 'alpha.md', path: 'docs/alpha.md', type: 'file', download_url: null },
      { name: 'alpha', path: 'docs/alpha', type: 'dir' },
    ])
      // Subdirectories contain at least one md file so they're included
      .mockResolvedValueOnce([
        { name: 'zebra.md', path: 'docs/zebra.md', type: 'file', download_url: null },
        { name: 'beta', path: 'docs/beta', type: 'dir' },
        { name: 'alpha.md', path: 'docs/alpha.md', type: 'file', download_url: null },
        { name: 'alpha', path: 'docs/alpha', type: 'dir' },
      ])
      .mockResolvedValueOnce([
        { name: 'note.md', path: 'docs/beta/note.md', type: 'file', download_url: null },
      ])
      .mockResolvedValueOnce([
        { name: 'intro.md', path: 'docs/alpha/intro.md', type: 'file', download_url: null },
      ])

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    // Directories first (alphabetically), then files (alphabetically)
    expect(result[0].name).toBe('alpha')
    expect(result[0].type).toBe('directory')
    expect(result[1].name).toBe('beta')
    expect(result[1].type).toBe('directory')
    expect(result[2].name).toBe('alpha.md')
    expect(result[2].type).toBe('file')
    expect(result[3].name).toBe('zebra.md')
    expect(result[3].type).toBe('file')
  })

  it('handles empty directories gracefully', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([])

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toEqual([])
  })

  it('handles fetch errors for subdirectories gracefully', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner, _repo, path) => {
        if (path === 'docs') {
          return Promise.resolve([
            { name: 'README.md', path: 'docs/README.md', type: 'file', download_url: null },
            { name: 'broken', path: 'docs/broken', type: 'dir' },
          ])
        }
        if (path === 'docs/broken') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve([])
      })

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    // Should still include the root-level md file, skip the broken directory
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ name: 'README.md', path: 'docs/README.md', type: 'file' })
  })

  it('works with default maxDepth of 10', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner, _repo, path) => {
        return Promise.resolve([
          { name: 'file.md', path: `${path}/file.md`, type: 'file', download_url: null },
          { name: 'sub', path: `${path}/sub`, type: 'dir' },
        ])
      })

    await discoverMarkdownFiles('owner', 'repo', 'root', 'main', mockFetchContents)

    // Default maxDepth is 10, so we should have 10 fetches (depths 0 through 9)
    expect(mockFetchContents).toHaveBeenCalledTimes(10)
  })

  it('builds nested tree correctly for deeply nested markdown', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner, _repo, path) => {
        if (path === 'docs') {
          return Promise.resolve([
            { name: 'guides', path: 'docs/guides', type: 'dir' },
          ])
        }
        if (path === 'docs/guides') {
          return Promise.resolve([
            { name: 'setup.md', path: 'docs/guides/setup.md', type: 'file', download_url: null },
            { name: 'advanced', path: 'docs/guides/advanced', type: 'dir' },
          ])
        }
        if (path === 'docs/guides/advanced') {
          return Promise.resolve([
            { name: 'config.md', path: 'docs/guides/advanced/config.md', type: 'file', download_url: null },
          ])
        }
        return Promise.resolve([])
      })

    const result = await discoverMarkdownFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('guides')
    expect(result[0].type).toBe('directory')
    expect(result[0].children).toHaveLength(2)
    // Subdirectory first, then file
    expect(result[0].children![0].name).toBe('advanced')
    expect(result[0].children![0].type).toBe('directory')
    expect(result[0].children![0].children).toHaveLength(1)
    expect(result[0].children![0].children![0].name).toBe('config.md')
    expect(result[0].children![1].name).toBe('setup.md')
    expect(result[0].children![1].type).toBe('file')
  })
})

describe('fetchPrivateContents', () => {
  const backendUrl = 'https://auth.example.com'

  it('fetches directory contents from the proxy endpoint with credentials', async () => {
    const mockItems = [
      { name: 'README.md', path: 'docs/README.md', type: 'file', size: 200, download_url: null },
      { name: 'api', path: 'docs/api', type: 'dir', size: 0, download_url: null },
    ]

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockItems),
    })

    const result = await fetchPrivateContents('owner', 'repo', 'docs', 'main', backendUrl, mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/api/proxy/contents/owner/repo/docs?ref=main',
      {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'README.md',
      path: 'docs/README.md',
      type: 'file',
      size: 200,
      download_url: null,
    })
    expect(result[1]).toEqual({
      name: 'api',
      path: 'docs/api',
      type: 'dir',
      size: 0,
      download_url: null,
    })
  })

  it('throws SessionExpiredError on 401 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    await expect(fetchPrivateContents('owner', 'repo', 'docs', 'main', backendUrl, mockFetch))
      .rejects.toThrow(SessionExpiredError)
  })

  it('throws InstallationAccessError on 403 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })

    await expect(fetchPrivateContents('owner', 'repo', 'docs', 'main', backendUrl, mockFetch))
      .rejects.toThrow(InstallationAccessError)
  })

  it('throws error on 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(fetchPrivateContents('owner', 'repo', 'missing', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Folder not found')
  })

  it('throws error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    await expect(fetchPrivateContents('owner', 'repo', 'docs', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Network error while fetching private contents')
  })

  it('throws error when backend URL is not configured', async () => {
    const mockFetch = vi.fn()

    await expect(fetchPrivateContents('owner', 'repo', 'docs', 'main', null, mockFetch))
      .rejects.toThrow('Auth backend URL is not configured')
  })

  it('throws error when API returns a file instead of directory', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: 'file.md', type: 'file' }),
    })

    await expect(fetchPrivateContents('owner', 'repo', 'file.md', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Expected a directory listing')
  })

  it('encodes owner, repo, and branch in the URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await fetchPrivateContents('my-org', 'my-repo', 'docs/api', 'feature/branch', backendUrl, mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/api/proxy/contents/my-org/my-repo/docs/api?ref=feature%2Fbranch',
      expect.any(Object),
    )
  })

  it('throws descriptive error for other HTTP errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    await expect(fetchPrivateContents('owner', 'repo', 'docs', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Proxy API error: 500 Internal Server Error')
  })
})

describe('fetchPrivateFileContent', () => {
  const backendUrl = 'https://auth.example.com'

  it('fetches raw file content from the proxy endpoint with credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Private Doc\n\nSecret content.'),
    })

    const result = await fetchPrivateFileContent('owner', 'repo', 'docs/secret.md', 'main', backendUrl, mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/api/proxy/raw/owner/repo/docs/secret.md?ref=main',
      { credentials: 'include' },
    )
    expect(result).toBe('# Private Doc\n\nSecret content.')
  })

  it('throws SessionExpiredError on 401 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    await expect(fetchPrivateFileContent('owner', 'repo', 'docs/file.md', 'main', backendUrl, mockFetch))
      .rejects.toThrow(SessionExpiredError)
  })

  it('throws InstallationAccessError on 403 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })

    await expect(fetchPrivateFileContent('owner', 'repo', 'docs/file.md', 'main', backendUrl, mockFetch))
      .rejects.toThrow(InstallationAccessError)
  })

  it('throws error on 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(fetchPrivateFileContent('owner', 'repo', 'missing.md', 'main', backendUrl, mockFetch))
      .rejects.toThrow('File not found')
  })

  it('throws error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Timeout'))

    await expect(fetchPrivateFileContent('owner', 'repo', 'docs/file.md', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Network error while fetching private file')
  })

  it('throws error when backend URL is not configured', async () => {
    const mockFetch = vi.fn()

    await expect(fetchPrivateFileContent('owner', 'repo', 'docs/file.md', 'main', null, mockFetch))
      .rejects.toThrow('Auth backend URL is not configured')
  })

  it('encodes owner, repo, and branch in the URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('content'),
    })

    await fetchPrivateFileContent('my-org', 'my-repo', 'docs/file.md', 'release/v2', backendUrl, mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/api/proxy/raw/my-org/my-repo/docs/file.md?ref=release%2Fv2',
      expect.any(Object),
    )
  })

  it('throws descriptive error for other HTTP errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    })

    await expect(fetchPrivateFileContent('owner', 'repo', 'docs/file.md', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Proxy API error: 502 Bad Gateway')
  })
})


describe('fetchPdfContent', () => {
  it('fetches raw binary content from raw.githubusercontent.com', async () => {
    const mockArrayBuffer = new ArrayBuffer(8)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    })

    const result = await fetchPdfContent('owner', 'repo', 'docs/file.pdf', 'main', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/owner/repo/main/docs/file.pdf',
    )
    expect(result).toBe(mockArrayBuffer)
  })

  it('returns ArrayBuffer response type', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(pdfBytes),
    })

    const result = await fetchPdfContent('owner', 'repo', 'file.pdf', 'main', mockFetch)

    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result.byteLength).toBe(4)
  })

  it('throws error on 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(fetchPdfContent('owner', 'repo', 'missing.pdf', 'main', mockFetch))
      .rejects.toThrow('File not found')
  })

  it('throws error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'))

    await expect(fetchPdfContent('owner', 'repo', 'docs/file.pdf', 'main', mockFetch))
      .rejects.toThrow('Network error while fetching PDF file')
  })

  it('throws descriptive error for other HTTP errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    await expect(fetchPdfContent('owner', 'repo', 'docs/file.pdf', 'main', mockFetch))
      .rejects.toThrow('Failed to fetch PDF content: 500 Internal Server Error')
  })

  it('encodes branch name in the URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })

    await fetchPdfContent('owner', 'repo', 'docs/file.pdf', 'feature/branch', mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/owner/repo/feature%2Fbranch/docs/file.pdf',
    )
  })
})

describe('fetchPrivatePdfContent', () => {
  const backendUrl = 'https://auth.example.com'

  it('fetches raw binary content from the proxy endpoint with credentials', async () => {
    const mockArrayBuffer = new ArrayBuffer(16)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    })

    const result = await fetchPrivatePdfContent('owner', 'repo', 'docs/secret.pdf', 'main', backendUrl, mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/api/proxy/raw/owner/repo/docs/secret.pdf?ref=main',
      { credentials: 'include' },
    )
    expect(result).toBe(mockArrayBuffer)
  })

  it('returns ArrayBuffer response type', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]).buffer
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(pdfBytes),
    })

    const result = await fetchPrivatePdfContent('owner', 'repo', 'file.pdf', 'main', backendUrl, mockFetch)

    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result.byteLength).toBe(5)
  })

  it('throws SessionExpiredError on 401 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    await expect(fetchPrivatePdfContent('owner', 'repo', 'docs/file.pdf', 'main', backendUrl, mockFetch))
      .rejects.toThrow(SessionExpiredError)
  })

  it('throws InstallationAccessError on 403 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    })

    await expect(fetchPrivatePdfContent('owner', 'repo', 'docs/file.pdf', 'main', backendUrl, mockFetch))
      .rejects.toThrow(InstallationAccessError)
  })

  it('throws error on 404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(fetchPrivatePdfContent('owner', 'repo', 'missing.pdf', 'main', backendUrl, mockFetch))
      .rejects.toThrow('File not found')
  })

  it('throws error on network failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Timeout'))

    await expect(fetchPrivatePdfContent('owner', 'repo', 'docs/file.pdf', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Network error while fetching private PDF file')
  })

  it('throws error when backend URL is not configured', async () => {
    const mockFetch = vi.fn()

    await expect(fetchPrivatePdfContent('owner', 'repo', 'docs/file.pdf', 'main', null, mockFetch))
      .rejects.toThrow('Auth backend URL is not configured')
  })

  it('encodes owner, repo, and branch in the URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })

    await fetchPrivatePdfContent('my-org', 'my-repo', 'docs/file.pdf', 'release/v2', backendUrl, mockFetch)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/api/proxy/raw/my-org/my-repo/docs/file.pdf?ref=release%2Fv2',
      expect.any(Object),
    )
  })

  it('throws descriptive error for other HTTP errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    })

    await expect(fetchPrivatePdfContent('owner', 'repo', 'docs/file.pdf', 'main', backendUrl, mockFetch))
      .rejects.toThrow('Proxy API error: 502 Bad Gateway')
  })
})

describe('discoverSupportedFiles', () => {
  it('discovers both markdown and PDF files in a flat directory', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([
      { name: 'README.md', path: 'docs/README.md', type: 'file', download_url: null },
      { name: 'index.ts', path: 'docs/index.ts', type: 'file', download_url: null },
      { name: 'report.pdf', path: 'docs/report.pdf', type: 'file', download_url: null },
      { name: 'guide.MD', path: 'docs/guide.MD', type: 'file', download_url: null },
    ])

    const result = await discoverSupportedFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(3)
    // Sorted alphabetically: guide.MD, README.md, report.pdf
    expect(result[0]).toEqual({ name: 'guide.MD', path: 'docs/guide.MD', type: 'file', fileType: 'markdown' })
    expect(result[1]).toEqual({ name: 'README.md', path: 'docs/README.md', type: 'file', fileType: 'markdown' })
    expect(result[2]).toEqual({ name: 'report.pdf', path: 'docs/report.pdf', type: 'file', fileType: 'pdf' })
  })

  it('includes directories that contain only PDF files', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner: string, _repo: string, path: string) => {
        if (path === 'docs') {
          return Promise.resolve([
            { name: 'pdfs', path: 'docs/pdfs', type: 'dir' },
          ])
        }
        if (path === 'docs/pdfs') {
          return Promise.resolve([
            { name: 'manual.pdf', path: 'docs/pdfs/manual.pdf', type: 'file', download_url: null },
          ])
        }
        return Promise.resolve([])
      })

    const result = await discoverSupportedFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'pdfs',
      path: 'docs/pdfs',
      type: 'directory',
      children: [{ name: 'manual.pdf', path: 'docs/pdfs/manual.pdf', type: 'file', fileType: 'pdf' }],
    })
  })

  it('sets fileType correctly based on extension', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([
      { name: 'notes.md', path: 'notes.md', type: 'file', download_url: null },
      { name: 'REPORT.PDF', path: 'REPORT.PDF', type: 'file', download_url: null },
      { name: 'slides.Pdf', path: 'slides.Pdf', type: 'file', download_url: null },
    ])

    const result = await discoverSupportedFiles('owner', 'repo', '', 'main', mockFetchContents)

    expect(result).toHaveLength(3)
    expect(result[0].fileType).toBe('markdown')
    expect(result[1].fileType).toBe('pdf')
    expect(result[2].fileType).toBe('pdf')
  })

  it('excludes unsupported file types', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([
      { name: 'image.png', path: 'image.png', type: 'file', download_url: null },
      { name: 'script.js', path: 'script.js', type: 'file', download_url: null },
      { name: 'data.json', path: 'data.json', type: 'file', download_url: null },
    ])

    const result = await discoverSupportedFiles('owner', 'repo', '', 'main', mockFetchContents)

    expect(result).toEqual([])
  })

  it('respects max depth limit of 10 levels', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner: string, _repo: string, path: string) => {
        return Promise.resolve([
          { name: 'file.pdf', path: `${path}/file.pdf`, type: 'file', download_url: null },
          { name: 'deeper', path: `${path}/deeper`, type: 'dir' },
        ])
      })

    await discoverSupportedFiles('owner', 'repo', 'root', 'main', mockFetchContents)

    // Default maxDepth is 10, so we should have 10 fetches (depths 0 through 9)
    expect(mockFetchContents).toHaveBeenCalledTimes(10)
  })

  it('respects custom max depth limit', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner: string, _repo: string, path: string) => {
        return Promise.resolve([
          { name: 'doc.pdf', path: `${path}/doc.pdf`, type: 'file', download_url: null },
          { name: 'sub', path: `${path}/sub`, type: 'dir' },
        ])
      })

    await discoverSupportedFiles('owner', 'repo', 'root', 'main', mockFetchContents, 3)

    expect(mockFetchContents).toHaveBeenCalledTimes(3)
  })

  it('sorts directories first, then files alphabetically', async () => {
    const mockFetchContents = vi.fn()
      .mockResolvedValueOnce([
        { name: 'zebra.pdf', path: 'docs/zebra.pdf', type: 'file', download_url: null },
        { name: 'beta', path: 'docs/beta', type: 'dir' },
        { name: 'alpha.md', path: 'docs/alpha.md', type: 'file', download_url: null },
        { name: 'alpha', path: 'docs/alpha', type: 'dir' },
      ])
      .mockResolvedValueOnce([
        { name: 'note.pdf', path: 'docs/beta/note.pdf', type: 'file', download_url: null },
      ])
      .mockResolvedValueOnce([
        { name: 'intro.md', path: 'docs/alpha/intro.md', type: 'file', download_url: null },
      ])

    const result = await discoverSupportedFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    // Directories first (alphabetically), then files (alphabetically)
    expect(result[0].name).toBe('alpha')
    expect(result[0].type).toBe('directory')
    expect(result[1].name).toBe('beta')
    expect(result[1].type).toBe('directory')
    expect(result[2].name).toBe('alpha.md')
    expect(result[2].type).toBe('file')
    expect(result[3].name).toBe('zebra.pdf')
    expect(result[3].type).toBe('file')
  })

  it('excludes directories with no supported files', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner: string, _repo: string, path: string) => {
        if (path === 'root') {
          return Promise.resolve([
            { name: 'readme.md', path: 'root/readme.md', type: 'file', download_url: null },
            { name: 'images', path: 'root/images', type: 'dir' },
          ])
        }
        if (path === 'root/images') {
          return Promise.resolve([
            { name: 'logo.png', path: 'root/images/logo.png', type: 'file', download_url: null },
          ])
        }
        return Promise.resolve([])
      })

    const result = await discoverSupportedFiles('owner', 'repo', 'root', 'main', mockFetchContents)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ name: 'readme.md', path: 'root/readme.md', type: 'file', fileType: 'markdown' })
  })

  it('handles fetch errors for subdirectories gracefully', async () => {
    const mockFetchContents = vi.fn()
      .mockImplementation((_owner: string, _repo: string, path: string) => {
        if (path === 'docs') {
          return Promise.resolve([
            { name: 'report.pdf', path: 'docs/report.pdf', type: 'file', download_url: null },
            { name: 'broken', path: 'docs/broken', type: 'dir' },
          ])
        }
        if (path === 'docs/broken') {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve([])
      })

    const result = await discoverSupportedFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ name: 'report.pdf', path: 'docs/report.pdf', type: 'file', fileType: 'pdf' })
  })

  it('handles empty directories gracefully', async () => {
    const mockFetchContents = vi.fn().mockResolvedValue([])

    const result = await discoverSupportedFiles('owner', 'repo', 'docs', 'main', mockFetchContents)

    expect(result).toEqual([])
  })
})
