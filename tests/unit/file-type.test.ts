import { describe, it, expect } from 'vitest'
import {
  getFileExtension,
  getFileType,
  isPdfFile,
  isSupportedFile,
} from '@/lib/file-type'

describe('getFileExtension', () => {
  it('returns lowercase extension without dot', () => {
    expect(getFileExtension('document.pdf')).toBe('pdf')
  })

  it('handles uppercase extensions', () => {
    expect(getFileExtension('README.MD')).toBe('md')
  })

  it('handles mixed case extensions', () => {
    expect(getFileExtension('report.Pdf')).toBe('pdf')
  })

  it('returns extension after the last dot', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('returns empty string for files without extension', () => {
    expect(getFileExtension('Makefile')).toBe('')
  })

  it('returns empty string for files ending with a dot', () => {
    expect(getFileExtension('file.')).toBe('')
  })

  it('handles filenames with path separators', () => {
    expect(getFileExtension('path/to/file.pdf')).toBe('pdf')
  })

  it('returns empty string for empty string input', () => {
    expect(getFileExtension('')).toBe('')
  })
})

describe('getFileType', () => {
  it('returns pdf for .pdf extension', () => {
    expect(getFileType('document.pdf')).toBe('pdf')
  })

  it('returns pdf for .PDF extension (case-insensitive)', () => {
    expect(getFileType('DOCUMENT.PDF')).toBe('pdf')
  })

  it('returns markdown for .md extension', () => {
    expect(getFileType('README.md')).toBe('markdown')
  })

  it('returns markdown for .MD extension (case-insensitive)', () => {
    expect(getFileType('NOTES.MD')).toBe('markdown')
  })

  it('returns unsupported for unknown extensions', () => {
    expect(getFileType('image.png')).toBe('unsupported')
  })

  it('returns unsupported for files without extension', () => {
    expect(getFileType('Makefile')).toBe('unsupported')
  })

  it('returns unsupported for empty string', () => {
    expect(getFileType('')).toBe('unsupported')
  })
})

describe('isPdfFile', () => {
  it('returns true for .pdf files', () => {
    expect(isPdfFile('document.pdf')).toBe(true)
  })

  it('returns true for .PDF files (case-insensitive)', () => {
    expect(isPdfFile('REPORT.PDF')).toBe(true)
  })

  it('returns false for .md files', () => {
    expect(isPdfFile('README.md')).toBe(false)
  })

  it('returns false for files without extension', () => {
    expect(isPdfFile('Makefile')).toBe(false)
  })
})

describe('isSupportedFile', () => {
  it('returns true for .pdf files', () => {
    expect(isSupportedFile('document.pdf')).toBe(true)
  })

  it('returns true for .md files', () => {
    expect(isSupportedFile('README.md')).toBe(true)
  })

  it('returns true regardless of case', () => {
    expect(isSupportedFile('NOTES.MD')).toBe(true)
    expect(isSupportedFile('REPORT.PDF')).toBe(true)
  })

  it('returns false for unsupported extensions', () => {
    expect(isSupportedFile('image.png')).toBe(false)
  })

  it('returns false for files without extension', () => {
    expect(isSupportedFile('Makefile')).toBe(false)
  })
})
