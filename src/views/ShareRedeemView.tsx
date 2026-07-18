import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseShareLink, decryptPayload, isExpired } from '@/services/share-service'
import { navigateToHash } from '@/services/url-state'
import { createAuthService, AUTH_STORAGE_KEY } from '@/services/auth-service'
import type { ShareLinkPayload } from '@/types/share'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 60_000 // 60 seconds

interface ShareRedeemViewProps {
  /** The raw base64url-encoded payload from the URL hash (after #/share/) */
  payload: string
}

/**
 * ShareRedeemView — Recipient view for redeeming a share link.
 * Parses the payload, checks expiry, prompts for passphrase, decrypts, and redirects.
 * Implements retry logic: max 5 attempts, 60-second lockout after exhaustion.
 *
 * Requirements: 6.5, 6.7, 6.9
 */
export function ShareRedeemView({ payload }: ShareRedeemViewProps) {
  const [passphrase, setPassphrase] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)

  // Parse the payload once
  const parsedPayload: ShareLinkPayload | null = useMemo(() => {
    // Reconstruct the full hash format that parseShareLink expects
    return parseShareLink(`#/share/${payload}`)
  }, [payload])

  // Check expiry
  const expired = parsedPayload ? isExpired(parsedPayload) : false

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutEnd === null) return

    function tick() {
      const remaining = Math.max(0, (lockoutEnd as number) - Date.now())
      setLockoutRemaining(remaining)
      if (remaining <= 0) {
        setLockoutEnd(null)
        setAttempts(0)
        setError(null)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [lockoutEnd])

  const isLockedOut = lockoutEnd !== null && lockoutRemaining > 0
  const attemptsRemaining = MAX_ATTEMPTS - attempts

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!parsedPayload || isLockedOut || isDecrypting) return

      setError(null)
      setIsDecrypting(true)

      try {
        const result = await decryptPayload(parsedPayload, passphrase)

        if (result.success) {
          // Decryption succeeded — redeem the scoped token on the backend to set the session cookie
          const authService = createAuthService()
          const backendUrl = authService.getBackendUrl()

          if (backendUrl) {
            try {
              const redeemResponse = await fetch(`${backendUrl}/api/share/redeem`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ scopedToken: result.sessionToken }),
              })

              if (!redeemResponse.ok) {
                const data = await redeemResponse.json().catch(() => ({}))
                const newAttempts = attempts + 1
                setAttempts(newAttempts)
                setPassphrase('')
                setError(data.error || 'Failed to redeem share token. It may have expired.')
                return
              }
            } catch {
              setError('Network error while redeeming share token.')
              return
            }
          }

          // Navigate to the reader view with the repo info
          localStorage.setItem(AUTH_STORAGE_KEY, 'true')
          navigateToHash({
            owner: parsedPayload.owner,
            repo: parsedPayload.repo,
            branch: parsedPayload.branch,
            folderPath: parsedPayload.path,
          })
        } else {
          // Decryption failed — wrong passphrase
          const newAttempts = attempts + 1
          setAttempts(newAttempts)
          setPassphrase('')

          if (newAttempts >= MAX_ATTEMPTS) {
            // Lockout
            setLockoutEnd(Date.now() + LOCKOUT_DURATION_MS)
            setError('Too many failed attempts. Please wait 60 seconds before trying again.')
          } else {
            setError(
              `Invalid passphrase. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`
            )
          }
        }
      } catch {
        setError('An unexpected error occurred during decryption.')
      } finally {
        setIsDecrypting(false)
      }
    },
    [parsedPayload, passphrase, attempts, isLockedOut, isDecrypting]
  )

  // Invalid payload
  if (!parsedPayload) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Invalid Share Link</h1>
          <p className="text-sm text-muted-foreground">
            This share link is malformed or corrupted. Please check the URL and try again.
          </p>
        </div>
      </div>
    )
  }

  // Expired link
  if (expired) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <svg
              className="w-6 h-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Link Expired</h1>
          <p className="text-sm text-muted-foreground">
            This shared link has expired and is no longer valid.
          </p>
        </div>
      </div>
    )
  }

  // Passphrase prompt
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">Enter Passphrase</h1>
          <p className="text-sm text-muted-foreground">
            This content is protected. Enter the passphrase to access{' '}
            <span className="font-medium text-foreground">
              {parsedPayload.owner}/{parsedPayload.repo}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="redeem-passphrase" className="sr-only">
              Passphrase
            </label>
            <input
              id="redeem-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase"
              disabled={isLockedOut || isDecrypting}
              autoComplete="off"
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {isLockedOut && (
            <p className="text-sm text-muted-foreground text-center">
              Try again in {Math.ceil(lockoutRemaining / 1000)} seconds
            </p>
          )}

          {!isLockedOut && attempts > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!passphrase || isLockedOut || isDecrypting}
          >
            {isDecrypting ? 'Decrypting…' : 'Unlock'}
          </Button>
        </form>
      </div>
    </div>
  )
}
