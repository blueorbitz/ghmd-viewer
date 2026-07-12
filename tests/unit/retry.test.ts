import { describe, it, expect, vi } from 'vitest'
import { fetchWithRetry, retryWithBackoff, isRetryableError } from '@/services/retry'

describe('fetchWithRetry', () => {
  it('returns the result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await fetchWithRetry(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on network error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('success')

    const result = await fetchWithRetry(fn, 3)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws immediately on non-retryable error', async () => {
    const error = new Error('Not found')
    // Not a network/timeout error, so not retryable by isRetryableError
    // However, mapErrorToAppError treats generic errors as retryable.
    // isRetryableError only looks for network/timeout/abort patterns
    const fn = vi.fn().mockRejectedValue(error)

    await expect(fetchWithRetry(fn, 3)).rejects.toThrow('Not found')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after max attempts for retryable errors', async () => {
    const error = new TypeError('Failed to fetch')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(fetchWithRetry(fn, 3)).rejects.toThrow('Failed to fetch')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respects custom maxAttempts', async () => {
    const error = new TypeError('network failure')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(fetchWithRetry(fn, 2)).rejects.toThrow('network failure')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('retryWithBackoff', () => {
  it('is an alias for fetchWithRetry and retries correctly', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue('done')

    const result = await retryWithBackoff(fn, 3)
    expect(result).toBe('done')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('defaults to 3 max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('network error'))

    await expect(retryWithBackoff(fn)).rejects.toThrow('network error')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})

describe('isRetryableError', () => {
  it('returns true for TypeError (fetch failures)', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('returns true for errors with "network" in message', () => {
    expect(isRetryableError(new Error('Network error'))).toBe(true)
  })

  it('returns true for errors with "timeout" in message', () => {
    expect(isRetryableError(new Error('Request timeout'))).toBe(true)
  })

  it('returns true for errors with "abort" in message', () => {
    expect(isRetryableError(new Error('Aborted'))).toBe(true)
  })

  it('returns false for generic errors without network keywords', () => {
    expect(isRetryableError(new Error('Not found'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isRetryableError('string')).toBe(false)
    expect(isRetryableError(null)).toBe(false)
    expect(isRetryableError(42)).toBe(false)
  })
})
