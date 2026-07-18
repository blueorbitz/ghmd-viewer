# Implementation Plan: Enterprise Auth Alternative (PAT Authentication)

## Overview

This plan implements Personal Access Token (PAT) authentication as an alternative to the existing GitHub App OAuth flow. The implementation covers a new backend PHP endpoint for PAT validation and session creation, enhancements to the existing SessionManager and auth status route, a new frontend login form component, and updates to the auth service. The approach reuses the existing session infrastructure so proxy routes work identically regardless of auth method.

## Tasks

- [x] 1. Backend: PAT session support and route registration
  - [x] 1.1 Extend SessionManager with `createPatSession` method
    - Add `createPatSession(string $pat, ?array $scope = null): string` method to `backend/src/SessionManager.php`
    - Store `auth_method: "pat"` in session data
    - Set `expires_at` to 24 hours from creation time
    - If `$scope` is provided, store `{ owner, repo }` in session data
    - Validate that `$pat` is non-empty and non-whitespace; throw an exception otherwise
    - Update existing `createSession` method to include `auth_method: "oauth"` (backward-compatible)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 1.2 Create PAT login route (`backend/src/routes/auth_pat_login.php`)
    - Parse and validate JSON request body (reject invalid JSON, missing/empty/non-string `token`)
    - Enforce token length limit (≤ 256 characters) — reject with HTTP 400 before any API call
    - Enforce HTTPS in production mode (check `APP_ENV === 'production'`) — reject with HTTP 400
    - Validate optional `scope` field: if present, require both non-empty `owner` and `repo`
    - Call GitHub `/user` endpoint with `Authorization: Bearer <token>` and 10-second timeout
    - On 200: create session via `SessionManager::createPatSession`, set httpOnly/Secure/SameSite=Strict cookie, return `{ "authenticated": true }`
    - On 401 from GitHub: return HTTP 401 `{ "error": "Token is invalid or expired" }`
    - On timeout/unreachable: return HTTP 502 `{ "error": "Unable to verify token: GitHub API is unreachable" }`
    - Never include the PAT value in any response body
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 6.1, 6.3, 6.4_

  - [x] 1.3 Register PAT login route in the router (`backend/public/index.php`)
    - Add route case: `$method === 'POST' && $path === '/api/auth/pat-login'`
    - Require `APP_BASE . '/src/routes/auth_pat_login.php'`
    - _Requirements: 1.1_

  - [x] 1.4 Update auth status route to include `auth_method` (`backend/src/routes/auth_status.php`)
    - When a valid session exists, include `auth_method` field from session data in the response
    - When no valid session exists, return `{ "authenticated": false }` without `auth_method`
    - Ensure backward compatibility for sessions without `auth_method` field (default to `"oauth"`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.5 Add scope enforcement to proxy routes
    - In `backend/src/routes/proxy_contents.php` and `backend/src/routes/proxy_raw.php`, check if session has a `scope` field
    - If scoped, validate that the requested owner/repo matches the session scope
    - If out of scope, return HTTP 403 `{ "error": "Session is restricted to a specific repository path" }`
    - For PAT sessions, scope only contains `owner`/`repo` (no branch/path); adjust `isWithinScope` check accordingly
    - _Requirements: 6.1, 6.2_

- [x] 2. Checkpoint - Backend implementation verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend: Auth service and types
  - [x] 3.1 Add PAT-related types to auth types (`src/types/auth.ts`)
    - Add `PatLoginRequest` interface with `token: string` and optional `scope: { owner: string; repo: string }`
    - Update `AuthStatusResponse` interface to include optional `auth_method: 'oauth' | 'pat'`
    - Add `loginWithPat` method to the `AuthService` interface
    - _Requirements: 3.4, 3.5_

  - [x] 3.2 Implement `loginWithPat` method in auth service (`src/services/auth-service.ts`)
    - Send POST to `/api/auth/pat-login` with `{ token, scope }` in the request body
    - Use `credentials: 'include'` for cookie handling
    - On success (200 with `authenticated: true`), set `localStorage` auth flag and return success
    - On 4xx/5xx, parse error message from response body and return failure
    - On network error/timeout, return failure with connectivity error message
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 5.5, 5.6_

- [x] 4. Frontend: PAT Login Form component
  - [x] 4.1 Create `PatLoginForm` component (`src/components/PatLoginForm.tsx`)
    - Render a password-masked input (`type="password"`, `maxLength={255}`) for the PAT
    - Render an optional text input (`maxLength={256}`) for repository scope in `owner/repo` format
    - Validate PAT is non-empty and not whitespace-only; disable submit when invalid
    - Validate scope format if provided: exactly one `/` separating two non-empty segments
    - Display validation error messages inline
    - Clear PAT input immediately after submission (before next render frame)
    - Call `authService.loginWithPat(token, scope?)` on submit
    - Display backend error messages on failure
    - Include a link to GitHub PAT documentation (https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
    - Display helper text next to scope field indicating it's optional and that fine-grained tokens provide server-side scoping
    - Accept `onSuccess` and `onCancel` props
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 5.4, 6.5, 6.6, 6.7_

  - [x] 4.2 Update InputView to show PAT login option (`src/views/InputView.tsx`)
    - When `showAuthPrompt` is true and private access is available, display both "Connect GitHub" (OAuth) and "Use Personal Access Token" buttons
    - Selecting PAT shows the `PatLoginForm` component inline
    - On PAT login success, re-attempt the URL fetch
    - On cancel, return to the dual-button state
    - _Requirements: 3.1_

- [x] 5. Checkpoint - Frontend implementation verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Frontend property-based and unit tests
  - [ ]* 6.1 Write property test for invalid input rejection (frontend)
    - **Property 10: Frontend whitespace-only PAT rejection**
    - Generate arbitrary whitespace-only strings and verify the submit button is disabled and no fetch call is made
    - **Validates: Requirements 3.3**

  - [ ]* 6.2 Write property test for scope format validation (frontend)
    - **Property 11: Frontend repository scope format validation**
    - Generate arbitrary strings that don't match `non-empty/non-empty` pattern and verify form shows validation error and prevents submission
    - **Validates: Requirements 6.6**

  - [ ]* 6.3 Write property test for PAT transmission security (frontend)
    - **Property 12: Frontend PAT transmission security**
    - For arbitrary valid PAT strings, verify the PAT only appears in the POST body and never in URL params, headers (other than Content-Type), or storage
    - **Validates: Requirements 5.5, 5.6**

  - [ ]* 6.4 Write property test for error display (frontend)
    - **Property 14: Frontend error display for failed PAT login**
    - For arbitrary error messages in 4xx/5xx responses, verify the error message is displayed to the user
    - **Validates: Requirements 3.6**

  - [ ]* 6.5 Write unit tests for PatLoginForm component
    - Test password masking (`type="password"`) on token input
    - Test `maxLength` attributes (255 for PAT, 256 for scope)
    - Test GitHub PAT documentation link presence and href
    - Test PAT field clearing after submission
    - Test cancel button calls `onCancel` prop
    - _Requirements: 3.2, 3.8, 5.4_

  - [ ]* 6.6 Write unit tests for auth service `loginWithPat` method
    - Test successful login updates localStorage
    - Test error responses return appropriate error messages
    - Test network error handling
    - Test request body structure (token and scope)
    - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [ ] 7. Backend integration verification
  - [ ]* 7.1 Write integration tests for PAT login flow
    - Test end-to-end PAT login with mocked GitHub API returning 200
    - Test session file creation with correct structure (`auth_method: "pat"`, 24h expiry)
    - Test scoped session creation and scope enforcement on proxy routes
    - Test logout destroys PAT session file and clears cookie
    - Test auth status returns correct `auth_method` for PAT and OAuth sessions
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 6.1, 6.2, 7.1, 7.2, 7.3_

- [x] 8. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The backend uses PHP (matching the existing backend stack) and the frontend uses TypeScript/React (matching the existing frontend stack)
- `fast-check` is already available as a dev dependency for property-based testing
- Vitest is the test runner for frontend tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "3.2"] },
    { "id": 2, "tasks": ["1.5", "4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "7.1"] }
  ]
}
```
