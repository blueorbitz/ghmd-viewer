# Bugfix Requirements Document

## Introduction

Users viewing content through a share link (scoped session) can see the share button in ReaderView, access ShareCreateView, and see the "Shares" management link in the Header. These share-related UI elements should be hidden for scoped sessions since those users are guests with limited access — they should not be able to create or manage share links. The backend already rejects share creation from scoped sessions with a 403, but the frontend still exposes the UI.

Additionally, when users with full sessions create share links, they are not informed that logging out will invalidate all share links tied to the current session. Share links use scoped sessions derived from the parent session's access token — when the parent session is destroyed on logout, these scoped sessions become orphaned and expire. Users may accidentally invalidate active share links by logging out without realizing the consequence.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user is viewing content through a scoped session (share link) THEN the system displays the "Create Share Link" button in ReaderView

1.2 WHEN a user is viewing content through a scoped session (share link) THEN the system displays the "Shares" management link in the Header

1.3 WHEN a user is viewing content through a scoped session (share link) THEN the system allows opening the ShareCreateView dialog

1.4 WHEN the backend `auth_status` endpoint responds for a scoped session THEN the system does not include scoped session information in the response, making it indistinguishable from a full session on the frontend

1.5 WHEN a user opens the ShareCreateView to create a share link THEN the system displays no warning that logging out will invalidate all share links created from the current session

### Expected Behavior (Correct)

2.1 WHEN a user is viewing content through a scoped session (share link) THEN the system SHALL hide the "Create Share Link" button in ReaderView

2.2 WHEN a user is viewing content through a scoped session (share link) THEN the system SHALL hide the "Shares" management link in the Header

2.3 WHEN a user is viewing content through a scoped session (share link) THEN the system SHALL NOT allow opening the ShareCreateView dialog

2.4 WHEN the backend `auth_status` endpoint responds for a scoped session THEN the system SHALL include a `scoped: true` field in the response to allow the frontend to distinguish scoped sessions from full sessions

2.5 WHEN a user opens the ShareCreateView to create a share link THEN the system SHALL display a visible warning message indicating that logging out will expire all share links created from this session

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user is authenticated with a full OAuth session (non-scoped) THEN the system SHALL CONTINUE TO display the "Create Share Link" button in ReaderView

3.2 WHEN a user is authenticated with a full OAuth session (non-scoped) THEN the system SHALL CONTINUE TO display the "Shares" management link in the Header

3.3 WHEN a user is authenticated with a full PAT session (non-scoped) THEN the system SHALL CONTINUE TO display the "Create Share Link" button in ReaderView

3.4 WHEN a user is authenticated with a full PAT session (non-scoped) THEN the system SHALL CONTINUE TO display the "Shares" management link in the Header

3.5 WHEN a user is not authenticated THEN the system SHALL CONTINUE TO hide the "Create Share Link" button and "Shares" link

3.6 WHEN a user is viewing content through a scoped session THEN the system SHALL CONTINUE TO allow viewing the shared content (reading files, rendering markdown/PDF)

3.7 WHEN a user is viewing content through a scoped session THEN the system SHALL CONTINUE TO display the "Logout" button in the Header

3.8 WHEN a user creates a share link with a valid passphrase and expiry selection THEN the system SHALL CONTINUE TO generate the share link successfully and display the generated URL

3.9 WHEN a user copies a generated share link THEN the system SHALL CONTINUE TO copy the link to the clipboard and show confirmation feedback

3.10 WHEN a user cancels the share creation form THEN the system SHALL CONTINUE TO close the form without generating a link
