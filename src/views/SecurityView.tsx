import { useEffect, useState } from 'react'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { Header } from '@/components/Header'

type LoadState =
  | { status: 'loading' }
  | { status: 'success'; content: string }
  | { status: 'error'; message: string }

export function SecurityView() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}SECURITY.md`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load security documentation (${res.status})`)
        return res.text()
      })
      .then((content) => setState({ status: 'success', content }))
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [])

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">Security</h1>
        {state.status === 'loading' && (
          <p className="text-muted-foreground">Loading security documentation...</p>
        )}
        {state.status === 'error' && (
          <p className="text-destructive" role="alert">{state.message}</p>
        )}
        {state.status === 'success' && (
          <MarkdownRenderer
            content={state.content}
            basePath=""
            owner=""
            repo=""
            branch=""
            isPrivate={false}
            mermaidEnabled={true}
            onNavigate={() => {}}
          />
        )}
      </main>
    </div>
  )
}
