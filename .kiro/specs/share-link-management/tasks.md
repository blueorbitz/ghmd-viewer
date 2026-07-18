# Implementation Plan: Share Link Management

## Overview

This plan implements the share link management lifecycle: identity resolution during auth, a per-user encrypted share manifest, list/revoke API endpoints, and a frontend management view. The implementation uses PHP for backend routes and TypeScript/React for the frontend, building on the existing file-based session architecture and AES-256-GCM encryption.

## Tasks

- [x] 1. Implement Identity Resolution
  - [x] 1.1 Add `resolveGitHubUserId()` helper function and integrate into OAuth callback
    - Create a shared helper function in `backend/src/routes/` (or inline) that calls `GET https://api.github.com/user` with an access token and returns the numeric `id` or `null`
    - Modify `backend/src/routes/auth_callback.php` to call `resolveGitHubUserId()` after token exchange and store `github_user_id` in session data
    - Handle failure gracefully: if the call fails, session is still created without `github_user_id`
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 1.2 Integrate identity resolution into PAT login
    - Modify `backend/src/routes/auth_pat_login.php` to call `resolveGitHubUserId()` after PAT validation and store `github_user_id` in session data
    - Handle failure gracefully: session created without `github_user_id` on failure
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement ShareLinkManager class
  - [x] 2.1 Create `ShareLinkManager` class with manifest path computation and read/write methods
    - Create `backend/src/ShareLinkManager.php` with constructor accepting `SessionManager` and optional sessions directory
    - Implement `getManifestPath(int $githubUserId): string` using `manifest_{sha256(string(github_user_id))}.json`
    - Implement `readManifest(int $githubUserId): array` that decrypts and returns entries, performing orphan cleanup (removing entries whose session file no longer exists)
    - Implement `writeManifest(int $githubUserId, array $entries): void` that encrypts and writes to disk
    - Delete manifest file from disk when all entries are removed
    - Use AES-256-GCM encryption consistent with `SessionManager`
    - _Requirements: 1.6, 2.3, 2.4, 7.1, 7.2, 7.3_

  - [x] 2.2 Implement `recordShare()` method
    - Add `recordShare(int $githubUserId, array $shareEntry): void` to `ShareLinkManager`
    - The share entry must include: token_hash, scope (owner, repo, branch, path), created_at, expires_at, auth_method
    - Read existing manifest (or create new), add entry keyed by token_hash, write back
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Implement `listShares()` method
    - Add `listShares(int $githubUserId): array` to `ShareLinkManager`
    - Read manifest, compute status for each entry: "active" if `expires_at >= now` AND session file exists, "expired" otherwise
    - Return array of entries with computed status field
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.4 Implement `revokeShare()` method
    - Add `revokeShare(int $githubUserId, string $tokenHash): bool` to `ShareLinkManager`
    - Delete the corresponding scoped session file from disk
    - Remove the entry from the manifest
    - Return `true` if entry existed and was revoked, `false` if not found
    - _Requirements: 4.1, 4.2_

  - [ ]* 2.5 Write property test for manifest path determinism
    - **Property 1: Manifest path determinism**
    - **Validates: Requirements 1.6**

  - [ ]* 2.6 Write property test for record-then-list round trip
    - **Property 2: Record-then-list round trip**
    - **Validates: Requirements 2.1, 3.1**

  - [ ]* 2.7 Write property test for status computation correctness
    - **Property 4: Status computation correctness**
    - **Validates: Requirements 3.3**

  - [ ]* 2.8 Write property test for revocation completeness
    - **Property 5: Revocation completeness**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.9 Write property test for orphan cleanup on read
    - **Property 8: Orphan cleanup on read**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 2.10 Write property test for empty manifest deletion
    - **Property 9: Empty manifest deletion**
    - **Validates: Requirements 7.3**

