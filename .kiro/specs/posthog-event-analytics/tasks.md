# Implementation Plan: PostHog Event Analytics

## Overview

Integrate PostHog event analytics into the ghmd-viewer React/TypeScript frontend by creating a singleton analytics service module, a page view tracking hook, and integrating event capture calls across views, components, and services. The implementation uses `posthog-js` as the sole SDK dependency with graceful degradation when unconfigured.

## Tasks

- [ ] 1. Install posthog-js and create core analytics service
  - [ ] 1.1 Install posthog-js SDK and create analytics service module
    - Install `posthog-js` package
    - Create `src/services/analytics-service.ts` with `AnalyticsService` interface and `createAnalyticsService` factory function
    - Implement initialization logic reading `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_SESSION_RECORDING` from `import.meta.env`
    - Implement DNT check (`navigator.doNotTrack === "1"`)
    - Implement no-op service fallback when config is missing or DNT enabled
    - Configure PostHog with `capture_pageview: false`, `capture_pageleave: true`, `persistence: "localStorage+cookie"`, and session recording toggle
    - Wrap all `capture`, `identify`, `reset` calls in try/catch for silent failure
    - Export a default singleton instance initialized with env vars
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 7.3, 7.4, 7.5_

  - [ ] 1.2 Create SHA-256 hashing utility for user identity
    - Create `src/lib/analytics-hash.ts` with `hashUserId(githubUserId: string): Promise<string>` function
    - Use `crypto.subtle.digest('SHA-256', ...)` and return hex-encoded string
    - Add fallback for non-HTTPS environments where `crypto.subtle` is unavailable
    - _Requirements: 3.7, 7.1_

  - [ ]* 1.3 Write property tests for analytics service initialization
    - **Property 1: No-op stub safety**
    - Generate random event names, property maps, and identity strings; call all methods on disabled service; assert no throws and PostHog never called
    - **Validates: Requirements 1.4, 1.5, 7.3, 7.4**

  - [ ]* 1.4 Write property tests for session recording configuration
    - **Property 2: Session recording disabled for non-"true" values**
    - Generate random non-"true" strings, verify `disable_session_recording: true` in PostHog config
    - **Validates: Requirements 1.8**

  - [ ]* 1.5 Write property tests for identity hashing
    - **Property 6: User identity is SHA-256 hashed**
    - Generate random user ID strings, verify identify is called with SHA-256 hex hash, never raw ID
    - **Validates: Requirements 3.7**

- [ ] 2. Implement page view tracking hook
  - [ ] 2.1 Create usePageViewTracking hook
    - Create `src/hooks/usePageViewTracking.ts`
    - Use existing `useHashRouter` hook output (route object) as input
    - Implement route signature computation for deduplication (route type + key params)
    - Use `useEffect` with route signature dependency to fire `page_viewed` exactly once per navigation
    - Map route types to page property values: `input`, `reader`, `share_management`, `security`, `oauth_callback`, `share_redeem`
    - Include `owner`, `repo`, `branch` properties only for reader routes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 2.2 Integrate usePageViewTracking in App.tsx
    - Import and invoke `usePageViewTracking` in `App.tsx` or the main router component, passing the current route
    - Call `analytics.init()` on app mount
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.3 Write property tests for page view deduplication
    - **Property 3: Page view deduplication**
    - Generate random routes, simulate same-route hash changes, assert single capture call per distinct route
    - **Validates: Requirements 2.7, 2.8**

  - [ ]* 2.4 Write property tests for reader page view parameters
    - **Property 4: Reader page view captures route parameters**
    - Generate random `{owner, repo, branch}` tuples, verify captured `page_viewed` event contains matching properties
    - **Validates: Requirements 2.2**

- [ ] 3. Checkpoint - Core analytics and page tracking
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement authentication event tracking
  - [ ] 4.1 Add analytics calls to OAuth login flow
    - In `OAuthCallbackView.tsx`, capture `login_started` with `method: "oauth"` when OAuth is initiated
    - Capture `login_completed` with `method: "oauth"` on successful authentication
    - Capture `login_failed` with `method: "oauth"` and appropriate `error_type` on failure
    - Call `analytics.identify()` with hashed GitHub user ID on successful login
    - _Requirements: 3.1, 3.2, 3.5, 3.7_

  - [ ] 4.2 Add analytics calls to PAT login flow
    - In `PatLoginForm.tsx`, capture `login_started` with `method: "pat"` on form submission
    - Capture `login_completed` with `method: "pat"` on successful authentication
    - Capture `login_failed` with `method: "pat"` and `error_type: "pat_login_failed"` on failure
    - Call `analytics.identify()` with hashed GitHub user ID on successful login
    - _Requirements: 3.3, 3.4, 3.5, 3.7_

  - [ ] 4.3 Add analytics call to logout flow
    - In the logout handler (auth service or Header component), capture `logged_out` with the `method` of the ending session
    - Call `analytics.reset()` to clear PostHog identity
    - _Requirements: 3.6_

  - [ ]* 4.4 Write property tests for auth failure events
    - **Property 5: Auth failure event correctness**
    - Generate from combinations of method (`"oauth"` | `"pat"`) × error_type enum, verify event properties match exactly
    - **Validates: Requirements 3.5**

  - [ ]* 4.5 Write property tests for capture resilience
    - **Property 7: Event capture resilience**
    - Generate random events, mock PostHog to throw, verify no exception escapes to caller
    - **Validates: Requirements 3.8, 4.5, 6.4**

