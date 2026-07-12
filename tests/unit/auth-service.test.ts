import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAuthService } from '@/services/auth-service'
import type { AuthService } from '@/types/auth'

// Helper to set the VITE_AUTH_BACKEND_URL env var
function setBackendUrl(url: string | undefined) {
  if (url === undefined) {
    vi.stubEnv('VITE_AUTH_BACKEND_URL', '')
  } else {
    vi.stubEnv('VITE_AUTH_BACKEND_URL', url)
  }
}

describe('AuthService', () => {
  let service: AuthService

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('isPrivateAccessAvailable', () => {
    it('returns true when VITE_AUTH_BACKEND_URL is set', () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()
      expect(service.isPrivateAccessAvailable()).toBe(true)
    })

    it('returns false when VITE_AUTH_BACKEND_URL is empty', () => {
      setBackendUrl('')
      service = createAuthService()
      expect(service.isPrivateAccessAvailable()).toBe(false)
    })

    it('returns false when VITE_AUTH_BACKEND_URL is whitespace-only', () => {
      setBackendUrl('   ')
      service = createAuthService()
      expect(service.isPrivateAccessAvailable()).toBe(false)
    })

    it('returns false when VITE_AUTH_BACKEND_URL is undefined', () => {
      setBackendUrl(undefined)
      service = createAuthService()
      expect(service.isPrivateAccessAvailable()).toBe(false)
    })
  })

  describe('getBackendUrl', () => {
    it('returns the configured URL with trailing slash removed', () => {
      setBackendUrl('http://localhost:8080/')
      service = createAuthService()
      expect(service.getBackendUrl()).toBe('http://localhost:8080')
    })

    it('returns the URL as-is when no trailing slash', () => {
      setBackendUrl('https://auth.example.com')
      service = createAuthService()
      expect(service.getBackendUrl()).toBe('https://auth.example.com')
    })

    it('returns null when URL is not configured', () => {
      setBackendUrl('')
      service = createAuthService()
      expect(service.getBackendUrl()).toBeNull()
    })
  })

  describe('initiateOAuth', () => {
    it('redirects to backend login endpoint with return_hash', () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()

      // Mock window.location.href setter
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
      } as Location)

      // We need to capture the assignment to window.location.href
      let assignedUrl = ''
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          ...window.location,
          set href(url: string) {
            assignedUrl = url
          },
          get href() {
            return assignedUrl
          },
        },
      })

      service.initiateOAuth('#/owner/repo/main/docs')

      expect(assignedUrl).toContain('http://localhost:8080/api/auth/login')
      expect(assignedUrl).toContain('return_hash=')
      expect(assignedUrl).toContain(encodeURIComponent('#/owner/repo/main/docs'))

      locationSpy.mockRestore()
    })

    it('throws when backend URL is not configured', () => {
      setBackendUrl('')
      service = createAuthService()

      expect(() => service.initiateOAuth('#/test')).toThrow(
        'Auth backend URL is not configured',
      )
    })
  })

  describe('isAuthenticated', () => {
    it('returns false when localStorage flag is not set', () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()
      expect(service.isAuthenticated()).toBe(false)
    })

    it('returns true when localStorage flag is "true"', () => {
      localStorage.setItem('ghmd-authenticated', 'true')
      setBackendUrl('http://localhost:8080')
      service = createAuthService()
      expect(service.isAuthenticated()).toBe(true)
    })

    it('returns false when localStorage flag is "false"', () => {
      localStorage.setItem('ghmd-authenticated', 'false')
      setBackendUrl('http://localhost:8080')
      service = createAuthService()
      expect(service.isAuthenticated()).toBe(false)
    })
  })

  describe('handleOAuthCallback', () => {
    it('returns success when backend confirms authentication', async () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await service.handleOAuthCallback('test-code', 'test-state')
      expect(result).toEqual({ success: true })
      expect(localStorage.getItem('ghmd-authenticated')).toBe('true')
    })

    it('returns failure when backend says not authenticated', async () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const result = await service.handleOAuthCallback('test-code', 'test-state')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('exchange_failed')
      }
    })

    it('returns failure when status endpoint returns non-200', async () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      )

      const result = await service.handleOAuthCallback('test-code', 'test-state')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('exchange_failed')
      }
    })

    it('returns failure when network error occurs', async () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      )

      const result = await service.handleOAuthCallback('test-code', 'test-state')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('exchange_failed')
        expect(result.message).toBe('Network error')
      }
    })

    it('returns failure when backend URL is not configured', async () => {
      setBackendUrl('')
      service = createAuthService()

      const result = await service.handleOAuthCallback('test-code', 'test-state')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('exchange_failed')
        expect(result.message).toContain('not configured')
      }
    })
  })

  describe('logout', () => {
    it('clears localStorage flag and calls backend', async () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()
      localStorage.setItem('ghmd-authenticated', 'true')

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      )

      await service.logout()

      expect(localStorage.getItem('ghmd-authenticated')).toBeNull()
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8080/api/auth/logout',
        { method: 'POST', credentials: 'include' },
      )
    })

    it('clears localStorage even when backend request fails', async () => {
      setBackendUrl('http://localhost:8080')
      service = createAuthService()
      localStorage.setItem('ghmd-authenticated', 'true')

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      )

      await service.logout()

      expect(localStorage.getItem('ghmd-authenticated')).toBeNull()
    })

    it('clears localStorage when backend URL is not configured', async () => {
      setBackendUrl('')
      service = createAuthService()
      localStorage.setItem('ghmd-authenticated', 'true')

      await service.logout()

      expect(localStorage.getItem('ghmd-authenticated')).toBeNull()
    })
  })
})
