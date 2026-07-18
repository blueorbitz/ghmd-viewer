export type SupportedFileType = 'markdown' | 'pdf' | 'unsupported'

/** Get the file extension (lowercase, without dot) */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return ''
  }
  return filename.slice(lastDotIndex + 1).toLowerCase()
}

/** Determine file type from filename extension */
export function getFileType(filename: string): SupportedFileType {
  const ext = getFileExtension(filename)
  if (ext === 'pdf') return 'pdf'
  if (ext === 'md') return 'markdown'
  return 'unsupported'
}

/** Check if a filename has a PDF extension (case-insensitive) */
export function isPdfFile(filename: string): boolean {
  return getFileExtension(filename) === 'pdf'
}

/** Check if a filename is a supported viewable file */
export function isSupportedFile(filename: string): boolean {
  return getFileType(filename) !== 'unsupported'
}
