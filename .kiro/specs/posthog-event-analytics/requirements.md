# Requirements Document

## Introduction

This document defines the requirements for integrating PostHog event analytics into the ghmd-viewer application. The integration captures user interactions across the frontend (React/TypeScript) to provide insights into feature usage, navigation patterns, authentication flows, and content engagement. PostHog is initialized client-side and events are sent directly to the PostHog cloud or self-hosted instance.

## Glossary

- **Analytics_Service**: The frontend service module responsible for initializing PostHog and exposing methods to capture events.
- **PostHog_Client**: The PostHog JavaScript SDK instance (`posthog-js`) used to track events and identify users.
- **Event**: A named action with optional properties sent to PostHog representing a user interaction.
- **Page_View**: An event captured when the user navigates to a different view within the application.
- **User_Identity**: A pseudonymous or authenticated identifier associated with tracked events for session continuity.
- **Feature_Flag**: A PostHog feature flag that can enable or disable analytics collection at runtime.

## Requirements

### Requirement 1: PostHog SDK Initialization

**User Story:** As a developer, I want the PostHog SDK to initialize when the application loads, so that analytics events can be captured from the start of each session.

#### Acceptance Criteria

1. WHEN the application mounts, THE Analytics_Service SHALL initialize the PostHog_Client with the API key from `VITE_POSTHOG_KEY` and the host URL from `VITE_POSTHOG_HOST` before any user-initiated event capturing occurs.
2. THE Analytics_Service SHALL read the PostHog API key from the `VITE_POSTHOG_KEY` environment variable.
3. THE Analytics_Service SHALL read the PostHog host URL from the `VITE_POSTHOG_HOST` environment variable.
4. IF the `VITE_POSTHOG_KEY` environment variable is empty or undefined, THEN THE Analytics_Service SHALL skip initialization and provide no-op stub methods for all event capture calls so that calling code executes without errors and no events are transmitted.
5. IF the `VITE_POSTHOG_HOST` environment variable is empty or undefined, THEN THE Analytics_Service SHALL skip initialization and provide no-op stub methods for all event capture calls so that calling code executes without errors and no events are transmitted.
6. THE Analytics_Service SHALL set the PostHog configuration option `autocapture` for pageviews to disabled (capture_pageview: false).
7. IF the `VITE_POSTHOG_SESSION_RECORDING` environment variable is set to `"true"` (case-sensitive string comparison), THEN THE Analytics_Service SHALL enable session recording in the PostHog configuration.
8. IF the `VITE_POSTHOG_SESSION_RECORDING` environment variable is absent, empty, or set to any value other than `"true"`, THEN THE Analytics_Service SHALL disable session recording in the PostHog configuration.

### Requirement 2: Page View Tracking

**User Story:** As a product owner, I want to know which views users visit, so that I can understand navigation patterns and popular features.

#### Acceptance Criteria

1. WHEN the user navigates to the InputView, THE Analytics_Service SHALL capture a `page_viewed` event with property `page` set to `"input"`.
2. WHEN the user navigates to the ReaderView, THE Analytics_Service SHALL capture a `page_viewed` event with properties `page` set to `"reader"`, `owner` set to the route's owner segment, `repo` set to the route's repo segment, and `branch` set to the route's branch segment.
3. WHEN the user navigates to the ShareManagementView, THE Analytics_Service SHALL capture a `page_viewed` event with property `page` set to `"share_management"`.
4. WHEN the user navigates to the SecurityView, THE Analytics_Service SHALL capture a `page_viewed` event with property `page` set to `"security"`.
5. WHEN the user navigates to the OAuthCallbackView, THE Analytics_Service SHALL capture a `page_viewed` event with property `page` set to `"oauth_callback"`.
6. WHEN the user navigates to the SharePassphrasePrompt view, THE Analytics_Service SHALL capture a `page_viewed` event with property `page` set to `"share_redeem"`.
7. WHEN a hash change resolves to the same view type and same route parameters as the current view, THE Analytics_Service SHALL NOT capture a duplicate `page_viewed` event.
8. THE Analytics_Service SHALL capture each `page_viewed` event exactly once per hash-change navigation, regardless of component re-renders.

### Requirement 3: Authentication Event Tracking

**User Story:** As a product owner, I want to understand how users authenticate, so that I can optimize the login experience and measure conversion.

#### Acceptance Criteria

1. WHEN the user initiates GitHub OAuth login, THE Analytics_Service SHALL capture a `login_started` event with property `method` set to `"oauth"` within 1 second of the initiation action.
2. WHEN OAuth authentication completes successfully, THE Analytics_Service SHALL capture a `login_completed` event with property `method` set to `"oauth"` within 1 second of the backend confirming the session.
3. WHEN the user submits a Personal Access Token, THE Analytics_Service SHALL capture a `login_started` event with property `method` set to `"pat"` within 1 second of the submission action.
4. WHEN PAT authentication completes successfully, THE Analytics_Service SHALL capture a `login_completed` event with property `method` set to `"pat"` within 1 second of the backend confirming the session.
5. IF OAuth or PAT authentication fails, THEN THE Analytics_Service SHALL capture a `login_failed` event with property `method` set to `"oauth"` or `"pat"` respectively, and property `error_type` set to one of: `"state_mismatch"`, `"exchange_failed"`, `"cancelled"`, or `"pat_login_failed"`.
6. WHEN the user logs out, THE Analytics_Service SHALL capture a `logged_out` event with property `method` indicating the authentication method used in the ending session.
7. WHEN authentication completes successfully, THE Analytics_Service SHALL call `posthog.identify()` with the user's GitHub user ID hashed using SHA-256 to link sessions without exposing personal data.
8. IF the analytics endpoint is unreachable or the event capture fails, THEN THE Analytics_Service SHALL silently discard the event without blocking or delaying the authentication flow.

