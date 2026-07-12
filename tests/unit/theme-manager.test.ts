import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ThemeManager, resetThemeManager } from '@/services/theme-manager'

function mockMatchMedia(prefersDark = false) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = []
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      addEventListener: vi.fn((_event: string, listener: (e: MediaQueryListEvent) => void) => {
        listeners.push(listener)
      }),
      removeEventListener: vi.fn(),
    })),
  })
  return listeners
}

describe('ThemeManager', () => {
  let manager: ThemeManager
  let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[]

  beforeEach(() => {
    resetThemeManager()
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
    mediaQueryListeners = mockMatchMedia(false)
  })

  afterEach(() => {
    manager?.destroy()
  })

  describe('initialization', () => {
    it('defaults to system preference when no localStorage value exists', () => {
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('system')
    })

    it('loads saved preference from localStorage', () => {
      localStorage.setItem('ghmd-theme', 'dark')
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('dark')
    })

    it('removes invalid localStorage value and falls back to system', () => {
      localStorage.setItem('ghmd-theme', 'invalid-value')
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('system')
      expect(localStorage.getItem('ghmd-theme')).toBeNull()
    })

    it('applies dark class on document root when effective theme is dark', () => {
      localStorage.setItem('ghmd-theme', 'dark')
      manager = new ThemeManager()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('applies light class on document root when effective theme is light', () => {
      localStorage.setItem('ghmd-theme', 'light')
      manager = new ThemeManager()
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('getEffectiveTheme', () => {
    it('returns light when preference is light', () => {
      localStorage.setItem('ghmd-theme', 'light')
      manager = new ThemeManager()
      expect(manager.getEffectiveTheme()).toBe('light')
    })

    it('returns dark when preference is dark', () => {
      localStorage.setItem('ghmd-theme', 'dark')
      manager = new ThemeManager()
      expect(manager.getEffectiveTheme()).toBe('dark')
    })

    it('returns OS theme when preference is system (light OS)', () => {
      manager = new ThemeManager()
      expect(manager.getEffectiveTheme()).toBe('light')
    })

    it('returns OS theme when preference is system (dark OS)', () => {
      mockMatchMedia(true)
      manager = new ThemeManager()
      expect(manager.getEffectiveTheme()).toBe('dark')
    })
  })

  describe('setPreference', () => {
    it('persists preference to localStorage', () => {
      manager = new ThemeManager()
      manager.setPreference('dark')
      expect(localStorage.getItem('ghmd-theme')).toBe('dark')
    })

    it('applies theme class immediately', () => {
      manager = new ThemeManager()
      manager.setPreference('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('switches from dark to light correctly', () => {
      localStorage.setItem('ghmd-theme', 'dark')
      manager = new ThemeManager()
      manager.setPreference('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('cycleTheme', () => {
    it('cycles light → dark', () => {
      localStorage.setItem('ghmd-theme', 'light')
      manager = new ThemeManager()
      manager.cycleTheme()
      expect(manager.getPreference()).toBe('dark')
    })

    it('cycles dark → system', () => {
      localStorage.setItem('ghmd-theme', 'dark')
      manager = new ThemeManager()
      manager.cycleTheme()
      expect(manager.getPreference()).toBe('system')
    })

    it('cycles system → light', () => {
      manager = new ThemeManager()
      manager.cycleTheme()
      expect(manager.getPreference()).toBe('light')
    })

    it('full cycle: light → dark → system → light', () => {
      localStorage.setItem('ghmd-theme', 'light')
      manager = new ThemeManager()
      
      manager.cycleTheme()
      expect(manager.getPreference()).toBe('dark')
      
      manager.cycleTheme()
      expect(manager.getPreference()).toBe('system')
      
      manager.cycleTheme()
      expect(manager.getPreference()).toBe('light')
    })
  })

  describe('onThemeChange', () => {
    it('calls listener when theme changes', () => {
      manager = new ThemeManager()
      const callback = vi.fn()
      manager.onThemeChange(callback)

      manager.setPreference('dark')
      expect(callback).toHaveBeenCalledWith('dark')
    })

    it('returns an unsubscribe function', () => {
      manager = new ThemeManager()
      const callback = vi.fn()
      const unsubscribe = manager.onThemeChange(callback)

      unsubscribe()
      manager.setPreference('dark')
      expect(callback).not.toHaveBeenCalled()
    })

    it('notifies multiple listeners', () => {
      manager = new ThemeManager()
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      manager.onThemeChange(cb1)
      manager.onThemeChange(cb2)

      manager.setPreference('dark')
      expect(cb1).toHaveBeenCalledWith('dark')
      expect(cb2).toHaveBeenCalledWith('dark')
    })
  })

  describe('OS preference change handling', () => {
    it('updates effective theme when OS preference changes and mode is system', () => {
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('system')

      // Simulate OS switching to dark mode by re-mocking
      mockMatchMedia(true)

      // Trigger the media query listener
      for (const listener of mediaQueryListeners) {
        listener({ matches: true } as MediaQueryListEvent)
      }

      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('does not react to OS changes when preference is explicit', () => {
      localStorage.setItem('ghmd-theme', 'light')
      manager = new ThemeManager()

      // Trigger the media query listener (OS goes dark)
      for (const listener of mediaQueryListeners) {
        listener({ matches: true } as MediaQueryListEvent)
      }

      // Should stay light since preference is explicit
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
  })

  describe('invalid localStorage handling', () => {
    it('handles empty string in localStorage', () => {
      localStorage.setItem('ghmd-theme', '')
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('system')
      expect(localStorage.getItem('ghmd-theme')).toBeNull()
    })

    it('handles numeric value in localStorage', () => {
      localStorage.setItem('ghmd-theme', '42')
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('system')
      expect(localStorage.getItem('ghmd-theme')).toBeNull()
    })

    it('handles JSON value in localStorage', () => {
      localStorage.setItem('ghmd-theme', '{"theme":"dark"}')
      manager = new ThemeManager()
      expect(manager.getPreference()).toBe('system')
      expect(localStorage.getItem('ghmd-theme')).toBeNull()
    })
  })
})
