import { useSyncExternalStore } from 'react'
import { type Route, parseHash } from '@/services/url-state'

/**
 * Subscribe to hash changes and provide a reactive Route.
 */
function getHashSnapshot(): string {
  return window.location.hash
}

function subscribeToHash(callback: () => void): () => void {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useHashRouter(): Route {
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot)
  return parseHash(hash)
}
