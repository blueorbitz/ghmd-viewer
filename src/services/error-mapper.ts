import type { AppError } from '@/types/app'
import { SessionExpiredError, InstallationAccessError } from '@/services/github-service'

/**
 * Maps GitHub API HTTP status codes to AppError types.
 */
export function mapHttpStatusToAppError(status: number, message?: string): AppError {
  switch (status) {
    case 401:
      return {
        type: 'auth_required',
        message: message ?? 'Authentication required. Please connect your GitHub account.',
        retryable: false,
        action: 'authenticate',
      }
    case 403:
      // Could be rate-limited or access denied
      return {
        type: 'rate_limited',
        message: message ?? 'GitHub rate limit reached. Authenticate for higher limits.',
        retryable: false,
        action: 'authenticate',
      }
    case 404:
      return {
        type: 'not_found',
        message: message ?? 'Folder or file not found. Check the URL.',
        retryable: false,
        action: 'new_url',
      }
    case 422:
      return {
        type: 'invalid_url',
        message: message ?? 'Invalid request. Please check the URL format.',
        retryable: false,
        action: 'new_url',
      }
    default:
      if (status >= 500) {
        return {
          type: 'network',
          message: message ?? 'Server error. Please try again later.',
          retryable: true,
          action: 'retry',
        }
      }
      return {
        type: 'network',
        message: message ?? 'An unexpected error occurred.',
        retryable: true,
        action: 'retry',
      }
  }
}

/**
 * Maps a caught error (from fetch calls or service methods) to an AppError.
 * Handles known custom error types as well as generic errors.
 */
export function mapErrorToAppError(error: unknown): AppError {
  // Session expired (401 from auth backend)
  if (error instanceof SessionExpiredError) {
    return {
      type: 'auth_required',
      message: 'Session expired. Please re-authenticate.',
      retryable: false,
      action: 'authenticate',
    }
  }

  // Installation access error (403 from auth backend)
  if (error instanceof InstallationAccessError) {
    return {
      type: 'auth_failed',
      message: 'Repository not accessible. Add this repository to your GitHub App installation settings.',
      retryable: false,
      action: 'authenticate',
    }
  }

  // TypeError from fetch (network offline, DNS failure, CORS, etc.)
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection.',
      retryable: true,
      action: 'retry',
    }
  }

  // Generic network-like errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()

    if (msg.includes('network') || msg.includes('timeout') || msg.includes('abort')) {
      return {
        type: 'network',
        message: 'Network error. Please check your connection.',
        retryable: true,
        action: 'retry',
      }
    }

    if (msg.includes('rate limit')) {
      return {
        type: 'rate_limited',
        message: 'GitHub rate limit reached. Authenticate for higher limits.',
        retryable: false,
        action: 'authenticate',
      }
    }

    // Default — treat as a generic error that may be retryable
    return {
      type: 'network',
      message: error.message || 'An unexpected error occurred.',
      retryable: true,
      action: 'retry',
    }
  }

  // Unknown error shape
  return {
    type: 'network',
    message: 'An unexpected error occurred.',
    retryable: true,
    action: 'retry',
  }
}