- [ ] 5. Implement repository browsing event tracking
  - [ ] 5.1 Add repo_opened event to InputView
    - In `InputView.tsx`, capture `repo_opened` event with `owner`, `repo`, `branch`, `is_private` when user submits a GitHub URL and navigation to ReaderView is triggered
    - _Requirements: 4.1_

  - [ ] 5.2 Add file_viewed event to ReaderView
    - In `ReaderView.tsx`, capture `file_viewed` event with `file_type` (`"markdown"` | `"pdf"`), `file_path`, and `repo` when user selects a file in the sidebar
    - _Requirements: 4.2_

  - [ ] 5.3 Add directory_expanded event to Sidebar
    - In the Sidebar component, capture `directory_expanded` event with `directory_path` and `repo` when user expands a directory and children are loaded successfully
    - _Requirements: 4.3_

  - [ ] 5.4 Add link_navigated event to MarkdownRenderer
    - In `MarkdownRenderer.tsx`, capture `link_navigated` event with `target_path` and `repo` when user clicks a relative markdown link that triggers in-app navigation
    - _Requirements: 4.4_

  - [ ]* 5.5 Write property tests for browsing event fidelity
    - **Property 8: Browsing event property fidelity**
    - Generate random file paths, repo names, and directory paths; verify captured event properties match input values exactly
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 6. Checkpoint - Browsing and auth tracking
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement share link event tracking
  - [ ] 7.1 Add share link creation and failure events
    - In the share creation flow (`ShareCreateView.tsx` or share service callers), capture `share_link_created` with `expires_in_hours` and `auth_method` on success
    - Capture `share_link_failed` with appropriate `error_type` on failure
    - _Requirements: 5.1, 5.4_

  - [ ] 7.2 Add share link copied event
    - Capture `share_link_copied` event when user successfully copies a share link to clipboard
    - _Requirements: 5.2_

  - [ ] 7.3 Add share link redeem and revoke events
    - In `SharePassphrasePrompt.tsx` or `ShareRedeemView.tsx`, capture `share_link_redeemed` on successful redemption
    - Capture `share_link_redeem_failed` with appropriate `error_type` on redemption failure
    - In `ShareManagementView.tsx`, capture `share_link_revoked` when user revokes a share link
    - _Requirements: 5.3, 5.5, 5.6_

  - [ ]* 7.4 Write property tests for share error types
    - **Property 9: Share event error type correctness**
    - Generate from share failure error type enum and redemption failure error type enum; verify captured events contain matching `error_type` property
    - **Validates: Requirements 5.4, 5.6**

- [ ] 8. Implement error event tracking
  - [ ] 8.1 Add error tracking to ReaderView content fetch
    - In `ReaderView.tsx`, capture `error_occurred` with `error_type` from AppError, `context: "content_fetch"`, and `message` (truncated to 256 chars) on content fetch failure
    - _Requirements: 6.1_

  - [ ] 8.2 Add error tracking to ErrorBoundary
    - In `ErrorBoundary.tsx`, capture `error_occurred` with `error_type: "unhandled"`, `component: "ErrorBoundary"`, and `message` (first 256 chars of error message) when catching unhandled React errors
    - _Requirements: 6.2_

  - [ ] 8.3 Add error tracking to sidebar directory discovery
    - In the Sidebar component's directory fetch error handler, capture `error_occurred` with `error_type` from AppError, `context: "sidebar_discovery"`, and `message`
    - _Requirements: 6.3_

  - [ ]* 8.4 Write property tests for error message truncation
    - **Property 10: Error event message truncation**
    - Generate random strings of length 0–1000, verify `message` property is at most 256 characters
    - **Validates: Requirements 6.2**

- [ ] 9. Implement privacy safeguards
  - [ ] 9.1 Add PII filtering to analytics service
    - Ensure `file_path` and `directory_path` properties contain only repo-relative paths (no filesystem paths)
    - Ensure no event properties contain GitHub usernames, email addresses, or PAT tokens
    - Validate that `owner` and `repo` are the only location identifiers permitted
    - _Requirements: 7.1, 7.2_

  - [ ]* 9.2 Write property tests for PII protection
    - **Property 11: No PII in event properties**
    - Generate events with PII-like inputs (email patterns, `ghp_*` tokens, usernames); verify captured properties do not contain these values
    - **Validates: Requirements 7.1, 7.2**

- [ ] 10. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `posthog-js` SDK handles batching, retry, and transport internally
- All analytics code uses try/catch at the service boundary for silent failure
- Test files should follow the structure: `src/services/__tests__/analytics-service.property.test.ts`, `src/hooks/__tests__/usePageViewTracking.test.ts`, `src/lib/__tests__/analytics-hash.property.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4"] },
    { "id": 4, "tasks": ["4.4", "4.5", "5.5", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["7.4", "8.1", "8.2", "8.3", "9.1"] },
    { "id": 6, "tasks": ["8.4", "9.2"] }
  ]
}
```
