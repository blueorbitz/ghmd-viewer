# Implementation Plan: Security Endpoint

## Overview

Add a `#/security` hash route that renders a static `SECURITY.md` file from the `public/` folder. This involves extending the route type, updating the router, creating a new view component, and writing the security documentation content with an embedded Mermaid DFD. The implementation uses TypeScript with React, Vite, and Vitest.

## Tasks

- [ ] 1. Add security route type and parsing
  - [ ] 1.1 Extend the Route type and parseHash function in `src/services/url-state.ts`
    - Add `{ type: 'security' }` variant to the `Route` union type
    - Add an exact-match check for `/security` in `parseHash`, placed before the reader route logic
    - Ensure only the exact string `/security` triggers the route (not `/securityx` or `/security/foo`)
    - _Requirements: 1.1_

  - [ ]* 1.2 Write property tests for security route parsing in `tests/unit/url-state-security.test.ts`
    - **Property 1: Security route parsing is exact-match only**
    - Use fast-check to generate arbitrary suffixes and verify strings like `/securityX` or `/security/Y` never parse to `{ type: 'security' }`
    - **Validates: Requirements 1.1**

  - [ ]* 1.3 Write property test for existing route non-regression
    - **Property 2: Existing routes are unaffected by security route addition**
    - Use fast-check to generate valid reader route hashes (4+ segments) and verify they still parse as `reader` type
    - Verify OAuth callback and share routes still parse correctly
    - **Validates: Requirements 1.1**

- [ ] 2. Create SecurityView component and wire routing
  - [ ] 2.1 Create `src/views/SecurityView.tsx`
    - Implement the SecurityView component that fetches `/SECURITY.md` on mount
    - Use a loading/success/error state machine pattern (`loading | success | error`)
    - Render content using `MarkdownRenderer` with `mermaidEnabled={true}`
    - Include a page heading (`<h1>`) identifying the page as security documentation
    - Display error message with `role="alert"` on fetch failure
    - Include the `Header` component for consistent navigation
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4_

  - [ ] 2.2 Add security route case to AppRouter in `src/App.tsx`
    - Import `SecurityView` from `@/views/SecurityView`
    - Add `case 'security': return <SecurityView />` to the route switch
    - _Requirements: 1.2_

- [ ] 3. Checkpoint
  - Ensure the app builds without TypeScript errors (`tsc -b && vite build`). Ask the user if questions arise.

- [ ] 4. Create SECURITY.md content file
  - [ ] 4.1 Create `public/SECURITY.md` with security documentation
    - Write an overview section introducing the security architecture
    - Document the GitHub App OAuth flow: authorization redirect → code exchange → session creation
    - Document the PAT authentication option: token validation against GitHub API → session creation
    - Explain tokens are stored server-side only, never accessible to the frontend
    - Explain the backend proxy pattern: adds tokens to GitHub API requests on behalf of the user
    - Document session cookie properties: httpOnly, Secure, SameSite
    - Document SHA-256 hashed session identifiers stored server-side
    - Document CORS protection restricting cross-origin requests to the configured frontend origin
    - Document CSRF protection via required custom header on POST requests
    - Document rate limiting on authentication endpoints
    - Include a Mermaid flowchart DFD with ≤ 10 nodes showing Browser, Backend Proxy, GitHub API, Session Store, and Session Cookie data flow
    - Ensure NO secrets, API keys, file paths, internal directory structures, or implementation-specific bypass vectors are exposed
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

  - [ ]* 4.2 Write property test for content safety of SECURITY.md
    - **Property 3: Security content contains no internal implementation details**
    - Read `public/SECURITY.md` and verify no line contains patterns exposing internals: `/src/`, `/routes/`, `__DIR__`, `.php`, `aes-256-gcm`, `sess_*.json`, `hex-encoded 32-byte`, `/api/auth/callback`
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 4.3 Write property test for DFD node count
    - **Property 4: Data Flow Diagram node count is bounded**
    - Parse the Mermaid code block from `public/SECURITY.md` and count distinct node definitions
    - Verify total node count ≤ 10
    - **Validates: Requirements 5.5**

- [ ] 5. Final checkpoint
  - Ensure the app builds successfully, the `#/security` route renders correctly, the Mermaid diagram displays as SVG, and all tests pass (`pnpm test`). Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The project uses TypeScript with React 19, Vite 8, Vitest 4, and fast-check 4 for property-based testing
- `MarkdownRenderer` and `MermaidDiagramRenderer` already exist — no new rendering logic needed
- The `SECURITY.md` file is served statically from Vite's `public/` directory at `/SECURITY.md`
- No backend changes are required for this feature
- Property tests validate correctness properties from the design document
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["4.2", "4.3"] }
  ]
}
```
