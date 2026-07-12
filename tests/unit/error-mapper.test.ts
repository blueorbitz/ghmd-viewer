import { describe, it, expect } from 'vitest'
import { mapHttpStatusToAppError, mapErrorToAppError } from '@/services/error-mapper'
import { SessionExpiredError, InstallationAccessError } from '@/services/github-service'

describe('mapHttpStatusToAppError', () => {
  it('maps 401 to auth_required with authenticate action', () => {
    const result = mapHttpStatusToAppError(401)
    expect(result.type).toBe('auth_required')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('authenticate')
  })

  it('maps 403 to rate_limited with authenticate action', () => {
    const result = mapHttpStatusToAppError(403)
    expect(result.type).toBe('rate_limited')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('authenticate')
  })

  it('maps 404 to not_found with new_url action', () => {
    const result = mapHttpStatusToAppError(404)
    expect(result.type).toBe('not_found')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('new_url')
  })

  it('maps 422 to invalid_url with new_url action', () => {
    const result = mapHttpStatusToAppError(422)
    expect(result.type).toBe('invalid_url')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('new_url')
  })

  it('maps 5xx to retryable network error', () => {
    const result = mapHttpStatusToAppError(500)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
    expect(result.action).toBe('retry')
  })

  it('maps unknown status to retryable network error', () => {
    const result = mapHttpStatusToAppError(418)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
    expect(result.action).toBe('retry')
  })

  it('uses custom message when provided', () => {
    const result = mapHttpStatusToAppError(404, 'Custom not found message')
    expect(result.message).toBe('Custom not found message')
  })
})

describe('mapErrorToAppError', () => {
  it('maps SessionExpiredError to auth_required', () => {
    const result = mapErrorToAppError(new SessionExpiredError())
    expect(result.type).toBe('auth_required')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('authenticate')
  })

  it('maps InstallationAccessError to auth_failed', () => {
    const result = mapErrorToAppError(new InstallationAccessError())
    expect(result.type).toBe('auth_failed')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('authenticate')
  })

  it('maps TypeError with "fetch" to network error', () => {
    const result = mapErrorToAppError(new TypeError('Failed to fetch'))
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
    expect(result.action).toBe('retry')
  })

  it('maps error with "timeout" in message to network error', () => {
    const result = mapErrorToAppError(new Error('Request timeout'))
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
    expect(result.action).toBe('retry')
  })

  it('maps error with "rate limit" in message to rate_limited', () => {
    const result = mapErrorToAppError(new Error('Rate limit exceeded'))
    expect(result.type).toBe('rate_limited')
    expect(result.retryable).toBe(false)
    expect(result.action).toBe('authenticate')
  })

  it('maps generic Error to retryable network error', () => {
    const result = mapErrorToAppError(new Error('Something went wrong'))
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
    expect(result.action).toBe('retry')
    expect(result.message).toBe('Something went wrong')
  })

  it('maps non-Error value to generic network error', () => {
    const result = mapErrorToAppError('string error')
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
    expect(result.message).toBe('An unexpected error occurred.')
  })

  it('maps null to generic network error', () => {
    const result = mapErrorToAppError(null)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })
})
