import type { ThemePreference } from '@/types/app'

const STORAGE_KEY = 'ghmd-theme'
const VALID_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system']
const CYCLE_ORDER: ThemePreference[] = ['light', 'dark', 'system']

type ThemeChangeCallback = (theme: 'light' | 'dark') => void

function isValidPreference(value: string): value is ThemePreference {
  return VALID_PREFERENCES.includes(value as ThemePreference)
}

export class ThemeManager {
  private preference: ThemePreference
  private listeners: Set<ThemeChangeCallback> = new Set()
  private mediaQuery: MediaQueryList | null = null
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null

  constructor() {
    this.preference = this.loadPreference()
    this.applyTheme()
    this.listenToOSChanges()
  }

  /** Get the currently applied theme ('light' or 'dark') */
  getEffectiveTheme(): 'light' | 'dark' {
    if (this.preference === 'system') {
      return this.getSystemTheme()
    }
    return this.preference
  }

  /** Get the user's saved preference */
  getPreference(): ThemePreference {
    return this.preference
  }

  /** Set the theme preference, persist it, and apply immediately */
  setPreference(pref: ThemePreference): void {
    this.preference = pref
    localStorage.setItem(STORAGE_KEY, pref)
    this.applyTheme()
    this.notifyListeners()
  }

  /** Cycle to the next theme: light → dark → system → light */
  cycleTheme(): void {
    const currentIndex = CYCLE_ORDER.indexOf(this.preference)
    const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length
    this.setPreference(CYCLE_ORDER[nextIndex])
  }

  /** Subscribe to theme changes. Returns an unsubscribe function. */
  onThemeChange(callback: ThemeChangeCallback): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  /** Clean up event listeners */
  destroy(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener)
    }
    this.listeners.clear()
  }

  private loadPreference(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      return 'system'
    }
    if (isValidPreference(stored)) {
      return stored
    }
    // Invalid value: remove it and fall back to system
    localStorage.removeItem(STORAGE_KEY)
    return 'system'
  }

  private getSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  private applyTheme(): void {
    const effective = this.getEffectiveTheme()
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(effective)
  }

  private listenToOSChanges(): void {
    if (typeof window === 'undefined') return
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.mediaListener = () => {
      if (this.preference === 'system') {
        this.applyTheme()
        this.notifyListeners()
      }
    }
    this.mediaQuery.addEventListener('change', this.mediaListener)
  }

  private notifyListeners(): void {
    const effective = this.getEffectiveTheme()
    for (const listener of this.listeners) {
      listener(effective)
    }
  }
}

/** Singleton instance for app-wide use (lazy-initialized) */
let _instance: ThemeManager | null = null

export function getThemeManager(): ThemeManager {
  if (!_instance) {
    _instance = new ThemeManager()
  }
  return _instance
}

/** Reset singleton — useful for testing */
export function resetThemeManager(): void {
  if (_instance) {
    _instance.destroy()
    _instance = null
  }
}