### Requirement 4: Repository Browsing Event Tracking

**User Story:** As a product owner, I want to track how users browse repositories, so that I can understand content consumption patterns.

#### Acceptance Criteria

1. WHEN the user submits a GitHub URL on the InputView and navigation to the ReaderView is triggered, THE Analytics_Service SHALL capture a `repo_opened` event with properties `owner` (string), `repo` (string), `branch` (string), and `is_private` (boolean).
2. WHEN the user selects a file in the Sidebar, THE Analytics_Service SHALL capture a `file_viewed` event with properties `file_type` (one of `markdown` or `pdf`), `file_path` (repo-relative path of the selected file), and `repo` (string).
3. WHEN the user expands a directory in the Sidebar and the directory children are successfully loaded, THE Analytics_Service SHALL capture a `directory_expanded` event with properties `directory_path` (repo-relative path of the expanded directory) and `repo` (string).
4. WHEN the user clicks a relative markdown link inside the MarkdownRenderer and in-app navigation is triggered, THE Analytics_Service SHALL capture a `link_navigated` event with properties `target_path` (repo-relative path of the navigation target) and `repo` (string).
5. IF the Analytics_Service fails to capture an event, THEN THE system SHALL silently discard the failure without interrupting the user's browsing workflow.
6. THE Analytics_Service SHALL capture each event within 1 second of the triggering user action.

### Requirement 5: Share Link Event Tracking

**User Story:** As a product owner, I want to track share link usage, so that I can measure collaboration patterns and feature adoption.

#### Acceptance Criteria

1. WHEN the user creates a share link successfully, THE Analytics_Service SHALL capture a `share_link_created` event with properties `expires_in_hours` (integer, 1–720) and `auth_method` (either `"oauth"` or `"pat"`).
2. WHEN the user successfully copies a generated share link to the clipboard, THE Analytics_Service SHALL capture a `share_link_copied` event.
3. WHEN a recipient redeems a share link successfully (backend returns authenticated scope), THE Analytics_Service SHALL capture a `share_link_redeemed` event.
4. IF share link creation fails due to a backend or encryption error, THEN THE Analytics_Service SHALL capture a `share_link_failed` event with property `error_type` set to one of: `"auth_required"`, `"session_expired"`, `"validation_error"`, `"server_error"`, or `"encryption_error"`.
5. WHEN the user revokes a share link, THE Analytics_Service SHALL capture a `share_link_revoked` event.
6. IF share link redemption fails, THEN THE Analytics_Service SHALL capture a `share_link_redeem_failed` event with property `error_type` set to one of: `"expired"`, `"invalid_passphrase"`, `"invalid_token"`, or `"rate_limited"`.

### Requirement 6: Error Event Tracking

**User Story:** As a developer, I want to track application errors, so that I can identify and fix issues affecting users.

#### Acceptance Criteria

1. WHEN a content fetch error occurs in the ReaderView, THE Analytics_Service SHALL capture an `error_occurred` event with properties `error_type` set to the AppError `type` value (e.g., `"network"`, `"not_found"`, `"rate_limited"`, `"auth_required"`), `context` set to `"content_fetch"`, and `message` set to the AppError `message` string.
2. WHEN the ErrorBoundary catches an unhandled React error, THE Analytics_Service SHALL capture an `error_occurred` event with properties `error_type` set to `"unhandled"`, `component` set to the string `"ErrorBoundary"`, and `message` set to the first 256 characters of the caught Error's `message` property.
3. WHEN a sidebar directory discovery fails, THE Analytics_Service SHALL capture an `error_occurred` event with properties `error_type` set to the AppError `type` value, `context` set to `"sidebar_discovery"`, and `message` set to the AppError `message` string.
4. IF the Analytics_Service fails to capture an event, THEN THE Analytics_Service SHALL silently discard the event without throwing an exception or affecting application functionality.

### Requirement 7: Privacy and Data Protection

**User Story:** As a user, I want my privacy respected, so that analytics do not collect personally identifiable information without my awareness.

#### Acceptance Criteria

1. THE Analytics_Service SHALL NOT include GitHub usernames, email addresses, or Personal Access Tokens in any event property values, whether in plain text, base64-encoded, or URL-encoded form.
2. THE Analytics_Service SHALL NOT include filesystem paths, directory names, or file names in event properties; only the `owner` and `repo` segments extracted from GitHub URL paths are permitted as location identifiers.
3. IF `navigator.doNotTrack` is set to `"1"` at the time of Analytics_Service initialization, THEN THE Analytics_Service SHALL suppress all event capture calls and SHALL NOT send any network requests to the PostHog endpoint for the duration of the session.
4. WHEN PostHog initialization is skipped due to missing configuration or DNT being enabled, THE Analytics_Service SHALL provide no-op stub methods for `capture`, `identify`, and `reset` that execute without throwing errors and produce no network requests.
5. THE Analytics_Service SHALL use PostHog persistence mode `"localStorage+cookie"` to maintain session continuity without third-party cookie reliance.
