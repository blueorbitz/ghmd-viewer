import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HashState } from '@/services/url-state'
import { navigateToHash } from '@/services/url-state'
import { discoverSupportedFilesShallow, fetchDirectoryChildren, fetchFileContent, fetchPublicContents, fetchPrivateContents, fetchPrivateFileContent, fetchPdfContent, fetchPrivatePdfContent } from '@/services/github-service'
import { getFileType } from '@/lib/file-type'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { PdfViewer } from '@/components/PdfViewer'
import { useMermaid } from '@/components/MermaidProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import { ShareCreateView } from '@/views/ShareCreateView'
import { Button } from '@/components/ui/button'
import { createAuthService } from '@/services/auth-service'
import { mapErrorToAppError } from '@/services/error-mapper'
import { fetchWithRetry } from '@/services/retry'
import type { FileTreeNode, AppError } from '@/types/app'

interface ReaderViewProps {
  state: HashState
}

/**
 * ReaderView — Main reading layout with sidebar navigation and content area.
 * Composes Header, Sidebar, and ContentArea.
 * Handles directory discovery, file selection, and content fetching.
 */
export function ReaderView({ state }: ReaderViewProps) {
  const { owner, repo, branch, folderPath, file } = state

  // Get mermaid enabled state from context (provided by App-level MermaidProvider)
  const { mermaidEnabled } = useMermaid()

  // Sidebar file tree state
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [isSidebarLoading, setIsSidebarLoading] = useState(true)
  const [sidebarError, setSidebarError] = useState<AppError | null>(null)

  // Content area state
  const [content, setContent] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [contentError, setContentError] = useState<AppError | null>(null)

  // Retry counter — incrementing this re-triggers the content fetch effect
  const [fetchRetryCount, setFetchRetryCount] = useState(0)

  // Share link dialog state
  const [showShareDialog, setShowShareDialog] = useState(false)

  // Track whether content is from a private repo
  const [isPrivate, setIsPrivate] = useState(false)

  // Auth service (memoized)
  const authService = useMemo(() => createAuthService(), [])

  // Show "Create Share Link" button only when backend is configured, user is authenticated, and not in a scoped session
  const canShare = authService.isPrivateAccessAvailable() && authService.isAuthenticated() && !authService.isScopedSession()

  // Determine if we should use private access (backend configured + user authenticated)
  const usePrivateAccess = authService.isPrivateAccessAvailable() && authService.isAuthenticated()

  // Active file path (relative to repo root)
  const activeFilePath = file ? `${folderPath}/${file}` : null

  // Derive file type from selected file's extension
  const fileType = file ? getFileType(file) : null

  // Discover supported files on mount or when repo/folder changes (shallow — top-level only)
  useEffect(() => {
    let cancelled = false

    async function discover() {
      setIsSidebarLoading(true)
      setSidebarError(null)
      setFileTree([])

      try {
        // Choose fetch function based on auth state
        const fetchFn = usePrivateAccess
          ? (o: string, r: string, p: string, b: string) => fetchPrivateContents(o, r, p, b)
          : (o: string, r: string, p: string, b: string) => fetchPublicContents(o, r, p, b)

        // Shallow discovery — only fetches the immediate directory contents
        const tree = await fetchWithRetry(() =>
          discoverSupportedFilesShallow(owner, repo, folderPath, branch, fetchFn),
        )

        if (!cancelled) {
          setFileTree(tree)
          setIsPrivate(usePrivateAccess)
          setIsSidebarLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setSidebarError(mapErrorToAppError(err))
          setIsSidebarLoading(false)
        }
      }
    }

    discover()
    return () => { cancelled = true }
  }, [owner, repo, branch, folderPath, usePrivateAccess])

  // Fetch file content when file changes — with retry for network errors
  useEffect(() => {
    if (!file) {
      setContent(null)
      setPdfData(null)
      setContentError(null)
      return
    }

    let cancelled = false

    async function loadContent() {
      // Clear previous content state when switching files
      setContent(null)
      setPdfData(null)
      setIsContentLoading(true)
      setContentError(null)

      try {
        const filePath = `${folderPath}/${file}`
        const currentFileType = file ? getFileType(file) : null

        if (currentFileType === 'pdf') {
          // Fetch PDF binary content
          const arrayBuffer = await fetchWithRetry(() => {
            if (usePrivateAccess) {
              return fetchPrivatePdfContent(owner, repo, filePath, branch)
            } else {
              return fetchPdfContent(owner, repo, filePath, branch)
            }
          })

          if (!cancelled) {
            setPdfData(new Uint8Array(arrayBuffer))
            setContent(null)
            setIsContentLoading(false)
          }
        } else if (currentFileType === 'markdown') {
          // Fetch text content for markdown
          const text = await fetchWithRetry(() => {
            if (usePrivateAccess) {
              return fetchPrivateFileContent(owner, repo, filePath, branch)
            } else {
              return fetchFileContent(owner, repo, filePath, branch)
            }
          })

          if (!cancelled) {
            setContent(text)
            setPdfData(null)
            setIsContentLoading(false)
          }
        } else {
          // Unsupported file type — don't fetch, clear both
          if (!cancelled) {
            setContent(null)
            setPdfData(null)
            setIsContentLoading(false)
          }
        }
      } catch (err) {
        if (!cancelled) {
          const appError = mapErrorToAppError(err)

          // Clear private content on session expiry (auth_required) — Requirement 5.7
          if (appError.type === 'auth_required') {
            setContent(null)
            setPdfData(null)
          }

          setContentError(appError)
          setIsContentLoading(false)
        }
      }
    }

    loadContent()
    return () => { cancelled = true }
  }, [owner, repo, branch, folderPath, file, usePrivateAccess, fetchRetryCount])

  // Handle file selection from sidebar — update URL hash
  const handleFileSelect = useCallback(
    (filePath: string) => {
      // filePath is repo-relative (e.g., "docs/guide/intro.md")
      // We need to extract the relative path from the folder root
      const prefix = folderPath + '/'
      const relativePath = filePath.startsWith(prefix)
        ? filePath.slice(prefix.length)
        : filePath

      navigateToHash({
        owner,
        repo,
        branch,
        folderPath,
        file: relativePath,
      })
    },
    [owner, repo, branch, folderPath],
  )

  // Handle in-app navigation from markdown links
  const handleNavigate = useCallback(
    (resolvedPath: string) => {
      // resolvedPath is repo-relative (e.g., "docs/guides/intro.md")
      // Extract relative path from folderPath root
      const prefix = folderPath + '/'
      const relativePath = resolvedPath.startsWith(prefix)
        ? resolvedPath.slice(prefix.length)
        : resolvedPath

      navigateToHash({
        owner,
        repo,
        branch,
        folderPath,
        file: relativePath,
      })
    },
    [owner, repo, branch, folderPath],
  )

  // Handle lazy-loading a directory's children when expanded in the sidebar
  const handleDirectoryExpand = useCallback(
    async (dirPath: string): Promise<FileTreeNode[]> => {
      const fetchFn = usePrivateAccess
        ? (o: string, r: string, p: string, b: string) => fetchPrivateContents(o, r, p, b)
        : (o: string, r: string, p: string, b: string) => fetchPublicContents(o, r, p, b)

      const children = await fetchWithRetry(() =>
        fetchDirectoryChildren(owner, repo, dirPath, branch, fetchFn),
      )
      return children
    },
    [owner, repo, branch, usePrivateAccess],
  )

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <Header />

      {/* Share Link Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <ShareCreateView
              owner={owner}
              repo={repo}
              branch={branch}
              path={folderPath}
              onClose={() => setShowShareDialog(false)}
            />
          </div>
        </div>
      )}

      {/* Main content area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          fileTree={fileTree}
          activeFilePath={activeFilePath}
          onFileSelect={handleFileSelect}
          onDirectoryExpand={handleDirectoryExpand}
          isLoading={isSidebarLoading}
        />

        {/* Content Area wrapped in ErrorBoundary */}
        <ErrorBoundary>
          <main className="flex-1 overflow-y-auto p-6">
            {/* Create Share Link button — only shown when backend is configured and authenticated */}
            {canShare && (
              <div className="mb-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareDialog(true)}
                >
                  <svg
                    className="mr-1 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Create Share Link
                </Button>
              </div>
            )}

            {sidebarError && !file && (
              <ErrorDisplay
                error={sidebarError}
                onRetry={() => {
                  // Re-trigger sidebar discovery by clearing error
                  setSidebarError(null)
                  navigateToHash({ owner, repo, branch, folderPath, file: file ?? undefined })
                }}
                onAuthenticate={() => {
                  authService.initiateOAuth(window.location.hash)
                }}
                onNewUrl={() => {
                  window.location.hash = ''
                }}
              />
            )}

            {isContentLoading && <LoadingIndicator />}

            {contentError && (
              <ErrorDisplay
                error={contentError}
                onRetry={() => {
                  // Trigger a refetch by incrementing the retry counter
                  setContentError(null)
                  setContent(null)
                  setPdfData(null)
                  setFetchRetryCount((c) => c + 1)
                }}
                onAuthenticate={() => {
                  authService.initiateOAuth(window.location.hash)
                }}
                onNewUrl={() => {
                  // Navigate back to the input view
                  window.location.hash = ''
                }}
              />
            )}

            {!isContentLoading && !contentError && !file && !isSidebarLoading && !sidebarError && (
              <EmptyState />
            )}

            {!isContentLoading && !contentError && fileType === 'pdf' && pdfData !== null && (
              <PdfViewer
                data={pdfData}
                filename={file!}
                downloadUrl={
                  isPrivate
                    ? `${authService.getBackendUrl()}/api/proxy/raw/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${activeFilePath}?ref=${encodeURIComponent(branch)}`
                    : `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${activeFilePath}`
                }
              />
            )}

            {!isContentLoading && !contentError && fileType === 'markdown' && content !== null && (
              <MarkdownRenderer
                content={content}
                basePath={activeFilePath ? activeFilePath.split('/').slice(0, -1).join('/') : folderPath}
                owner={owner}
                repo={repo}
                branch={branch}
                isPrivate={isPrivate}
                mermaidEnabled={mermaidEnabled}
                onNavigate={handleNavigate}
              />
            )}

            {!isContentLoading && !contentError && fileType === 'unsupported' && file && (
              <UnsupportedFileMessage filename={file} />
            )}
          </main>
        </ErrorBoundary>
      </div>
    </div>
  )
}

/** Loading spinner indicator */
function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-12" role="status" aria-label="Loading content">
      <svg
        className="h-6 w-6 animate-spin text-muted-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" strokeLinecap="round" />
      </svg>
      <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
    </div>
  )
}

/** Empty state when no file is selected */
function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12 text-center">
      <div>
        <p className="text-lg font-medium text-foreground">Select a file</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a supported file from the sidebar to view its content.
        </p>
      </div>
    </div>
  )
}

/** Unsupported file type message */
function UnsupportedFileMessage({ filename }: { filename: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-center">
      <div>
        <p className="text-lg font-medium text-foreground">Unsupported file type</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The file &ldquo;{filename}&rdquo; has an unsupported format. Only Markdown (.md) and PDF (.pdf) files can be viewed.
        </p>
      </div>
    </div>
  )
}
