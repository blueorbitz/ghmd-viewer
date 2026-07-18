import { useMemo, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { PatLoginForm } from '@/components/PatLoginForm'
import { parseGitHubUrl } from '@/services/github-url-parser'
import { fetchPublicContents, fetchPrivateContents } from '@/services/github-service'
import { navigateToHash } from '@/services/url-state'
import { createAuthService } from '@/services/auth-service'
import type { AuthService } from '@/types/auth'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubmitError {
  message: string
  suggestAuth: boolean
  suggestInstall: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Classify a fetch error into a user-friendly message and whether to show
 * the authentication prompt or the app install prompt.
 */
function classifyFetchError(err: unknown, isAuthenticated: boolean): SubmitError {
  const message = err instanceof Error ? err.message : 'Unknown error'

  if (message.includes('directory listing but received a file response')) {
    return { message: 'The URL points to a file, not a folder. Please provide a folder URL.', suggestAuth: false, suggestInstall: false }
  }
  if (message.includes('Folder not found')) {
    if (isAuthenticated) {
      return { message: 'Folder not found. You may need to grant the app access to this repository.', suggestAuth: false, suggestInstall: true }
    }
    return { message: 'Repository or folder not found. Check the URL, or it may be a private repository.', suggestAuth: true, suggestInstall: false }
  }
  if (message.includes('rate limit')) {
    return { message: 'GitHub API rate limit reached. Please try again later or authenticate for higher limits.', suggestAuth: true, suggestInstall: false }
  }

  const lower = message.toLowerCase()
  if (lower.includes('session') || lower.includes('expired') || lower.includes('authentication required')) {
    return { message, suggestAuth: true, suggestInstall: false }
  }

  return { message, suggestAuth: false, suggestInstall: false }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function Header({ authService }: { authService: AuthService }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">GitHub Markdown Viewer</h1>
      <p className="text-muted-foreground mt-2">
        Paste a GitHub folder URL to browse and read Markdown files
      </p>
      {authService.isAuthenticated() && (
        <button
          type="button"
          onClick={async () => {
            await authService.logout()
            window.location.reload()
          }}
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
        >
          Logout current session
        </button>
      )}
    </div>
  )
}

function AuthPromptButtons({
  authService,
  showPatForm,
  pendingUrl,
  onShowPatForm,
  onError,
  onSubmit,
}: {
  authService: AuthService
  showPatForm: boolean
  pendingUrl: string
  onShowPatForm: (show: boolean) => void
  onError: (msg: string) => void
  onSubmit: () => void
}) {
  function handleConnectGitHub() {
    try {
      // Save the current URL input so it survives the OAuth redirect
      if (pendingUrl.trim()) {
        sessionStorage.setItem(PENDING_URL_KEY, pendingUrl)
      }
      authService.initiateOAuth(window.location.hash || '/')
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to initiate OAuth')
    }
  }

  if (showPatForm) {
    return (
      <PatLoginForm
        onSuccess={() => {
          onShowPatForm(false)
          onSubmit()
        }}
        onCancel={() => onShowPatForm(false)}
      />
    )
  }

  return (
    <div className="flex gap-2">
      {authService.getBackendUrl() && (
        <Button variant="outline" size="sm" onClick={handleConnectGitHub}>
          Connect GitHub
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => onShowPatForm(true)}>
        Use Personal Access Token
      </Button>
    </div>
  )
}

const PENDING_URL_KEY = 'ghmd-pending-url'

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * InputView — The landing page where users paste a GitHub folder URL.
 *
 * Validates the URL format, checks repository accessibility, and navigates
 * to the reader view for public repos or prompts authentication for private repos.
 */
export function InputView() {
  const [url, setUrl] = useState(() => {
    // Restore the URL input from sessionStorage if it was saved before an OAuth redirect
    const saved = sessionStorage.getItem(PENDING_URL_KEY)
    if (saved) {
      sessionStorage.removeItem(PENDING_URL_KEY)
      return saved
    }
    return ''
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showPatForm, setShowPatForm] = useState(false)
  const [appInstallUrl, setAppInstallUrl] = useState<string | null>(null)

  const authService = useMemo(() => createAuthService(), [])
  const isSubmitDisabled = !url.trim() || isLoading

  // Fetch the app install URL when authenticated
  useEffect(() => {
    if (!authService.isAuthenticated()) return
    const backendUrl = authService.getBackendUrl()
    if (!backendUrl) return

    fetch(`${backendUrl}/api/auth/status`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.app_install_url) {
          setAppInstallUrl(data.app_install_url)
        }
      })
      .catch(() => {})
  }, [authService])

  // ─── Actions ─────────────────────────────────────────────────────────────

  function clearError() {
    setError(null)
    setShowAuthPrompt(false)
    setShowInstallPrompt(false)
    setShowPatForm(false)
  }

  function showError(message: string, suggestAuth = false, suggestInstall = false) {
    setError(message)
    setShowAuthPrompt(suggestAuth)
    setShowInstallPrompt(suggestInstall)
  }

  async function handleSubmit() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    clearError()
    setIsLoading(true)

    try {
      // 1. Parse the URL
      const parsed = parseGitHubUrl(trimmedUrl)
      if (!parsed) {
        showError('Invalid URL format. Expected: https://github.com/{owner}/{repo}/tree/{branch}/{path}')
        return
      }

      // 2. Verify the folder is accessible
      try {
        if (authService.isAuthenticated()) {
          await fetchPrivateContents(parsed.owner, parsed.repo, parsed.path, parsed.branch)
        } else {
          await fetchPublicContents(parsed.owner, parsed.repo, parsed.path, parsed.branch)
        }
      } catch (fetchErr) {
        const classified = classifyFetchError(fetchErr, authService.isAuthenticated())
        showError(classified.message, classified.suggestAuth, classified.suggestInstall)
        return
      }

      // 3. Navigate to reader view
      navigateToHash({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        folderPath: parsed.path,
      })
    } catch (err) {
      showError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !isSubmitDisabled) {
      handleSubmit()
    }
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value)
    if (error) clearError()
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-xl space-y-6 text-center flex-1 flex flex-col justify-center">
        <Header authService={authService} />

        {/* URL Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/owner/repo/tree/main/docs"
            disabled={isLoading}
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="GitHub folder URL"
            aria-invalid={!!error}
            aria-describedby={error ? 'url-error' : undefined}
          />
          <Button onClick={handleSubmit} disabled={isSubmitDisabled} aria-label="Submit URL">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Checking…
              </span>
            ) : (
              'Open'
            )}
          </Button>
        </div>

        {/* Error + Auth/Install prompt */}
        {error && (
          <div className="space-y-2 text-center">
            <p id="url-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
            {showAuthPrompt && !authService.isAuthenticated() && (
              <div className="flex justify-center">
                <AuthPromptButtons
                  authService={authService}
                  showPatForm={showPatForm}
                  pendingUrl={url}
                  onShowPatForm={setShowPatForm}
                  onError={(msg) => showError(msg, false)}
                  onSubmit={() => {
                    clearError()
                    handleSubmit()
                  }}
                />
              </div>
            )}
            {showInstallPrompt && appInstallUrl && (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(appInstallUrl, '_blank', 'noopener')}
                >
                  Grant Repository Access
                </Button>
                <span className="text-xs text-muted-foreground">
                  Opens GitHub in a new window. Come back and retry after granting access.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="w-full py-4 text-center text-xs text-muted-foreground">
        <a href="#/security" className="hover:text-foreground transition-colors underline">
          Security
        </a>
        <p className="mt-1">&copy; {new Date().getFullYear()} GitHub Markdown Viewer</p>
      </footer>
    </div>
  )
}
