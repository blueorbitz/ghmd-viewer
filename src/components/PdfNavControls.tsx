import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

export interface PdfNavControlsProps {
  currentPage: number
  totalPages: number
  zoomLevel: number // percentage, 50–200
  onPreviousPage: () => void
  onNextPage: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

export function PdfNavControls({
  currentPage,
  totalPages,
  zoomLevel,
  onPreviousPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
}: PdfNavControlsProps) {
  const isPreviousDisabled = currentPage === 1
  const isNextDisabled = currentPage === totalPages
  const isZoomInDisabled = zoomLevel >= 200
  const isZoomOutDisabled = zoomLevel <= 50

  return (
    <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={isPreviousDisabled ? undefined : onPreviousPage}
          aria-label="Previous page"
          aria-disabled={isPreviousDisabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="text-sm text-foreground min-w-[4rem] text-center">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={isNextDisabled ? undefined : onNextPage}
          aria-label="Next page"
          aria-disabled={isNextDisabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={isZoomOutDisabled ? undefined : onZoomOut}
          aria-label="Zoom out"
          aria-disabled={isZoomOutDisabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="text-sm text-foreground min-w-[3rem] text-center">
          {zoomLevel}%
        </span>

        <button
          type="button"
          onClick={isZoomInDisabled ? undefined : onZoomIn}
          aria-label="Zoom in"
          aria-disabled={isZoomInDisabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
