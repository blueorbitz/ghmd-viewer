import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createShareLink } from '@/services/share-service'
import { createAuthService } from '@/services/auth-service'

const EXPIRY_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours', value: 24 },
  { label: '3 days', value: 72 },
  { label: '7 days', value: 168 },
  { label: '30 days', value: 720 },
] as const

interface ShareCreateViewProps {
  owner: string
  repo: string
  branch: string
  path: string
  onClose: () => void
}

/**
 * ShareCreateView — Form for creating an encrypted share link.
 * Prompts the user for a passphrase (min 8 chars) and expiry selection,
 * then generates a shareable URL.
 *
 * Requirements: 6.1, 6.2, 6.8
 */
export function ShareCreateView({
  owner,
  repo,
  branch,
  path,
  onClose,
}: ShareCreateViewProps) {
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [expiresInHours, setExpiresInHours] = useState(24)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const isPassphraseValid = passphrase.length >= 8
  const doPassphrasesMatch = passphrase === confirmPassphrase
  const canSubmit = isPassphraseValid && doPassphrasesMatch && !isGenerating

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isPassphraseValid) {
      setError('Passphrase must be at least 8 characters long.')
      return
    }

    if (!doPassphrasesMatch) {
      setError('Passphrases do not match.')
      return
    }

    setIsGenerating(true)

    try {
      // Step 1: Request a scoped session token from the backend
      const authService = createAuthService()
      const backendUrl = authService.getBackendUrl()
      if (!backendUrl) {
        throw new Error('Auth backend is not configured.')
      }

      const response = await fetch(`${backendUrl}/api/share/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          path,
          expiresInHours,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Failed to create scoped session (${response.status})`)
      }

      const { scopedToken } = await response.json()

      // Step 2: Encrypt the scoped token with the passphrase
      const link = await createShareLink({
        owner,
        repo,
        branch,
        path,
        sessionToken: scopedToken,
        passphrase,
        expiresInHours,
      })
      setGeneratedLink(link)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopy() {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text in the input
      const input = document.querySelector<HTMLInputElement>('[data-share-link-input]')
      if (input) {
        input.select()
      }
    }
  }

  if (generatedLink) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Share Link Created</h2>
        <p className="text-sm text-muted-foreground">
          Share this link with the recipient. They will need the passphrase you set to access the content.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={generatedLink}
            data-share-link-input
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono truncate"
            aria-label="Generated share link"
          />
          <Button onClick={handleCopy} variant="secondary" size="sm">
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <h2 className="text-lg font-semibold">Create Share Link</h2>
      <p className="text-sm text-muted-foreground">
        Create a passphrase-protected link to share this content with others.
      </p>

      <div className="rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-200">
        <strong>Note:</strong> Logging out will expire all share links created from this session.
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="share-passphrase" className="text-sm font-medium">
          Passphrase (min. 8 characters)
        </label>
        <input
          id="share-passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter a passphrase"
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {passphrase.length > 0 && passphrase.length < 8 && (
          <p className="text-xs text-muted-foreground">
            {8 - passphrase.length} more character{8 - passphrase.length !== 1 ? 's' : ''} needed
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="share-passphrase-confirm" className="text-sm font-medium">
          Confirm Passphrase
        </label>
        <input
          id="share-passphrase-confirm"
          type="password"
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
          placeholder="Confirm your passphrase"
          autoComplete="new-password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {confirmPassphrase.length > 0 && !doPassphrasesMatch && (
          <p className="text-xs text-destructive">Passphrases do not match</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="share-expiry" className="text-sm font-medium">
          Link Expiration
        </label>
        <select
          id="share-expiry"
          value={expiresInHours}
          onChange={(e) => setExpiresInHours(Number(e.target.value))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {EXPIRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isGenerating ? 'Generating…' : 'Generate Link'}
        </Button>
      </div>
    </form>
  )
}
