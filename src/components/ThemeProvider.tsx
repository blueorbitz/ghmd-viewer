import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ThemePreference } from '@/types/app'

interface ThemeContextValue {
  theme: ThemePreference
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'ghmd-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  // Invalid value — remove it and fall back to system
  if (stored !== null) {
    localStorage.removeItem(STORAGE_KEY)
  }
  return 'system'
}

function resolveEffective(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return getSystemTheme()
  return pref
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(getStoredPreference)
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    resolveEffective(getStoredPreference()),
  )

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  // Update effective theme and apply class
  useEffect(() => {
    const effective = resolveEffective(theme)
    setEffectiveTheme(effective)

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(effective)
  }, [theme])

  // Listen for OS color scheme changes when in 'system' mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        const effective = getSystemTheme()
        setEffectiveTheme(effective)
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(effective)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
