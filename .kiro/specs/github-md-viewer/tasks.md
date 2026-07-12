# Implementation Plan: GitHub Markdown Viewer

## Overview

Implement a React + TypeScript SPA (Vite) that fetches and renders Markdown files from GitHub repository folders. The app supports public repos (static frontend only) and private repos (via a PHP backend handling GitHub App OAuth). It features a navigation sidebar, dark/light themes via shadcn/ui, Mermaid diagram rendering, and passphrase-encrypted shareable links using the Web Crypto API.

## Tasks

- [ ] 1. Set up project structure and core configuration
  - [ ] 1.1 Initialize Vite + React + TypeScript project with shadcn/ui
    - Initialize a Vite project with `pnpm create vite` using the React + TypeScript template
    - Install dependencies with pnpm: `pnpm add react react-dom tailwindcss shadcn/ui lucide-react`
    - Configure Tailwind CSS with shadcn/ui theme support (dark mode via class strategy)
    - Set up path aliases in tsconfig and vite.config
    - Create base directory structure: `src/components/`, `src/services/`, `src/views/`, `src/types/`, `src/lib/`
    - _Requirements: 12.1, 12.2, 11.6_

  - [ ] 1.2 Define core TypeScript interfaces and types
    - Create `src/types/github.ts` with `ParsedGitHubUrl`, `GitHubContentItem`, `RepoAccessResult`, `GitHubContentsResponse`
    - Create `src/types/auth.ts` with `AuthResult`, `AuthService` interface
    - Create `src/types/share.ts` with `ShareLinkParams`, `ShareLinkPayload`, `DecryptResult`
    - Create `src/types/app.ts` with `AppError`, `FileTreeNode`, `ThemePreference`
    - _Requirements: 1.2, 6.3, 7.2, 11.1_

  - [ ] 1.3 Set up hash-based routing and app shell
    - Implement a lightweight hash router (no library needed) or use a hash-aware router
    - Create `App.tsx` with `ThemeProvider` wrapper and route handling for: InputView, ReaderView, OAuthCallbackView, SharePassphrasePrompt
    - Set up URL hash state encoding/decoding: `#/{owner}/{repo}/{branch}/{path}?file={filePath}`
    - _Requirements: 12.3, 13.1, 13.3, 13.4_

  - [ ] 1.4 Set up Vitest and testing infrastructure
    - Install testing dependencies with pnpm: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom fast-check jsdom`
    - Configure vitest.config.ts with jsdom environment
    - Create `tests/` directory structure: `tests/unit/`, `tests/components/`, `tests/integration/`
    - _Requirements: (testing infrastructure)_

- [ ] 2. Implement URL parsing and GitHub service
  - [ ] 2.1 Implement GitHub URL parser
    - Create `src/services/github-url-parser.ts`
    - Parse URLs in format `https://github.com/{owner}/{repo}/tree/{branch}/{path}`
    - Handle edge cases: branch names with slashes (use GitHub API to resolve ambiguity), missing segments, non-GitHub URLs
    - Return `ParsedGitHubUrl | null`
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 2.2 Write property tests for URL parser
    - **Property 1: URL Parsing Round-Trip**
    - **Property 2: Invalid URL Rejection**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.7**

  - [ ] 2.3 Implement GitHubService for public repository access
    - Create `src/services/github-service.ts`
    - Implement `fetchPublicContents()` — GET `/repos/{owner}/{repo}/contents/{path}?ref={branch}`
    - Implement `checkRepoAccess()` — determine public/private/not-found
    - Implement `fetchFileContent()` — fetch raw markdown content
    - Implement markdown file filtering (case-insensitive `.md` extension match)
    - Handle GitHub API errors: 404 → not found, 403 with rate-limit headers → rate limited
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_

  - [ ]* 2.4 Write property test for markdown file filtering
    - **Property 3: Case-Insensitive Markdown File Filtering**
    - **Validates: Requirements 2.2**

  - [ ] 2.5 Implement recursive markdown file discovery
    - Add `discoverMarkdownFiles()` to GitHubService
    - Recursively traverse directories up to 10 levels deep
    - Build `FileTreeNode[]` structure from discovered files
    - Support both public (direct API) and private (proxy) modes
    - _Requirements: 2.5, 7.2_

  - [ ]* 2.6 Write property tests for recursive discovery and file tree building
    - **Property 4: Recursive Discovery Depth Limit**
    - **Property 12: File Tree Hierarchy Correctness**
    - **Validates: Requirements 2.5, 7.2**

