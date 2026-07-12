import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import type { AppError } from '@/types/app'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional callback when error boundary catches an error */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  appError: AppError | null
}

/**
 * ErrorBoundary — React error boundary that wraps ContentArea.
 * Catches rendering errors and displays a fallback UI via ErrorDisplay.
 * Sidebar and Header remain functional when content rendering fails.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, appError: null }
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      appError: {
        type: 'render_error',
        message: 'Failed to render content. The content may contain unsupported elements.',
        retryable: true,
        action: 'retry',
      },
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report error for diagnostics
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, appError: null })
  }

  render() {
    if (this.state.hasError && this.state.appError) {
      return (
        <div className="p-6">
          <ErrorDisplay error={this.state.appError} onRetry={this.handleRetry} />
        </div>
      )
    }

    return this.props.children
  }
}
