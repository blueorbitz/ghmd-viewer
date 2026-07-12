import { describe, it, expect } from 'vitest'
import {
  isExternalLink,
  isRelativeMarkdownLink,
  resolveRelativePath,
} from '@/services/link-resolver'

describe('link-resolver', () => {
  describe('isExternalLink', () => {
    it('returns true for http:// URLs', () => {
      expect(isExternalLink('http://example.com')).toBe(true)
    })

    it('returns true for https:// URLs', () => {
      expect(isExternalLink('https://github.com/user/repo')).toBe(true)
    })

    it('returns true for HTTP:// (case-insensitive)', () => {
      expect(isExternalLink('HTTP://EXAMPLE.COM')).toBe(true)
    })

    it('returns false for relative paths', () => {
      expect(isExternalLink('./readme.md')).toBe(false)
      expect(isExternalLink('../guide.md')).toBe(false)
      expect(isExternalLink('docs/intro.md')).toBe(false)
    })

    it('returns false for anchor-only links', () => {
      expect(isExternalLink('#section')).toBe(false)
    })

    it('returns false for protocol-relative URLs', () => {
      expect(isExternalLink('//example.com/path')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isExternalLink('')).toBe(false)
    })
  })

  describe('isRelativeMarkdownLink', () => {
    it('returns true for simple .md filename', () => {
      expect(isRelativeMarkdownLink('readme.md')).toBe(true)
    })

    it('returns true for relative path with .md extension', () => {
      expect(isRelativeMarkdownLink('./intro.md')).toBe(true)
      expect(isRelativeMarkdownLink('../guide.md')).toBe(true)
      expect(isRelativeMarkdownLink('docs/setup.md')).toBe(true)
    })

    it('returns true for .MD (case-insensitive)', () => {
      expect(isRelativeMarkdownLink('README.MD')).toBe(true)
      expect(isRelativeMarkdownLink('guide.Md')).toBe(true)
    })

    it('returns true for .md links with hash fragments', () => {
      expect(isRelativeMarkdownLink('readme.md#section')).toBe(true)
    })

    it('returns true for .md links with query strings', () => {
      expect(isRelativeMarkdownLink('readme.md?v=1')).toBe(true)
    })

    it('returns false for external URLs ending in .md', () => {
      expect(isRelativeMarkdownLink('https://example.com/file.md')).toBe(false)
    })

    it('returns false for non-.md relative paths', () => {
      expect(isRelativeMarkdownLink('./image.png')).toBe(false)
      expect(isRelativeMarkdownLink('script.js')).toBe(false)
      expect(isRelativeMarkdownLink('docs/index.html')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isRelativeMarkdownLink('')).toBe(false)
    })

    it('returns false for protocol-relative URLs', () => {
      expect(isRelativeMarkdownLink('//example.com/doc.md')).toBe(false)
    })
  })

  describe('resolveRelativePath', () => {
    it('resolves a simple filename against a base path', () => {
      expect(resolveRelativePath('docs/guides', 'intro.md')).toBe('docs/guides/intro.md')
    })

    it('resolves ./ relative path', () => {
      expect(resolveRelativePath('docs/guides', './setup.md')).toBe('docs/guides/setup.md')
    })

    it('resolves ../ to parent directory', () => {
      expect(resolveRelativePath('docs/guides', '../readme.md')).toBe('docs/readme.md')
    })

    it('resolves multiple ../ levels', () => {
      expect(resolveRelativePath('docs/guides/advanced', '../../intro.md')).toBe('docs/intro.md')
    })

    it('resolves nested relative paths', () => {
      expect(resolveRelativePath('docs', 'guides/setup.md')).toBe('docs/guides/setup.md')
    })

    it('handles basePath with trailing slash', () => {
      expect(resolveRelativePath('docs/guides/', 'intro.md')).toBe('docs/guides/intro.md')
    })

    it('handles empty basePath', () => {
      expect(resolveRelativePath('', 'readme.md')).toBe('readme.md')
    })

    it('strips hash fragments from href during resolution', () => {
      expect(resolveRelativePath('docs', 'guide.md#section')).toBe('docs/guide.md')
    })

    it('strips query strings from href during resolution', () => {
      expect(resolveRelativePath('docs', 'guide.md?v=1')).toBe('docs/guide.md')
    })

    it('resolves ../ that goes beyond root to empty base', () => {
      expect(resolveRelativePath('docs', '../../other.md')).toBe('other.md')
    })
  })
})
