import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createAuthService } from '@/services/auth-service'

interface PatLoginFormProps {
  onSuccess: () => void
  onCancel: () => void
}

/**
 * PatLoginForm — Allows users to authenticate using a GitHub Personal Access Token.
 *
 * Renders a password-masked PAT input and an optional repository scope field.
 * Validates inputs client-side, calls the auth service, and displays errors inline.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 5.4, 6.5, 6.6, 6.7
 */
export function PatLoginForm({ onSuccess, onCancel }: PatLoginFormProps) {
  const [pat, setPat] = useState('')
  const [scope, setScope] = useState('')
  const [patError, setPatError] = useState<string | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const patInputRef = useRef<HTMLInputElement>(null)
  const authService = useMemo(() => createAuthService(), [])

  function validatePat(value: string): string | null {
    if (!value.trim()) {
      return 'A Personal Access Token is required.'
    }
    return null
  }

  function validateScope(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) {
      // Scope is optional
      return null
    }
    const parts = trimmed.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return 'Scope must be in owner/repo format (e.g. my-org/my-repo).'
    }
    return null
  }

  function isFormValid(): boolean {
    const patVal = validatePat(pat)
    const scopeVal = validateScope(scope)
    return patVal === null && scopeVal === null
  }

  const isSubmitDisabled = !isFormValid() || isSubmitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Run validation
    const patValidation = validatePat(pat)
    const scopeValidation = validateScope(scope)

    setPatError(patValidation)
    setScopeError(scopeValidation)
    setBackendError(null)

    if (patValidation || scopeValidation) {
      return
    }

    setIsSubmitting(true)

    const token = pat.trim()
    const trimmedScope = scope.trim()

    // Clear PAT input immediately (before next render frame)
    setPat('')
    if (patInputRef.current) {
      patInputRef.current.value = ''
    }

    try {
      const scopeArg = trimmedScope
        ? { owner: trimmedScope.split('/')[0], repo: trimmedScope.split('/')[1] }
        : undefined

      const result = await authService.loginWithPat(token, scopeArg)

      if (result.success) {
        onSuccess()
      } else {
        setBackendError(result.message)
      }
    } catch {
      setBackendError('Unable to reach the server. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
      {/* PAT input */}
      <div className="space-y-1.5">
        <label
          htmlFor="pat-input"
          className="text-sm font-medium leading-none"
        >
          Personal Access Token
        </label>
        <input
          ref={patInputRef}
          id="pat-input"
          type="password"
          maxLength={255}
          value={pat}
          onChange={(e) => {
            setPat(e.target.value)
            if (patError) setPatError(null)
            if (backendError) setBackendError(null)
          }}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          disabled={isSubmitting}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Personal Access Token"
          aria-invalid={!!patError}
          aria-describedby={patError ? 'pat-error' : undefined}
          autoComplete="off"
        />
        {patError && (
          <p id="pat-error" role="alert" className="text-xs text-destructive">
            {patError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          <a
            href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Learn how to create a Personal Access Token
          </a>
        </p>
        <p className="text-xs text-muted-foreground">
          Required permission: <strong>Contents — Read-only</strong> on the target repository.
          For fine-grained tokens, select "Only select repositories" and grant "Contents" read access.
          For classic tokens, enable the <strong>repo</strong> scope.
        </p>
      </div>

      {/* Repository scope input */}
      <div className="space-y-1.5">
        <label
          htmlFor="scope-input"
          className="text-sm font-medium leading-none"
        >
          Repository scope{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="scope-input"
          type="text"
          maxLength={256}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value)
            if (scopeError) setScopeError(null)
            if (backendError) setBackendError(null)
          }}
          placeholder="owner/repo"
          disabled={isSubmitting}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Repository scope"
          aria-invalid={!!scopeError}
          aria-describedby={scopeError ? 'scope-error' : 'scope-helper'}
        />
        {scopeError && (
          <p id="scope-error" role="alert" className="text-xs text-destructive">
            {scopeError}
          </p>
        )}
        <p id="scope-helper" className="text-xs text-muted-foreground">
          Optional. Restricts this session to a specific repository. Fine-grained tokens already provide server-side scoping.
        </p>
      </div>

      {/* Backend error */}
      {backendError && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {backendError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={isSubmitDisabled}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Authenticating…
            </span>
          ) : (
            'Sign in with PAT'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
