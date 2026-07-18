import { useMemo } from 'react'
import { Sun, Moon, Monitor, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/ThemeProvider'
import { useMermaid } from '@/components/MermaidProvider'
import { createAuthService } from '@/services/auth-service'
import type { ThemePreference } from '@/types/app'

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system']

function getNextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_CYCLE.indexOf(current)
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length]
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  switch (preference) {
    case 'light':
      return <Sun className="h-4 w-4" />
    case 'dark':
      return <Moon className="h-4 w-4" />
    case 'system':
      return <Monitor className="h-4 w-4" />
  }
}

function getThemeLabel(preference: ThemePreference): string {
  switch (preference) {
    case 'light':
      return 'Switch to dark theme'
    case 'dark':
      return 'Switch to system theme'
    case 'system':
      return 'Switch to light theme'
  }
}

export function Header() {
  const { theme, setTheme } = useTheme()
  const { mermaidEnabled, toggleMermaid } = useMermaid()
  const authService = useMemo(() => createAuthService(), [])

  const handleThemeCycle = () => {
    setTheme(getNextTheme(theme))
  }

  const handleLogout = async () => {
    await authService.logout()
    window.location.hash = ''
    window.location.reload()
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <a
        href="#"
        className="text-sm font-semibold text-foreground hover:text-foreground/80 transition-colors"
        onClick={(e) => {
          e.preventDefault()
          window.location.hash = ''
        }}
      >
        GitHub Markdown Viewer
      </a>

      <div className="flex items-center gap-2">
        {/* Logout button (visible when authenticated) */}
        {authService.isAuthenticated() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            aria-label="Logout"
            className="gap-1.5 text-xs"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        )}

        {/* Mermaid rendering toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMermaid}
          aria-label={mermaidEnabled ? 'Disable Mermaid diagrams' : 'Enable Mermaid diagrams'}
          aria-pressed={mermaidEnabled}
          className="gap-1.5 text-xs"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 4v16h16" />
            <path d="M4 20l4-4 4 2 4-6 4-4" />
          </svg>
          <span className={mermaidEnabled ? 'text-foreground' : 'text-muted-foreground line-through'}>
            Mermaid
          </span>
        </Button>

        {/* Theme toggle button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleThemeCycle}
          aria-label={getThemeLabel(theme)}
        >
          <ThemeIcon preference={theme} />
        </Button>
      </div>
    </header>
  )
}
