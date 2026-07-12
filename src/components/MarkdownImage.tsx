import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveImageUrl } from '@/services/image-resolver'

const IMAGE_LOAD_TIMEOUT_MS = 10_000

interface MarkdownImageProps {
  src?: string
  alt?: string
  basePath: string
  owner: string
  repo: string
  branch: string
  isPrivate: boolean
  backendUrl?: string
  onAuthError?: () => void
}

type ImageState = 'loading' | 'loaded' | 'error'

/**
 * MarkdownImage — Custom image component for Markdown rendering.
 *
 * Resolves relative image paths, handles loading timeouts (10s),
 * displays placeholders on failure, and handles 401 errors from
 * the Auth_Backend proxy.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export function MarkdownImage({
  src,
  alt,
  basePath,
  owner,
  repo,
  branch,
  isPrivate,
  backendUrl,
  onAuthError,
}: MarkdownImageProps) {
  const [imageState, setImageState] = useState<ImageState>('loading')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Resolve the image URL
  const resolvedSrc = src
    ? resolveImageUrl(src, basePath, owner, repo, branch, isPrivate, backendUrl)
    : undefined

  // Clear timeout on unmount or src change
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [resolvedSrc])

  // Start the 10s loading timeout when the resolved src is set
  useEffect(() => {
    if (!resolvedSrc) {
      setImageState('error')
      return
    }

    setImageState('loading')

    timeoutRef.current = setTimeout(() => {
      // If still loading after 10s, show placeholder
      setImageState((current) => (current === 'loading' ? 'error' : current))
    }, IMAGE_LOAD_TIMEOUT_MS)

    // For private repo images, do a pre-flight fetch to detect 401
    if (isPrivate && backendUrl) {
      prefetchWithAuthCheck(resolvedSrc, onAuthError, () => {
        setImageState('error')
      })
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [resolvedSrc, isPrivate, backendUrl, onAuthError])

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setImageState('loaded')
  }, [])

  const handleError = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setImageState('error')
  }, [])

  // If no src, show placeholder immediately
  if (!resolvedSrc) {
    return <ImagePlaceholder alt={alt} />
  }

  // Show placeholder on error or timeout
  if (imageState === 'error') {
    return <ImagePlaceholder alt={alt} />
  }

  return (
    <>
      {imageState === 'loading' && (
        <span
          className="inline-block animate-pulse rounded bg-muted h-32 w-48"
          aria-label={alt || 'Loading image'}
        />
      )}
      <img
        ref={imgRef}
        src={resolvedSrc}
        alt={alt || ''}
        onLoad={handleLoad}
        onError={handleError}
        className={imageState === 'loaded' ? 'max-w-full h-auto' : 'hidden'}
        crossOrigin={isPrivate ? 'use-credentials' : undefined}
      />
    </>
  )
}

/**
 * Placeholder shown when an image fails to load or times out.
 * Displays alt text if available, otherwise a generic "broken image" message.
 *
 * Requirements: 9.3, 9.4
 */
function ImagePlaceholder({ alt }: { alt?: string }) {
  const displayText = alt && alt.trim().length > 0
    ? alt
    : 'Image could not be loaded'

  return (
    <span
      className="inline-flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
      role="img"
      aria-label={displayText}
    >
      <BrokenImageIcon />
      <span>{displayText}</span>
    </span>
  )
}

/**
 * Simple broken image SVG icon.
 */
function BrokenImageIcon() {
  return (
    <svg
      className="h-4 w-4 text-muted-foreground/70"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="3" x2="21" y2="21" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  )
}

/**
 * Pre-flight fetch for private repo images to detect 401 errors.
 * If a 401 is received, triggers the re-auth prompt.
 */
async function prefetchWithAuthCheck(
  url: string,
  onAuthError?: () => void,
  onError?: () => void,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      credentials: 'include',
    })

    if (response.status === 401) {
      onError?.()
      onAuthError?.()
    } else if (!response.ok) {
      onError?.()
    }
  } catch {
    // Network errors will be caught by the img onError handler
  }
}
