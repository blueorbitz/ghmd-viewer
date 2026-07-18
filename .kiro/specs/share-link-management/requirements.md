# Requirements Document

## Introduction

This feature adds share link management capabilities to the GitHub Markdown Viewer application. Currently, share links are created via `POST /api/share/create` but users have no way to view, list, or revoke them after creation. The system needs a per-user share manifest keyed by GitHub user ID to track share links across sessions, and a UI for authenticated users to manage their active share links.

## Glossary

- **Share_Link_Manager**: The backend subsystem responsible for tracking, listing, and revoking share links associated with a user.
- **Share_Manifest**: A per-user encrypted JSON file keyed by GitHub_User_ID that indexes all share links created by the user, stored in `backend/sessions/`. The manifest persists across login sessions because it is associated with the user identity, not a session token.
- **Parent_Session**: The authenticated user session (OAuth or PAT) from which share links are created.
- **Scoped_Session**: A restricted session file created during share link creation, limited to a specific owner/repo/branch/path.
- **Share_Entry**: A metadata record in the Share_Manifest describing one share link, including its scope, creation time, expiration, token hash, and auth_method.
- **Share_Management_View**: The frontend React view where authenticated users can browse and manage their share links.
- **API_Router**: The PHP entry point (`backend/public/index.php`) that dispatches requests to route handlers.
- **GitHub_User_ID**: The numeric user ID returned by `GET https://api.github.com/user`, used as the stable persistent identity key for associating share manifests with users across sessions.
- **Identity_Resolver**: The backend component responsible for fetching and caching the GitHub user ID during authentication flows.

## Requirements

### Requirement 1: User Identity Resolution

**User Story:** As an authenticated user, I want the system to identify me by my GitHub user ID, so that my share links persist across logout and re-login cycles.

#### Acceptance Criteria

1. WHEN a user completes OAuth login via the callback, THE Identity_Resolver SHALL fetch the GitHub user ID by calling `GET https://api.github.com/user` with the obtained access token.
2. WHEN a user logs in with a PAT via `POST /api/auth/pat`, THE Identity_Resolver SHALL fetch the GitHub user ID by calling `GET https://api.github.com/user` with the provided PAT.
3. WHEN the Identity_Resolver receives a valid response from `GET https://api.github.com/user`, THE Identity_Resolver SHALL extract the numeric `id` field and store it in the session data as `github_user_id`.
4. IF the `GET https://api.github.com/user` request fails or returns an invalid response, THEN THE Identity_Resolver SHALL still create the session but omit the `github_user_id` field from session data.
5. THE session data SHALL include the `github_user_id` field alongside the existing `installation_token`, `auth_method`, `created_at`, and `expires_at` fields.
6. THE Share_Link_Manager SHALL use the `github_user_id` from session data as the key for locating and creating Share_Manifest files.

### Requirement 2: Share Manifest Creation and Association

**User Story:** As an authenticated user, I want the system to track which share links I create, so that I can later view and manage them.

#### Acceptance Criteria

1. WHEN a user creates a share link via `POST /api/share/create`, THE Share_Link_Manager SHALL record a Share_Entry in the Share_Manifest keyed by the user's GitHub_User_ID.
2. THE Share_Entry SHALL contain the scoped session token hash, scope (owner, repo, branch, path), creation timestamp, expiration timestamp, and auth_method indicating whether the share was created from an OAuth or PAT session.
3. IF the Share_Manifest file does not yet exist for the user's GitHub_User_ID, THEN THE Share_Link_Manager SHALL create a new Share_Manifest file.
4. THE Share_Manifest SHALL be encrypted at rest using the same AES-256-GCM scheme used for session files.
5. IF the session does not contain a `github_user_id` (due to failed identity resolution), THEN THE Share_Link_Manager SHALL return HTTP 503 with an error message indicating that share management is temporarily unavailable.

### Requirement 3: List Share Links

**User Story:** As an authenticated user, I want to see a list of all my active share links, so that I can review what content I am sharing and with whom.

#### Acceptance Criteria