- [ ] 3. Checkpoint - Core services verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement theme management and UI shell
  - [ ] 4.1 Implement ThemeManager service
    - Create `src/services/theme-manager.ts`
    - Implement three-mode cycle: light → dark → system → light
    - Persist preference to localStorage key `ghmd-theme`
    - Detect OS preference via `prefers-color-scheme` media query
    - Handle invalid localStorage values (fallback to system, remove invalid entry)
    - Apply theme by toggling `dark` class on document root
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 4.2 Write property tests for ThemeManager
    - **Property 16: Theme Preference Cycle**
    - **Property 17: Theme Persistence and Invalid Fallback**
    - **Validates: Requirements 11.1, 11.3, 11.5**

  - [ ] 4.3 Implement Header component with theme and Mermaid toggles
    - Create `src/components/Header.tsx`
    - Add theme toggle button (cycles light/dark/system with icon changes)
    - Add Mermaid rendering toggle (on/off switch)
    - Persist Mermaid toggle state to localStorage key `ghmd-mermaid-enabled`
    - _Requirements: 10.2, 10.3, 11.1, 11.6_

  - [ ]* 4.4 Write property test for Mermaid toggle persistence
    - **Property 15: Mermaid Toggle Persistence**
    - **Validates: Requirements 10.3**

- [ ] 5. Implement InputView and URL state management
  - [ ] 5.1 Implement InputView component
    - Create `src/views/InputView.tsx`
    - Text input field for GitHub folder URL with submit button
    - Enter key submission support
    - Disable submit when input is empty or whitespace-only
    - Display error messages for invalid URLs
    - Display error when URL points to a file rather than a folder
    - Show loading state while checking repo access
    - _Requirements: 1.1, 1.3, 1.5, 1.6, 1.7_

  - [ ] 5.2 Implement URL hash state management
    - Create `src/services/url-state.ts`
    - Encode state: `#/{owner}/{repo}/{branch}/{folderPath}?file={relativeMdFilePath}`
    - Decode state from hash on app load
    - Listen for `hashchange` events for browser back/forward navigation
    - Handle invalid hash parameters (show error, offer URL input)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 5.3 Write property test for URL hash state round-trip
    - **Property 18: URL Hash State Round-Trip**
    - **Validates: Requirements 13.1**

- [ ] 6. Implement Sidebar and ReaderView layout
  - [ ] 6.1 Implement Sidebar component
    - Create `src/components/Sidebar.tsx`
    - Display file tree structure with expandable/collapsible folders
    - Highlight currently active file
    - Handle responsive behavior: hidden below 768px, accessible via hamburger menu
    - Show "no Markdown files found" message when tree is empty
    - Loading state while files are being discovered
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 6.2 Implement ReaderView layout
    - Create `src/views/ReaderView.tsx`
    - Compose Sidebar + ContentArea + Header
    - Wire file selection from sidebar to content fetching
    - Update URL hash when file is selected
    - Handle loading and error states for content area
    - Display loading indicator while directory contents are being fetched
    - _Requirements: 7.3, 2.8, 13.1_

- [ ] 7. Implement Markdown rendering
  - [ ] 7.1 Implement MarkdownRenderer component
    - Create `src/components/MarkdownRenderer.tsx`
    - Use react-markdown with remark-gfm plugin for GFM support (tables, task lists, strikethrough, autolinks)
    - Install and configure rehype-highlight or shiki for syntax highlighting of fenced code blocks using `pnpm add rehype-highlight` (or `pnpm add shiki`)
    - Render headings (h1-h6), lists, blockquotes, horizontal rules, inline formatting
    - Code blocks without language identifier render as plain monospace
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 7.2 Implement link resolution in MarkdownRenderer
    - Relative `.md` links → in-app navigation (call `onNavigate` prop)
    - External links (absolute URLs) → open in new tab with `target="_blank"` and `rel="noopener noreferrer"`
    - _Requirements: 8.6, 8.7_

  - [ ]* 7.3 Write property test for link classification
    - **Property 13: Link Classification and Resolution**
    - **Validates: Requirements 8.6, 8.7**

  - [ ] 7.4 Implement ImageResolver for Markdown images
    - Create `src/components/ImageResolver.tsx` or integrate into MarkdownRenderer custom image component
    - Resolve relative image paths to `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{resolvedPath}` for public repos
    - Route through Auth_Backend proxy for private repos
    - Absolute image URLs rendered directly
    - Show placeholder with alt text on load failure (10s timeout)
    - Show generic "broken image" placeholder when no alt text
    - Handle 401 from proxy (show placeholder, trigger re-auth prompt)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 7.5 Write property test for image URL resolution
    - **Property 14: Image URL Resolution**
    - **Validates: Requirements 9.1, 9.2, 9.5**

  - [ ] 7.6 Implement MermaidDiagramRenderer
    - Create `src/components/MermaidDiagramRenderer.tsx`
    - Lazy-load mermaid.js library
    - Render mermaid code blocks as SVG when enabled
    - Show raw source code when Mermaid rendering is disabled
    - Handle syntax errors (show error message + raw source)
    - Implement 5-second rendering timeout (abort and show error + raw source)
    - _Requirements: 10.1, 10.4, 10.5, 10.6_

