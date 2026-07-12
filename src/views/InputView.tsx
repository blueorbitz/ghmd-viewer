import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { parseGitHubUrl } from '@/services/github-url-parser'
import { fetchPublicContents } from '@/services/github-service'
import { navigateToHash } from '@/services/url-state'

/**
 * InputView — The landing page where users paste a GitHub folder URL.
 *
 * Validates the URL format, checks repository accessibility, and navigates
 * to the reader view for public repos or prompts authentication for private repos.
 */
export function InputView() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isSubmitDisabled = !url.trim() || isLoading

  async function handleSubmit() {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    setError(null)
    setIsLoading(true)

    try {
      // Step 1: Parse the URL
      const parsed = parseGitHubUrl(trimmedUrl)
      if (!parsed) {
        setError(
          'Invalid URL format. Expected: https://github.com/{owner}/{repo}/tree/{branch}/{path}',
        )
        setIsLoading(false)
        return
      }

      // Step 2: Try to fetch the folder contents directly.
      // The GitHub Contents API (/repos/{owner}/{repo}/contents/{path}) supports CORS,
      // unlike the /repos/{owner}/{repo} endpoint which may be blocked.
      // If it succeeds, the repo is public and the path is a valid folder.
      try {
        await fetchPublicContents(parsed.owner, parsed.repo, parsed.path, parsed.branch)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.includes('directory listing but received a file response')) {
          setError('The URL points to a file, not a folder. Please provide a folder URL.')
          setIsLoading(false)
          return
        }
        if (message.includes('Folder not found')) {
          setError('Repository or folder not found. Check the URL, or it may be a private repository.')
          setIsLoading(false)
          return
        }
        if (message.includes('rate limit')) {
          setError('GitHub API rate limit reached. Please try again later or authenticate for higher limits.')
          setIsLoading(false)
          return
        }
        setError(message)
        setIsLoading(false)
        return
      }

      // Step 3: Navigate to reader view
      navigateToHash({
        owner: parsed.owner,
        repo: parsed.repo,
        branch: parsed.branch,
        folderPath: parsed.path,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !isSubmitDisabled) {
      handleSubmit()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-xl space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">GitHub Markdown Viewer</h1>
          <p className="text-muted-foreground mt-2">
            Paste a GitHub folder URL to browse and read Markdown files
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/owner/repo/tree/main/docs"
            disabled={isLoading}
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="GitHub folder URL"
            aria-invalid={!!error}
            aria-describedby={error ? 'url-error' : undefined}
          />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            aria-label="Submit URL"
          >
            {isLoading ? (
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
                Checking…
              </span>
            ) : (
              'Open'
            )}
          </Button>
        </div>

        {error && (
          <p
            id="url-error"
            role="alert"
            className="text-sm text-destructive text-left"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
