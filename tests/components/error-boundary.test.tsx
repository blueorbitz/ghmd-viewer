import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Component that deliberately throws during render
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error')
  }
  return <div>Content rendered successfully</div>
}

describe('ErrorBoundary', () => {
  // Suppress React error boundary console output during tests
  const originalConsoleError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalConsoleError
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Content rendered successfully')).toBeInTheDocument()
  })

  it('renders ErrorDisplay fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    // Should display render_error message
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Failed to render content/)).toBeInTheDocument()
  })

  it('shows retry button in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('resets error state and re-renders children when retry is clicked', async () => {
    const user = userEvent.setup()

    // We need a stateful component to control when it throws
    let shouldThrow = true
    function ConditionalThrower() {
      if (shouldThrow) {
        throw new Error('Render failure')
      }
      return <div>Recovered content</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    )

    // Verify error state
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Fix the "error" before retrying
    shouldThrow = false

    // Click retry
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    // Force re-render after state reset
    rerender(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
  })

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    )
  })

  it('does not affect sibling components outside the boundary', () => {
    render(
      <div>
        <div data-testid="sibling">Sidebar content</div>
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      </div>,
    )

    // Sibling remains functional
    expect(screen.getByTestId('sibling')).toHaveTextContent('Sidebar content')
    // Error boundary shows fallback
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
