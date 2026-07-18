import '@/config/pdf-worker'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PdfNavControls } from './PdfNavControls'

export interface PdfViewerProps {
  /** PDF binary data as Uint8Array */
  data: Uint8Array
  /** Filename for accessibility labels and fallback download */
  filename: string
  /** Raw download URL for fallback link */
  downloadUrl: string
}

export interface PdfNavControlsProps {
  currentPage: number
  totalPages: number
  zoomLevel: number
  onPreviousPage: () => void
  onNextPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

interface PdfViewerState {
  numPages: number | null
  currentPage: number
  zoomLevel: number
  error: string | null
  isLoaded: boolean
}

const ZOOM_MIN = 50
const ZOOM_MAX = 200
const ZOOM_STEP = 25
const ZOOM_DEFAULT = 100
const PDF_LOAD_TIMEOUT_MS = 30_000

/**
 * PdfViewer — Renders PDF content inline using react-pdf.
 * Displays all pages vertically with zoom and responsive scaling.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.5, 6.1, 6.4, 6.5
 */
export function PdfViewer({ data, filename, downloadUrl }: PdfViewerProps) {
  const [state, setState] = useState<PdfViewerState>({
    numPages: null,
    currentPage: 1,
    zoomLevel: ZOOM_DEFAULT,
    error: null,
    isLoaded: false,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map())

  // Measure container width
  const measureWidth = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth
      // Account for padding (32px total: 16px each side)
      setContainerWidth(Math.max(width - 32, 200))
    }
  }, [])

  // Listen for window resize
  useEffect(() => {
    measureWidth()

    const handleResize = () => measureWidth()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureWidth])

  // Use ResizeObserver for sidebar toggle and other layout changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      measureWidth()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [measureWidth])

  // Loading timeout with AbortController
  useEffect(() => {
    if (state.isLoaded || state.error) return

    abortControllerRef.current = new AbortController()

    timeoutRef.current = setTimeout(() => {
      if (!state.isLoaded) {
        setState((prev) => ({
          ...prev,
          error: 'PDF loading timed out after 30 seconds.',
          isLoaded: false,
        }))
        abortControllerRef.current?.abort()
      }
    }, PDF_LOAD_TIMEOUT_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [state.isLoaded, state.error])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setState((prev) => ({
        ...prev,
        numPages,
        isLoaded: true,
        error: numPages === 0 ? 'PDF contains no pages.' : null,
      }))
    },
    [],
  )

  const onDocumentLoadError = useCallback((error: Error) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setState((prev) => ({
      ...prev,
      error: `Failed to render PDF: ${error.message}`,
      isLoaded: false,
    }))
  }, [])

  // Zoom handlers (used by PdfNavControls in task 4.2)
  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoomLevel: Math.min(prev.zoomLevel + ZOOM_STEP, ZOOM_MAX),
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoomLevel: Math.max(prev.zoomLevel - ZOOM_STEP, ZOOM_MIN),
    }))
  }, [])

  // Scroll a page element into view
  const scrollToPage = useCallback((pageNumber: number) => {
    const pageElement = pageRefsMap.current.get(pageNumber)
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Page navigation handlers
  const previousPage = useCallback(() => {
    setState((prev) => {
      const newPage = Math.max(prev.currentPage - 1, 1)
      // Use setTimeout to scroll after state update
      setTimeout(() => scrollToPage(newPage), 0)
      return { ...prev, currentPage: newPage }
    })
  }, [scrollToPage])

  const nextPage = useCallback(() => {
    setState((prev) => {
      const newPage = Math.min(prev.currentPage + 1, prev.numPages ?? 1)
      setTimeout(() => scrollToPage(newPage), 0)
      return { ...prev, currentPage: newPage }
    })
  }, [scrollToPage])

  // Ref callback for page elements
  const setPageRef = useCallback(
    (pageNumber: number) => (el: HTMLDivElement | null) => {
      if (el) {
        pageRefsMap.current.set(pageNumber, el)
      } else {
        pageRefsMap.current.delete(pageNumber)
      }
    },
    [],
  )

  // IntersectionObserver for scroll-based page tracking
  useEffect(() => {
    if (!state.isLoaded || !state.numPages || !containerRef.current) return

    const container = containerRef.current
    const thresholds = [0, 0.25, 0.5, 0.75, 1]

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        let maxRatio = 0
        let maxPage = -1

        // Check all currently observed elements (not just changed entries)
        // by iterating all page refs and checking their current ratio via entries
        const ratioMap = new Map<number, number>()

        // First fill in current known ratios from entries
        for (const entry of entries) {
          const pageAttr = entry.target.getAttribute('data-page-number')
          if (pageAttr) {
            const pageNum = parseInt(pageAttr, 10)
            ratioMap.set(pageNum, entry.intersectionRatio)
          }
        }

        // Determine which has the highest ratio from this batch
        for (const [pageNum, ratio] of ratioMap) {
          if (ratio > maxRatio) {
            maxRatio = ratio
            maxPage = pageNum
          }
        }

        if (maxPage > 0 && maxRatio > 0) {
          setState((prev) => {
            if (prev.currentPage === maxPage) return prev
            return { ...prev, currentPage: maxPage }
          })
        }
      },
      {
        root: container,
        threshold: thresholds,
      },
    )

    // Observe all page elements
    for (const [, element] of pageRefsMap.current) {
      observer.observe(element)
    }

    return () => {
      observer.disconnect()
    }
  }, [state.isLoaded, state.numPages])

  // Calculate page width based on container width and zoom level
  const pageWidth = containerWidth * (state.zoomLevel / 100)

  // Memoize file data to prevent react-pdf from re-transferring the ArrayBuffer
  // on re-renders. We copy the buffer so the original Uint8Array remains valid
  // after the worker detaches the transferred buffer.
  const fileData = useMemo(() => ({ data: data.slice().buffer }), [data])

  // Error state with fallback download link
  if (state.error) {
    return (
      <div
        ref={containerRef}
        className="flex flex-col items-center justify-center p-8"
        role="document"
        aria-label={`PDF viewer: ${filename}`}
      >
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-sm text-destructive">
          <p className="font-medium">Unable to display PDF</p>
          <p className="mt-2">{state.error}</p>
          <a
            href={downloadUrl}
            download={filename}
            className="mt-4 inline-block rounded-md border border-current px-4 py-2 text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            Download {filename}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-auto"
      role="document"
      aria-label={`PDF viewer: ${filename}`}
    >
      {/* Navigation controls */}
      {state.isLoaded && state.numPages && (
        <PdfNavControls
          currentPage={state.currentPage}
          totalPages={state.numPages}
          zoomLevel={state.zoomLevel}
          onPreviousPage={previousPage}
          onNextPage={nextPage}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
        />
      )}

      <div className="flex flex-col items-center p-4">
        <Document
          file={fileData}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              Loading PDF…
            </div>
          }
        >
          {state.numPages &&
            Array.from({ length: state.numPages }, (_, index) => (
              <div
                key={`page-${index + 1}`}
                ref={setPageRef(index + 1)}
                data-page-number={index + 1}
                className="mb-4 shadow-md"
              >
                <Page
                  pageNumber={index + 1}
                  width={pageWidth || undefined}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
        </Document>
      </div>

      {/* ARIA live region for page changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.isLoaded && state.numPages
          ? `Page ${state.currentPage} of ${state.numPages}`
          : ''}
      </div>
    </div>
  )
}

// Export constants and types for use by PdfNavControls (task 4.2)
export { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_DEFAULT, PDF_LOAD_TIMEOUT_MS }
export type { PdfViewerState }
