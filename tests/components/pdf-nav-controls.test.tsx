import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PdfNavControls } from '@/components/PdfNavControls'

const defaultProps = {
  currentPage: 3,
  totalPages: 10,
  zoomLevel: 100,
  onPreviousPage: vi.fn(),
  onNextPage: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
}

function renderControls(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<PdfNavControls {...props} />)
}

describe('PdfNavControls', () => {
  describe('Page indicator', () => {
    it('displays current / total format', () => {
      renderControls({ currentPage: 1, totalPages: 5 })
      expect(screen.getByText('1 / 5')).toBeInTheDocument()
    })

    it('displays updated page numbers', () => {
      renderControls({ currentPage: 7, totalPages: 12 })
      expect(screen.getByText('7 / 12')).toBeInTheDocument()
    })
  })

  describe('Previous page button', () => {
    it('has correct aria-label', () => {
      renderControls()
      expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
    })

    it('calls onPreviousPage when clicked', async () => {
      const onPreviousPage = vi.fn()
      const user = userEvent.setup()
      renderControls({ currentPage: 3, onPreviousPage })

      await user.click(screen.getByLabelText('Previous page'))
      expect(onPreviousPage).toHaveBeenCalledTimes(1)
    })

    it('is disabled on first page with aria-disabled', () => {
      renderControls({ currentPage: 1 })
      const btn = screen.getByLabelText('Previous page')
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not call onPreviousPage when disabled', async () => {
      const onPreviousPage = vi.fn()
      const user = userEvent.setup()
      renderControls({ currentPage: 1, onPreviousPage })

      await user.click(screen.getByLabelText('Previous page'))
      expect(onPreviousPage).not.toHaveBeenCalled()
    })

    it('is not disabled on pages other than first', () => {
      renderControls({ currentPage: 2 })
      const btn = screen.getByLabelText('Previous page')
      expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Next page button', () => {
    it('has correct aria-label', () => {
      renderControls()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    })

    it('calls onNextPage when clicked', async () => {
      const onNextPage = vi.fn()
      const user = userEvent.setup()
      renderControls({ currentPage: 3, totalPages: 10, onNextPage })

      await user.click(screen.getByLabelText('Next page'))
      expect(onNextPage).toHaveBeenCalledTimes(1)
    })

    it('is disabled on last page with aria-disabled', () => {
      renderControls({ currentPage: 10, totalPages: 10 })
      const btn = screen.getByLabelText('Next page')
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not call onNextPage when disabled', async () => {
      const onNextPage = vi.fn()
      const user = userEvent.setup()
      renderControls({ currentPage: 10, totalPages: 10, onNextPage })

      await user.click(screen.getByLabelText('Next page'))
      expect(onNextPage).not.toHaveBeenCalled()
    })

    it('is not disabled on pages other than last', () => {
      renderControls({ currentPage: 9, totalPages: 10 })
      const btn = screen.getByLabelText('Next page')
      expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Zoom in button', () => {
    it('has correct aria-label', () => {
      renderControls()
      expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
    })

    it('calls onZoomIn when clicked', async () => {
      const onZoomIn = vi.fn()
      const user = userEvent.setup()
      renderControls({ zoomLevel: 100, onZoomIn })

      await user.click(screen.getByLabelText('Zoom in'))
      expect(onZoomIn).toHaveBeenCalledTimes(1)
    })

    it('is disabled at max zoom (200%)', () => {
      renderControls({ zoomLevel: 200 })
      const btn = screen.getByLabelText('Zoom in')
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not call onZoomIn when disabled', async () => {
      const onZoomIn = vi.fn()
      const user = userEvent.setup()
      renderControls({ zoomLevel: 200, onZoomIn })

      await user.click(screen.getByLabelText('Zoom in'))
      expect(onZoomIn).not.toHaveBeenCalled()
    })

    it('is not disabled below max zoom', () => {
      renderControls({ zoomLevel: 175 })
      const btn = screen.getByLabelText('Zoom in')
      expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Zoom out button', () => {
    it('has correct aria-label', () => {
      renderControls()
      expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
    })

    it('calls onZoomOut when clicked', async () => {
      const onZoomOut = vi.fn()
      const user = userEvent.setup()
      renderControls({ zoomLevel: 100, onZoomOut })

      await user.click(screen.getByLabelText('Zoom out'))
      expect(onZoomOut).toHaveBeenCalledTimes(1)
    })

    it('is disabled at min zoom (50%)', () => {
      renderControls({ zoomLevel: 50 })
      const btn = screen.getByLabelText('Zoom out')
      expect(btn).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not call onZoomOut when disabled', async () => {
      const onZoomOut = vi.fn()
      const user = userEvent.setup()
      renderControls({ zoomLevel: 50, onZoomOut })

      await user.click(screen.getByLabelText('Zoom out'))
      expect(onZoomOut).not.toHaveBeenCalled()
    })

    it('is not disabled above min zoom', () => {
      renderControls({ zoomLevel: 75 })
      const btn = screen.getByLabelText('Zoom out')
      expect(btn).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Zoom level display', () => {
    it('displays current zoom level as percentage', () => {
      renderControls({ zoomLevel: 100 })
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('displays 50% at min zoom', () => {
      renderControls({ zoomLevel: 50 })
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('displays 200% at max zoom', () => {
      renderControls({ zoomLevel: 200 })
      expect(screen.getByText('200%')).toBeInTheDocument()
    })
  })

  describe('Keyboard accessibility', () => {
    it('all controls are focusable via Tab', async () => {
      const user = userEvent.setup()
      renderControls()

      await user.tab()
      expect(screen.getByLabelText('Previous page')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Next page')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Zoom out')).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText('Zoom in')).toHaveFocus()
    })

    it('buttons respond to Enter key', async () => {
      const onNextPage = vi.fn()
      const user = userEvent.setup()
      renderControls({ onNextPage })

      const btn = screen.getByLabelText('Next page')
      btn.focus()
      await user.keyboard('{Enter}')
      expect(onNextPage).toHaveBeenCalledTimes(1)
    })

    it('buttons respond to Space key', async () => {
      const onZoomIn = vi.fn()
      const user = userEvent.setup()
      renderControls({ onZoomIn })

      const btn = screen.getByLabelText('Zoom in')
      btn.focus()
      await user.keyboard(' ')
      expect(onZoomIn).toHaveBeenCalledTimes(1)
    })
  })
})
