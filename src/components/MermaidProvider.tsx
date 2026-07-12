import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'ghmd-mermaid-enabled'

interface MermaidContextValue {
  mermaidEnabled: boolean
  setMermaidEnabled: (enabled: boolean) => void
  toggleMermaid: () => void
}

const MermaidContext = createContext<MermaidContextValue | undefined>(undefined)

function getStoredMermaidEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'false') return false
  // Default is enabled (true) for any other value or missing key
  return true
}

interface MermaidProviderProps {
  children: ReactNode
}

export function MermaidProvider({ children }: MermaidProviderProps) {
  const [mermaidEnabled, setMermaidEnabledState] = useState<boolean>(getStoredMermaidEnabled)

  const setMermaidEnabled = (enabled: boolean) => {
    setMermaidEnabledState(enabled)
    localStorage.setItem(STORAGE_KEY, String(enabled))
  }

  const toggleMermaid = () => {
    setMermaidEnabled(!mermaidEnabled)
  }

  // Sync initial state to localStorage if not already set
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
  }, [])

  return (
    <MermaidContext.Provider value={{ mermaidEnabled, setMermaidEnabled, toggleMermaid }}>
      {children}
    </MermaidContext.Provider>
  )
}

export function useMermaid(): MermaidContextValue {
  const context = useContext(MermaidContext)
  if (!context) {
    throw new Error('useMermaid must be used within a MermaidProvider')
  }
  return context
}
