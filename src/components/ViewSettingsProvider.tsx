import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const MERMAID_STORAGE_KEY = 'ghmd-mermaid-enabled'
const RAW_VIEW_STORAGE_KEY = 'ghmd-raw-view'

interface ViewSettingsContextValue {
  mermaidEnabled: boolean
  setMermaidEnabled: (enabled: boolean) => void
  toggleMermaid: () => void
  rawViewEnabled: boolean
  setRawViewEnabled: (enabled: boolean) => void
  toggleRawView: () => void
}

const ViewSettingsContext = createContext<ViewSettingsContextValue | undefined>(undefined)

function readFromStorage(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    return stored === 'true'
  } catch {
    return defaultValue
  }
}

function writeToStorage(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Silently skip if localStorage is unavailable
  }
}

interface ViewSettingsProviderProps {
  children: ReactNode
}

export function ViewSettingsProvider({ children }: ViewSettingsProviderProps) {
  const [mermaidEnabled, setMermaidEnabledState] = useState<boolean>(() =>
    readFromStorage(MERMAID_STORAGE_KEY, true)
  )
  const [rawViewEnabled, setRawViewEnabledState] = useState<boolean>(() =>
    readFromStorage(RAW_VIEW_STORAGE_KEY, false)
  )

  const setMermaidEnabled = (enabled: boolean) => {
    setMermaidEnabledState(enabled)
    writeToStorage(MERMAID_STORAGE_KEY, enabled)
  }

  const toggleMermaid = () => {
    setMermaidEnabled(!mermaidEnabled)
  }

  const setRawViewEnabled = (enabled: boolean) => {
    setRawViewEnabledState(enabled)
    writeToStorage(RAW_VIEW_STORAGE_KEY, enabled)
  }

  const toggleRawView = () => {
    setRawViewEnabled(!rawViewEnabled)
  }

  // Sync initial state to localStorage if not already set
  useEffect(() => {
    try {
      if (localStorage.getItem(MERMAID_STORAGE_KEY) === null) {
        localStorage.setItem(MERMAID_STORAGE_KEY, 'true')
      }
      if (localStorage.getItem(RAW_VIEW_STORAGE_KEY) === null) {
        localStorage.setItem(RAW_VIEW_STORAGE_KEY, 'false')
      }
    } catch {
      // Silently skip if localStorage is unavailable
    }
  }, [])

  return (
    <ViewSettingsContext.Provider
      value={{
        mermaidEnabled,
        setMermaidEnabled,
        toggleMermaid,
        rawViewEnabled,
        setRawViewEnabled,
        toggleRawView,
      }}
    >
      {children}
    </ViewSettingsContext.Provider>
  )
}

export function useViewSettings(): ViewSettingsContextValue {
  const context = useContext(ViewSettingsContext)
  if (!context) {
    throw new Error('useViewSettings must be used within a ViewSettingsProvider')
  }
  return context
}
