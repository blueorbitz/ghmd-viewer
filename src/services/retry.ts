/**
 * Retry utility with exponential backoff.
 *
 * Retries the given async function on failure with delays of 1s, 2s, 4s (doubling).
 * Only retries on network-like errors (TypeError from fetch, or errors containing
 * 'network', 'timeout', or 'abort' in their message).
 *
 * @param fn - Async function to execute and potentially retry
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @returns The result of the function if successful
 * @throws The last error if all attempts fail
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
): Promise<T> {
  const BASE_DELAY_MS = 1000

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Only retry on network/transient errors
      if (!isRetryableError(error)) {
        throw error
      }

      // Don't wait after the last attempt
      if (attempt < maxAttempts) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) // 1s, 2s, 4s
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Determines if an error is retryable (network/transient).
 * Non-retryable errors (4xx, auth errors) are thrown immediately.
 */
export function isRetryableError(error: unknown): boolean {
  // TypeError from fetch = network issue (offline, DNS, CORS)
  if (error instanceof TypeError) {
    return true
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset')
    )
  }

  return false
}

/**
 * Alias for fetchWithRetry matching the spec interface.
 * Retries with exponential backoff (max 3 attempts by default).
 *
 * @param fn - Async function to execute and potentially retry
 * @param maxRetries - Maximum number of retries (default: 3, so up to 3 attempts total)
 * @returns The result of the function if successful
 * @throws The last error if all attempts fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  return fetchWithRetry(fn, maxRetries)
}

/**
 * Promise-based sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
