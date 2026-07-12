import { Button } from '@/components/ui/button'
import type { AppError } from '@/types/app'

interface ErrorDisplayProps {
  error: AppError
  onRetry?: () => void
  onAuthenticate?: () => void
  onNewUrl?: () => void
  onEnterPassphrase?: () => void
}

/**
 * ErrorDisplay — renders an AppError with appropriate message and action buttons.
 *
 * Actions rendered based on `error.action`:
 * - 'retry' → "Retry" button (calls onRetry)
 * - 'authenticate' → "Connect GitHub" button (calls onAuthenticate)
 * - 'new_url' → "Enter New URL" button (calls onNewUrl)
 * - 'enter_passphrase' → "Try Again" button (calls onEnterPassphrase)
 *
 * If `error.retryable` is true and no specific action is set, a generic retry button is shown.
 */
export function ErrorDisplay({
  error,
  onRetry,
  onAuthenticate,
  onNewUrl,
  onEnterPassphrase,
}: ErrorDisplayProps) {
  return (
    <div
      className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
      role="alert"
      aria-live="assertive"
    >
      <p className="font-medium">Error</p>
      <p className="mt-1">{error.message}</p>

      <div className="mt-3 flex gap-2">
        {error.action === 'retry' && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}

        {error.action === 'authenticate' && onAuthenticate && (
          <Button variant="outline" size="sm" onClick={onAuthenticate}>
            Connect GitHub
          </Button>
        )}

        {error.action === 'new_url' && onNewUrl && (
          <Button variant="outline" size="sm" onClick={onNewUrl}>
            Enter New URL
          </Button>
        )}

        {error.action === 'enter_passphrase' && onEnterPassphrase && (
          <Button variant="outline" size="sm" onClick={onEnterPassphrase}>
            Try Again
          </Button>
        )}

        {/* Generic retry when retryable but no specific action */}
        {error.retryable && !error.action && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