- [ ] 8. Checkpoint - Frontend rendering verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Auth service and OAuth flow
  - [ ] 9.1 Implement AuthService (frontend)
    - Create `src/services/auth-service.ts`
    - Implement `initiateOAuth()` — redirect to GitHub authorization page with client_id, redirect_uri, state (CSRF token)
    - Implement `handleOAuthCallback()` — process callback, validate state
    - Implement `isAuthenticated()` — check session status via backend
    - Implement `logout()` — POST to `/api/auth/logout`, clear session
    - Implement `isPrivateAccessAvailable()` — check if backend URL is configured
    - Hide private-repo features when backend URL not configured
    - _Requirements: 3.2, 3.3, 3.7, 3.8, 3.9, 5.3, 12.4, 12.5_

  - [ ] 9.2 Implement OAuthCallbackView
    - Create `src/views/OAuthCallbackView.tsx`
    - Handle the OAuth redirect callback from GitHub
    - Display loading state during token exchange
    - Handle error states (cancelled, state mismatch, exchange failed)
    - Redirect to original repo URL after successful auth
    - _Requirements: 3.4, 3.8, 3.9_

  - [ ] 9.3 Implement private repo content fetching via proxy
    - Add `fetchPrivateContents()` to GitHubService
    - Route requests through `/api/proxy/contents/{owner}/{repo}/{path}?ref={branch}`
    - Route raw file fetches through `/api/proxy/raw/{owner}/{repo}/{path}?ref={branch}`
    - Handle 401 responses (session expired → show re-auth prompt)
    - Handle installation access errors (show link to GitHub App settings)
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 4.4_

- [ ] 10. Implement PHP Auth Backend
  - [ ] 10.1 Set up PHP backend project structure
    - Create `backend/` directory with: `public/index.php` (entry point/router), `src/` for classes, `.env.example`
    - Configure routing for API endpoints: `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/auth/status`, `/api/proxy/contents/...`, `/api/proxy/raw/...`
    - Set up environment variable loading for GitHub App secrets (client_id, client_secret, private_key path, app_id)
    - Implement CORS headers for SPA cross-origin requests
    - _Requirements: 4.1, 4.2, 12.5_

  - [ ] 10.2 Implement OAuth callback handler
    - Create endpoint `GET /api/auth/callback`
    - Validate CSRF state parameter against stored state
    - Exchange authorization code for installation access token via GitHub API
    - Generate random Session_Token with 1-hour expiry
    - Store session in server-side store (file-based, no database required)
    - Set httpOnly, Secure, SameSite=Strict cookie with Max-Age=3600
    - Redirect back to SPA with original hash state
    - Return 400 on code exchange failure
    - _Requirements: 4.1, 4.3, 4.5, 4.8, 5.1, 5.2_

  - [ ]* 10.3 Write property test for session token expiry
    - **Property 5: Session Token Expiry Constraint**
    - **Validates: Requirements 4.3**

  - [ ] 10.4 Implement GitHub API proxy endpoint
    - Create endpoint `GET /api/proxy/contents/{owner}/{repo}/{path}`
    - Validate Session_Token from cookie on every request
    - Return 401 if token is invalid or expired
    - Forward request to GitHub API with installation access token
    - Forward GitHub API error status codes and messages
    - Implement 30-second timeout for upstream requests
    - _Requirements: 4.4, 4.6, 4.7, 4.9, 5.5_

  - [ ] 10.5 Implement login initiation and logout endpoints
    - Create `GET /api/auth/login` — generate CSRF state, store it, redirect to GitHub OAuth authorization URL
    - Create `POST /api/auth/logout` — validate Session_Token, invalidate session, clear cookie
    - Create `GET /api/auth/status` — return current auth status (authenticated/not)
    - _Requirements: 3.2, 5.3, 5.4_