- [x] 3. Integrate ShareLinkManager into share creation flow
  - [x] 3.1 Modify `share_create.php` to record share entries in the manifest
    - After creating the scoped session, instantiate `ShareLinkManager` and call `recordShare()`
    - Compute the token_hash (SHA-256 of the scoped token) for the share entry
    - Include scope, timestamps, and auth_method from the parent session
    - If session lacks `github_user_id`, return HTTP 503 with appropriate error
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 4. Implement share management API routes
  - [x] 4.1 Create `GET /api/shares` route handler (`share_list.php`)
    - Validate session cookie, reject with 401 if missing/invalid
    - Reject scoped sessions with 403
    - Check for `github_user_id` in session, return 503 if absent
    - Call `ShareLinkManager::listShares()` and return JSON array
    - Return empty array if no manifest exists
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.3_

  - [x] 4.2 Create `POST /api/shares/revoke` route handler (`share_revoke.php`)
    - Validate session cookie, reject with 401 if missing/invalid
    - Reject scoped sessions with 403
    - Validate `X-Requested-With: XMLHttpRequest` header (handled globally by router, but verify)
    - Parse `token_hash` from request body
    - Call `ShareLinkManager::revokeShare()`, return 404 if not found, 200 with `{"revoked": true}` on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3_

  - [x] 4.3 Register new routes in `backend/public/index.php`
    - Add `GET /api/shares` route pointing to `share_list.php`
    - Add `POST /api/shares/revoke` route pointing to `share_revoke.php`
    - _Requirements: 6.1_

  - [ ]* 4.4 Write property test for scoped session rejection
    - **Property 6: Scoped session rejection**
    - **Validates: Requirements 6.3**

  - [ ]* 4.5 Write property test for user isolation
    - **Property 7: User isolation**
    - **Validates: Requirements 6.4**

- [x] 5. Checkpoint - Ensure backend is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement frontend share management
  - [x] 6.1 Create share API service (`src/services/share-api.ts`)
    - Define `ShareEntry` interface with token_hash, scope, created_at, expires_at, auth_method, status fields
    - Implement `fetchShares(): Promise<ShareEntry[]>` calling `GET /api/shares` with credentials
    - Implement `revokeShare(tokenHash: string): Promise<void>` calling `POST /api/shares/revoke` with CSRF header
    - Handle error responses (401, 403, 503) appropriately
    - _Requirements: 3.1, 4.1, 5.2_

  - [x] 6.2 Add `shares` route type to URL state service
    - Update `Route` type in `src/services/url-state.ts` to include `{ type: 'shares' }`
    - Update `parseHash()` to recognize `#/shares` and return the new route type
    - _Requirements: 5.1_

  - [x] 6.3 Create `ShareManagementView` component (`src/views/ShareManagementView.tsx`)
    - Fetch share list from `GET /api/shares` on mount
    - Display each share entry with scope (owner/repo/branch/path), creation date, expiration date, status badge (active/expired), auth method label ("App" for oauth, "PAT" for pat)
    - Provide a revoke button per entry that calls `revokeShare()` and removes entry from list on success
    - Show empty state message when no shares exist
    - Handle 401 by redirecting to input view
    - Handle 503 by showing informational banner
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.4 Wire `ShareManagementView` into `App.tsx` routing
    - Import `ShareManagementView` and render it when route type is `'shares'`
    - Add navigation link to the shares view from the Header or appropriate location
    - _Requirements: 5.1, 5.2_

  - [ ]* 6.5 Write unit tests for share API service
    - Test `fetchShares()` with mocked successful response
    - Test `revokeShare()` with mocked successful response
    - Test error handling for 401, 403, 503 responses
    - _Requirements: 3.1, 4.1_

  - [ ]* 6.6 Write unit tests for ShareManagementView component
    - Test rendering with mocked share entries
    - Test empty state display
    - Test revoke button interaction
    - Test redirect on 401
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.7 Write property test for list response completeness
    - **Property 10: List response completeness**
    - **Validates: Requirements 3.2**

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses PHP with file-based encrypted sessions (AES-256-GCM)
- The frontend uses TypeScript/React with vitest + fast-check for testing
- Property-based tests should be placed in `src/__tests__/share-link-manager.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "2.6", "2.7", "2.8", "2.9", "2.10", "3.1"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["4.4", "4.5", "6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3"] },
    { "id": 7, "tasks": ["6.4", "6.5", "6.6", "6.7"] }
  ]
}
```
