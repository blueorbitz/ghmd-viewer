import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/ThemeProvider'

interface MermaidDiagramRendererProps {
  code: string
  enabled: boolean
  /** Timeout in ms for rendering. Defaults to 5000. Exposed for testing. */
  renderTimeout?: number
}

type RenderState =
  | { status: 'idle' }
  | { status: 'rendering' }
  | { status: 'success'; svg: string }
  | { status: 'error'; message: string }

let diagramIdCounter = 0
function getUniqueDiagramId(): string {
  diagramIdCounter += 1
  return `mermaid-diagram-${diagramIdCounter}`
}

const RENDER_TIMEOUT_MS = 5000

async function loadMermaid(theme: 'light' | 'dark') {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
  })
  return mermaid
}

export function MermaidDiagramRenderer({ code, enabled, renderTimeout = RENDER_TIMEOUT_MS }: MermaidDiagramRendererProps) {
  const [renderState, setRenderState] = useState<RenderState>({ status: 'idle' })
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef(false)
  const { effectiveTheme } = useTheme()

  useEffect(() => {
    if (!enabled) {
      setRenderState({ status: 'idle' })
      return
    }

    abortRef.current = false
    setRenderState({ status: 'rendering' })

    const diagramId = getUniqueDiagramId()

    const renderPromise = (async () => {
      const mermaid = await loadMermaid(effectiveTheme)
      const { svg } = await mermaid.render(diagramId, code)
      return svg
    })()

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Mermaid rendering timed out after 5 seconds')), renderTimeout)
    })

    Promise.race([renderPromise, timeoutPromise])
      .then((svg) => {
        if (!abortRef.current) {
          setRenderState({ status: 'success', svg })
        }
      })
      .catch((error: unknown) => {
        if (!abortRef.current) {
          const message = error instanceof Error ? error.message : 'Unknown rendering error'
          setRenderState({ status: 'error', message })
        }
      })

    return () => {
      abortRef.current = true
    }
  }, [code, enabled, renderTimeout, effectiveTheme])

  // When disabled, show raw source code
  if (!enabled) {
    return (
      <pre className="overflow-x-auto rounded-md border bg-muted p-4">
        <code className="text-sm">{code}</code>
      </pre>
    )
  }

  // Rendering in progress
  if (renderState.status === 'rendering' || renderState.status === 'idle') {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted p-4">
        <span className="text-sm text-muted-foreground">Rendering diagram...</span>
      </div>
    )
  }

  // Render error: show error message + raw source
  if (renderState.status === 'error') {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          <strong>Mermaid rendering error:</strong> {renderState.message}
        </div>
        <pre className="overflow-x-auto rounded-md border bg-muted p-4">
          <code className="text-sm">{code}</code>
        </pre>
      </div>
    )
  }

  // Success: render SVG
  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-md border bg-white p-4 dark:bg-gray-900"
      dangerouslySetInnerHTML={{ __html: renderState.svg }}
    />
  )
}
