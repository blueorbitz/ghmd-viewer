import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createAuthService } from '@/services/auth-service'

interface OAuthCallbackViewProps {
  params: URLSearchParams
}

type CallbackState =
  | { status: 'loading' }
  | { status: 'error'; errorType: 'cancelled' | 'state_mismatch' | 'exchange_failed' | 'unknown'; message: string }

/**
 * OAuthCallbackView — Handles the OAuth redirect callback from GitHub.
 *
 * Flow:
 * 1. Check if params contain 'error' → show error (user denied access)
 * 2. Otherwise, call handleOAuthCallback() to verify auth status
 * 3. On success → redirect to the hash state stored before auth
 * 4. On failure → show error with retry button
 *
 * Requirements: 3.4, 3.8, 3.9
 */
export function OAuthCallbackView({ params }: OAuthCallbackViewProps) {
  const [state, setState] = useState<CallbackState>({ status: 'loading' })

  useEffect(() => {
    processCallback()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function processCallback() {
    // Check if GitHub redirected with an error (e.g., user denied access)
    const error = params.get('error')
    if (error) {
      const description = params.get('error_description') || 'Authorization was cancelled'
      setState({
        status: 'error',
        errorType: 'cancelled',
        message: description,
      })
      return
    }

    // Extract code and state from params
    const code = params.get('code') || ''
    const stateParam = params.get('state') || ''

    // Verify the session is active via the auth service
    const authService = createAuthService()
    const result = await authService.handleOAuthCallback(code, stateParam)

    if (result.success) {
      // Redirect to the original URL the user was viewing before auth
      const returnHash = params.get('return_hash')
      if (returnHash) {
        window.location.hash = returnHash
      } else {
        // Fall back to root/input view
        window.location.hash = ''
      }
    } else {
      setState({
        status: 'error',
        errorType: result.error,
        message: result.message,
      })
    }
  }

  function handleRetry() {
    const authService = createAuthService()
    const returnHash = params.get('return_hash') || ''
    authService.initiateOAuth(returnHash)
  }

  function handleGoHome() {
    window.location.hash = ''
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div
            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
            role="status"
            aria-label="Loading"
          />
          <p className="text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    )
  }

  // Error state
  const errorTitle = getErrorTitle(state.errorType)

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="text-destructive text-4xl" aria-hidden="true">⚠</div>
        <h1 className="text-xl font-semibold">{errorTitle}</h1>
        <p className="text-muted-foreground">{state.message}</p>
        <div className="flex gap-3 justify-center pt-2">
          {state.errorType !== 'cancelled' && (
            <Button onClick={handleRetry}>Try Again</Button>
          )}
          {state.errorType === 'cancelled' && (
            <Button onClick={handleRetry}>Retry Authorization</Button>
          )}
          <Button variant="outline" onClick={handleGoHome}>
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}

function getErrorTitle(errorType: string): string {
  switch (errorType) {
    case 'cancelled':
      return 'Authorization Cancelled'
    case 'state_mismatch':
      return 'Security Error'
    case 'exchange_failed':
      return 'Connection Failed'
    default:
      return 'Authentication Error'
  }
}