- [ ] 11. Implement Share service (client-side crypto)
  - [ ] 11.1 Implement ShareService with Web Crypto API
    - Create `src/services/share-service.ts`
    - Implement `createShareLink()` — encrypt session info with AES-GCM using PBKDF2-derived key from passphrase
    - Implement `parseShareLink()` — extract encrypted payload from URL hash (`#/share/{base64url-payload}`)
    - Implement `decryptPayload()` — derive key from passphrase, decrypt with AES-GCM
    - Implement `isExpired()` — check expiresAt timestamp vs current time
    - Validate passphrase minimum length (8 characters)
    - Validate expiration range (1-720 hours)
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9_

  - [ ]* 11.2 Write property tests for ShareService
    - **Property 6: Passphrase Length Validation**
    - **Property 7: Share Link Structure Round-Trip**
    - **Property 8: Encryption/Decryption Round-Trip**
    - **Property 9: Wrong Passphrase Decryption Failure**
    - **Property 10: Expiration Range Validation**
    - **Property 11: Expiration Timestamp Check**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9**

  - [ ] 11.3 Implement SharePassphrasePrompt views
    - Create `src/views/ShareCreateView.tsx` — prompt for passphrase (min 8 chars) + expiry selection, generate link
    - Create `src/views/ShareRedeemView.tsx` — prompt recipient for passphrase, decrypt, fetch content
    - Implement retry logic: max 5 attempts, 60-second lockout after exhaustion
    - Provide "Create Share Link" button in ReaderView when viewing private repos (only when backend is configured)
    - _Requirements: 6.1, 6.2, 6.5, 6.7, 6.8, 6.9, 12.4_

- [ ] 12. Checkpoint - Full feature integration verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Error handling, edge cases, and final integration
  - [ ] 13.1 Implement centralized error handling
    - Create `src/components/ErrorDisplay.tsx` — render errors with retry actions
    - Implement React Error Boundary around ContentArea
    - Map GitHub API status codes to AppError types
    - Implement retry with exponential backoff (max 3 attempts) for network errors
    - Ensure Sidebar and Header remain functional when content rendering fails
    - Clear private content display on session expiry (redirect to auth prompt)
    - _Requirements: 2.3, 2.4, 2.7, 3.7, 5.7, 13.5_

  - [ ] 13.2 Wire all components together and verify end-to-end flows
    - Connect InputView → repo access check → route to ReaderView (public) or Auth prompt (private)
    - Connect ReaderView → Sidebar file selection → MarkdownRenderer
    - Connect OAuth flow → redirect → callback → session → private content access
    - Connect Share creation → URL generation → recipient redemption flow
    - Verify browser back/forward navigation works correctly
    - Ensure build produces static files (HTML, CSS, JS) with no server-side runtime dependency
    - _Requirements: 1.5, 3.1, 12.1, 12.2, 12.3, 13.4_

- [ ] 14. Final checkpoint - All features integrated and tested
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The PHP backend (task 10) can be developed in parallel with frontend features
- shadcn/ui components should be used for all UI elements (buttons, inputs, toggles, dialogs)
- All frontend services should be testable in isolation (dependency injection via props/context)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "4.1", "10.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "4.2", "4.3", "10.2"] },
    { "id": 4, "tasks": ["2.4", "2.5", "4.4", "5.1", "5.2", "10.4", "10.5"] },
    { "id": 5, "tasks": ["2.6", "5.3", "6.1", "6.2", "9.1", "10.3"] },
    { "id": 6, "tasks": ["7.1", "9.2", "9.3", "11.1"] },
    { "id": 7, "tasks": ["7.2", "7.4", "7.6", "11.2", "11.3"] },
    { "id": 8, "tasks": ["7.3", "7.5"] },
    { "id": 9, "tasks": ["13.1", "13.2"] }
  ]
}
```