1. WHEN an authenticated user requests their share links via `GET /api/shares`, THE Share_Link_Manager SHALL return a JSON array of Share_Entry objects from the user's Share_Manifest keyed by GitHub_User_ID.
2. THE response SHALL include for each Share_Entry: scope (owner, repo, branch, path), created_at timestamp, expires_at timestamp, auth_method (oauth or pat), and a status field indicating whether the link is active or expired.
3. IF a Share_Entry has an expires_at timestamp in the past, THEN THE Share_Link_Manager SHALL mark the entry status as "expired" in the response.
4. IF the user has no Share_Manifest or the manifest is empty, THEN THE Share_Link_Manager SHALL return an empty JSON array.
5. IF the request lacks a valid session cookie, THEN THE Share_Link_Manager SHALL return HTTP 401 with an error message.

### Requirement 4: Revoke Share Links

**User Story:** As an authenticated user, I want to revoke individual share links I have created, so that I can stop sharing content when it is no longer appropriate.

#### Acceptance Criteria

1. WHEN an authenticated user sends a `POST /api/shares/revoke` request with a share identifier, THE Share_Link_Manager SHALL delete the corresponding Scoped_Session file from disk.
2. WHEN a Scoped_Session is deleted, THE Share_Link_Manager SHALL remove the corresponding Share_Entry from the user's Share_Manifest.
3. IF the share identifier does not correspond to an entry in the user's Share_Manifest, THEN THE Share_Link_Manager SHALL return HTTP 404 with an error message.
4. IF the request lacks a valid session cookie, THEN THE Share_Link_Manager SHALL return HTTP 401 with an error message.
5. WHEN a revocation succeeds, THE Share_Link_Manager SHALL return HTTP 200 with a confirmation JSON response.

### Requirement 5: Share Management Frontend View

**User Story:** As an authenticated user, I want a dedicated view in the application to browse and manage my share links, so that I can easily find and revoke links from the UI.

#### Acceptance Criteria

1. THE Share_Management_View SHALL be accessible via the hash route `#/shares`.
2. WHEN the Share_Management_View loads, THE Share_Management_View SHALL fetch the list of share links from `GET /api/shares` and display them.
3. THE Share_Management_View SHALL display each share link with its scope (owner/repo/branch/path), creation date, expiration date, active/expired status, and auth method label ("App" for oauth, "PAT" for pat).
4. WHEN the user clicks a revoke action on a share link entry, THE Share_Management_View SHALL send a revoke request to `POST /api/shares/revoke` and remove the entry from the displayed list upon success.
5. IF the share list is empty, THEN THE Share_Management_View SHALL display a message indicating no active share links exist.
6. IF the user is not authenticated, THEN THE Share_Management_View SHALL redirect the user to the input view.

### Requirement 6: Authentication and Authorization Guards

**User Story:** As the system operator, I want share management endpoints to be protected by authentication, so that only the owner of the shares can view or revoke them.

#### Acceptance Criteria

1. THE API_Router SHALL require a valid session_token cookie for `GET /api/shares` and `POST /api/shares/revoke` endpoints.
2. THE API_Router SHALL require the `X-Requested-With: XMLHttpRequest` header on `POST /api/shares/revoke` to prevent CSRF attacks.
3. IF a session_token cookie corresponds to a Scoped_Session (not a Parent_Session), THEN THE Share_Link_Manager SHALL return HTTP 403, because scoped sessions do not own shares.
4. THE Share_Link_Manager SHALL only return or modify Share_Entries that belong to the authenticated user's own Share_Manifest, identified by GitHub_User_ID.

### Requirement 7: Expired Entry Cleanup

**User Story:** As the system operator, I want expired share entries to be cleaned up automatically, so that disk space is not consumed indefinitely by stale metadata.

#### Acceptance Criteria

1. WHEN the Share_Link_Manager reads a Share_Manifest, THE Share_Link_Manager SHALL remove any Share_Entry whose corresponding Scoped_Session file no longer exists on disk.
2. WHEN a Scoped_Session is purged by the existing probabilistic cleanup in SessionManager, THE Share_Link_Manager SHALL treat the corresponding Share_Entry as expired on next read.
3. WHEN all entries in a Share_Manifest are expired or removed, THE Share_Link_Manager SHALL delete the manifest file from disk.
