import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string // raw code text to copy
}

export function CopyButton({ text }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleCopy = useCallback(async () => {
    // Clear any existing timer (handles re-click during confirmation)
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
      timerRef.current = setTimeout(() => {
        setStatus('idle')
        timerRef.current = null
      }, 2000)
    } catch {
      // Silent failure — revert to idle without success indicator
      setStatus('idle')
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy code to clipboard"
      className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {status === 'copied' ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}
