import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { fetchShares, revokeShare, ShareApiError } from '@/services/share-api'
import type { ShareEntry } from '@/services/share-api'

type ViewState =
  | { status: 'loading' }
  | { status: 'success'; entries: ShareEntry[] }
  | { status: 'error'; message: string }

export function ShareManagementView() {
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetchShares()
      .then((entries) => setState({ status: 'success', entries }))
      .catch((err) => {
        if (err instanceof ShareApiError && err.statusCode === 401) {
          window.location.hash = ''
          return
        }
        if (err instanceof ShareApiError && err.statusCode === 503) {
          setState({
            status: 'error',
            message: 'Share management is temporarily unavailable. Try logging out and back in.',
          })
          return
        }
        setState({ status: 'error', message: err.message || 'Failed to load shares' })
      })
  }, [])

  const handleRevoke = async (tokenHash: string) => {
    setRevoking(tokenHash)
    try {
      await revokeShare(tokenHash)
      setState((prev) => {
        if (prev.status !== 'success') return prev
        return { status: 'success', entries: prev.entries.filter((e) => e.token_hash !== tokenHash) }
      })
    } catch (err) {
      if (err instanceof ShareApiError && err.statusCode === 401) {
        window.location.hash = ''
        return
      }
      if (err instanceof ShareApiError && err.statusCode === 404) {
        // Already revoked — remove from list
        setState((prev) => {
          if (prev.status !== 'success') return prev
          return { status: 'success', entries: prev.entries.filter((e) => e.token_hash !== tokenHash) }
        })
        return
      }
      // Show a brief error but don't crash the view
      console.error('Failed to revoke share:', err)
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">Shared Links</h1>

        {state.status === 'loading' && (
          <p className="text-muted-foreground">Loading shared links...</p>
        )}

        {state.status === 'error' && (
          <div
            className="rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200"
            role="alert"
          >
            {state.message}
          </div>
        )}

        {state.status === 'success' && state.entries.length === 0 && (
          <p className="text-muted-foreground">No shared links yet.</p>
        )}

        {state.status === 'success' && state.entries.length > 0 && (
          <div className="space-y-3">
            {state.entries.map((entry) => (
              <ShareEntryCard
                key={entry.token_hash}
                entry={entry}
                isRevoking={revoking === entry.token_hash}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ShareEntryCard({
  entry,
  isRevoking,
  onRevoke,
}: {
  entry: ShareEntry
  isRevoking: boolean
  onRevoke: (tokenHash: string) => void
}) {
  const scopeLabel = `${entry.scope.owner}/${entry.scope.repo}/${entry.scope.branch}/${entry.scope.path}`
  const createdDate = new Date(entry.created_at * 1000).toLocaleDateString()
  const expiresDate = new Date(entry.expires_at * 1000).toLocaleDateString()
  const authLabel = entry.auth_method === 'oauth' ? 'App' : 'PAT'
  const isExpired = entry.status === 'expired'

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-mono text-sm text-foreground" title={scopeLabel}>
          {scopeLabel}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Created: {createdDate}</span>
          <span>Expires: {expiresDate}</span>
          <span className="font-medium">{authLabel}</span>
          {isExpired ? (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Expired
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900 dark:text-green-200">
              Active
            </span>
          )}
        </div>
      </div>

      {!isExpired && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRevoke(entry.token_hash)}
          disabled={isRevoking}
          aria-label={`Revoke share link for ${scopeLabel}`}
          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
