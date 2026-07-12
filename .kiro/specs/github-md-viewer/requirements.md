# Requirements Document

## Introduction

A Single Page Application (SPA) that allows users to input a GitHub folder link and renders Markdown files in a readable format. The application features a navigation sidebar for browsing all `.md` files within the folder, supports dark and light themes using shadcn UI components, renders embedded images and Mermaid diagrams (with toggle capability).

For public repositories, the application operates as a purely static frontend with no backend needed. For private repositories, a GitHub App integration with a minimal PHP backend handles OAuth authentication. Users can share access to private docs with non-GitHub users via secret passphrase-protected links.

## Glossary

- **Viewer**: The main SPA application that fetches and renders GitHub Markdown content
- **Sidebar**: The navigation panel that lists all discoverable `.md` files within the target GitHub folder
- **GitHub_API**: The GitHub REST API (api.github.com) used to fetch repository contents
- **GitHub_App**: A registered GitHub App that requests read-only access to repository contents on behalf of users
- **Auth_Backend**: A minimal PHP backend that handles the GitHub App OAuth flow and issues short-lived access tokens
- **Markdown_Renderer**: The component responsible for parsing and rendering Markdown content into HTML
- **Mermaid_Renderer**: The component responsible for rendering Mermaid diagram code blocks into SVG diagrams
- **Theme_Manager**: The component responsible for managing dark and light mode preferences
- **Share_Service**: The component that generates and validates passphrase-protected shareable links for private repository content
- **Session_Token**: A short-lived token issued by the Auth_Backend after successful GitHub App OAuth, stored in an httpOnly cookie or short-lived session storage
- **Passphrase**: A user-defined secret string used to encrypt access information for shareable links

## Requirements

### Requirement 1: GitHub Folder URL Input

**User Story:** As a user, I want to paste a GitHub folder URL, so that I can view the Markdown files within that folder.

#### Acceptance Criteria

1. THE Viewer SHALL provide a text input field for pasting a GitHub folder URL with a submit button and Enter key submission support
2. WHEN a valid GitHub folder URL is submitted, THE Viewer SHALL parse the URL to extract the owner, repository name, branch, and path, using the GitHub API to resolve ambiguity for branch names containing slashes
3. WHEN an invalid GitHub folder URL is submitted, THE Viewer SHALL display an error message indicating the expected format `https://github.com/{owner}/{repo}/tree/{branch}/{path}`
4. THE Viewer SHALL support URLs in the format `https://github.com/{owner}/{repo}/tree/{branch}/{path}`
5. WHEN a valid URL is submitted, THE Viewer SHALL make an unauthenticated GitHub API call to determine whether the repository is public or private and route to the appropriate access flow
6. WHEN the submitted URL points to a file rather than a folder, THE Viewer SHALL display an error message indicating that only folder URLs are accepted
7. WHEN the input field is empty or contains only whitespace, THE Viewer SHALL disable the submit button and not attempt URL parsing

### Requirement 2: Public Repository Content Fetching

**User Story:** As a user, I want to browse public repository Markdown files without authentication, so that I can quickly view open-source documentation.

#### Acceptance Criteria

1. WHEN a public repository URL is submitted, THE Viewer SHALL fetch the directory listing using the unauthenticated GitHub REST API endpoint `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`
2. WHEN the GitHub_API returns a successful response, THE Viewer SHALL extract all files with a `.md` or `.MD` extension (case-insensitive) from the directory listing
3. WHEN the GitHub_API returns a 403 status with a rate limit header indicating zero remaining requests, THE Viewer SHALL display a message informing the user about the rate limit and suggesting authentication
4. WHEN the GitHub_API returns a 404 error, THE Viewer SHALL display a message indicating the folder was not found
5. THE Viewer SHALL recursively fetch subdirectory contents to discover all nested `.md` files, up to a maximum depth of 10 levels
6. THE Viewer SHALL operate entirely in the browser for public repositories without requiring the Auth_Backend
7. WHEN a network error or unexpected response status occurs during fetching, THE Viewer SHALL display an error message describing the failure and offer a retry option
8. WHILE directory contents are being fetched, THE Viewer SHALL display a loading indicator

### Requirement 3: Private Repository Access via GitHub App

**User Story:** As a user, I want to connect my GitHub account through a GitHub App, so that I can view Markdown files from my private repositories.

#### Acceptance Criteria

1. WHEN a repository is determined to be private (GitHub API returns 404 for unauthenticated request to a repo that exists), THE Viewer SHALL prompt the user to connect via the GitHub App
2. THE Viewer SHALL provide a "Connect GitHub" button that initiates the GitHub App OAuth flow
3. WHEN the user clicks "Connect GitHub", THE Viewer SHALL redirect the user to the GitHub App authorization page with the required OAuth parameters (client_id, redirect_uri, state)
4. WHEN the user authorizes the GitHub App and the OAuth callback is received, THE Auth_Backend SHALL exchange the authorization code for an installation access token
5. WHEN the OAuth token exchange completes successfully, THE Auth_Backend SHALL issue a short-lived Session_Token to the Viewer
6. IF the target repository is not in the GitHub App installation allowlist, THEN THE Viewer SHALL display a message with a link to the GitHub App installation settings page where the user can add the repository
7. WHEN the Session_Token expires (Auth_Backend returns 401), THE Viewer SHALL display a re-authentication prompt with the "Connect GitHub" button
8. WHEN the user denies or cancels the OAuth authorization, THE Viewer SHALL display a message indicating authorization was cancelled and offer the option to try again
9. WHEN the OAuth callback returns an error parameter, THE Viewer SHALL display a message indicating the connection failed and offer a retry option

### Requirement 4: Auth Backend (PHP)

**User Story:** As a developer, I want a minimal PHP backend to handle the GitHub App OAuth flow, so that client secrets are never exposed in the frontend.

#### Acceptance Criteria

1. THE Auth_Backend SHALL handle the GitHub App OAuth callback, validate the CSRF state parameter, and exchange authorization codes for access tokens
2. THE Auth_Backend SHALL store the GitHub App private key and client secret in environment variables or a server-side configuration file not accessible via HTTP
3. THE Auth_Backend SHALL issue short-lived Session_Tokens (maximum 1 hour expiry) to authenticated users
4. THE Auth_Backend SHALL provide an endpoint to proxy GitHub API requests using the installation access token, with a maximum response timeout of 30 seconds
5. THE Auth_Backend SHALL NOT store user GitHub credentials or long-lived tokens on the server
6. THE Auth_Backend SHALL validate the Session_Token on every proxied request
7. IF the Session_Token is invalid or expired, THEN THE Auth_Backend SHALL return a 401 status code
8. IF the OAuth authorization code exchange fails, THEN THE Auth_Backend SHALL return a 400 status code with an error description
9. IF a proxied GitHub API request fails due to an upstream error, THEN THE Auth_Backend SHALL forward the GitHub API error status code and message to the Viewer

### Requirement 5: Credential Security

**User Story:** As a user, I want my credentials handled securely, so that my GitHub access is protected.

#### Acceptance Criteria

1. THE Auth_Backend SHALL NOT persist GitHub user tokens beyond the active session
2. THE Viewer SHALL store the Session_Token in an httpOnly, secure, SameSite=Strict cookie with a maximum lifetime of 1 hour to prevent JavaScript access and cross-site request forgery
3. WHEN the user logs out, THE Viewer SHALL clear the Session_Token cookie and send a logout request to the Auth_Backend
4. WHEN the Auth_Backend receives a logout request with a valid Session_Token, THE Auth_Backend SHALL invalidate the session so that subsequent requests using that token return a 401 status code
5. THE Auth_Backend SHALL request only the minimum GitHub App permissions required (read-only contents access)
6. THE Viewer SHALL communicate with the Auth_Backend exclusively over HTTPS
7. IF the Session_Token cookie has expired or is missing, THEN THE Viewer SHALL redirect the user to the authentication prompt without exposing any previously fetched private content

### Requirement 6: Shareable Links with Passphrase

**User Story:** As a user, I want to share a link with a secret passphrase so that non-GitHub users can view my private documentation.

#### Acceptance Criteria

1. WHEN a user is viewing a private repository folder, THE Viewer SHALL provide a "Create Share Link" button
2. WHEN the user clicks "Create Share Link", THE Viewer SHALL prompt the user to enter a passphrase with a minimum length of 8 characters
3. THE Share_Service SHALL generate a shareable URL that encodes the repository owner, repo name, branch, path, and an encrypted access payload in the URL hash fragment
4. THE Share_Service SHALL encrypt the Session_Token and repository access information using the user-provided passphrase with AES-GCM via the Web Crypto API, using PBKDF2 for key derivation
5. WHEN a recipient opens a shared link, THE Viewer SHALL prompt the recipient for the passphrase
6. WHEN the correct passphrase is entered, THE Viewer SHALL decrypt the access payload and fetch the private repository content through the Auth_Backend
7. WHEN an incorrect passphrase is entered (decryption fails), THE Viewer SHALL display an error message indicating the passphrase is invalid and allow up to 5 retry attempts before disabling input for 60 seconds
8. THE Share_Service SHALL allow the sharing user to set an expiration time for the shared link, with a minimum of 1 hour and a maximum of 30 days
9. IF the shared link has expired (current time exceeds the embedded expiration timestamp), THEN THE Viewer SHALL display a message indicating the link is no longer valid without attempting decryption

### Requirement 7: Navigation Sidebar

**User Story:** As a user, I want a sidebar listing all Markdown files, so that I can easily browse and switch between documents.

#### Acceptance Criteria

1. WHEN Markdown files are discovered, THE Sidebar SHALL display a list of all `.md` file paths relative to the input folder
2. THE Sidebar SHALL organize files in a tree structure reflecting the folder hierarchy, with folders expandable and collapsible by clicking
3. WHEN a user clicks a file entry in the Sidebar, THE Viewer SHALL fetch and render that Markdown file and update the browser URL
4. THE Sidebar SHALL visually indicate the currently active file by applying a distinct background color or highlight style to the selected entry
5. WHEN the viewport width is below 768px, THE Sidebar SHALL be hidden by default and accessible via a hamburger menu toggle button
6. WHEN the viewport width is 768px or above, THE Sidebar SHALL be visible by default
7. IF no `.md` files are found in the target folder, THEN THE Sidebar SHALL display a message indicating no Markdown files were found

### Requirement 8: Markdown Rendering

**User Story:** As a user, I want Markdown files rendered in a readable format, so that I can read documentation comfortably.

#### Acceptance Criteria

1. WHEN a Markdown file is fetched, THE Markdown_Renderer SHALL parse the raw Markdown content and render it as structured HTML within 2 seconds of receiving the content
2. THE Markdown_Renderer SHALL support GitHub Flavored Markdown (GFM) syntax including tables, task lists, strikethrough, and autolinks
3. WHEN a fenced code block includes a language identifier, THE Markdown_Renderer SHALL render the code block with syntax highlighting appropriate to the specified language
4. IF a fenced code block does not include a language identifier, THEN THE Markdown_Renderer SHALL render the code block as plain monospaced text without syntax highlighting
5. THE Markdown_Renderer SHALL render headings (levels 1-6), ordered and unordered lists, blockquotes, horizontal rules, and inline formatting including bold, italic, inline code, and links
6. WHEN the rendered Markdown contains a relative link to another `.md` file within the same repository, THE Markdown_Renderer SHALL convert it to an in-app navigation link that fetches and renders the target file without a full page reload
7. WHEN the rendered Markdown contains an external link (absolute URL to a non-repository destination), THE Markdown_Renderer SHALL open the link in a new browser tab

### Requirement 9: Image Rendering

**User Story:** As a user, I want embedded images in Markdown to display correctly, so that I can see diagrams and screenshots.

#### Acceptance Criteria

1. WHEN the Markdown content contains relative image paths, THE Markdown_Renderer SHALL resolve the paths relative to the file's location in the GitHub repository and construct a fetchable URL using the repository's raw content endpoint
2. WHEN the Markdown content contains absolute image URLs, THE Markdown_Renderer SHALL render the images using those URLs directly
3. IF an image fails to load or does not complete loading within 10 seconds, THEN THE Markdown_Renderer SHALL display a placeholder element containing the image alt text
4. IF an image has no alt text defined, THEN THE Markdown_Renderer SHALL display a placeholder element with a generic label indicating a broken image
5. WHEN the repository is private, THE Markdown_Renderer SHALL route image requests through the Auth_Backend to include the Session_Token for authorization
6. IF an image request through the Auth_Backend returns a 401 status, THEN THE Markdown_Renderer SHALL display the image placeholder and THE Viewer SHALL prompt the user to re-authenticate

### Requirement 10: Mermaid Diagram Rendering

**User Story:** As a user, I want Mermaid diagrams in Markdown rendered as visual diagrams, so that I can understand flowcharts and sequence diagrams.

#### Acceptance Criteria

1. WHEN the Markdown content contains a fenced code block with the `mermaid` language identifier, THE Mermaid_Renderer SHALL render it as an SVG diagram
2. THE Viewer SHALL provide a global toggle control allowing the user to enable or disable Mermaid diagram rendering, with rendering enabled by default
3. WHEN the user changes the Mermaid rendering toggle, THE Viewer SHALL persist the preference in browser localStorage and apply it on subsequent page loads
4. WHILE Mermaid rendering is disabled, THE Mermaid_Renderer SHALL display the raw Mermaid source code in a standard code block with syntax highlighting
5. WHEN a Mermaid diagram contains a syntax error, THE Mermaid_Renderer SHALL display an error message indicating the nature of the syntax error alongside the raw Mermaid source code
6. IF the Mermaid_Renderer does not complete rendering within 5 seconds, THEN THE Mermaid_Renderer SHALL abort the render attempt and display an error message indicating a rendering timeout alongside the raw Mermaid source code

### Requirement 11: Dark and Light Mode

**User Story:** As a user, I want to switch between dark and light modes, so that I can read comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Theme_Manager SHALL provide a toggle control that cycles between three modes: light, dark, and system (OS preference)
2. WHEN the application loads for the first time (no saved preference in localStorage), THE Theme_Manager SHALL default to the user's operating system color scheme preference via the `prefers-color-scheme` media query
3. WHEN the user selects a theme mode, THE Theme_Manager SHALL persist the selected mode in browser localStorage and apply the theme immediately without requiring a page reload
4. WHEN the application loads and a previously saved theme preference exists in localStorage, THE Theme_Manager SHALL apply that saved preference
5. IF the saved theme preference in localStorage is missing or contains an invalid value, THEN THE Theme_Manager SHALL fall back to the operating system color scheme preference and remove the invalid entry
6. THE Viewer SHALL apply the selected theme to all UI components including the Sidebar, Markdown content area, code blocks, and Mermaid diagram outputs

### Requirement 12: Static Frontend with Optional Backend

**User Story:** As a developer, I want the frontend to be a static app that works standalone for public repos and connects to a PHP backend only for private repo features.

#### Acceptance Criteria

1. THE Viewer SHALL be buildable into static HTML, CSS, and JavaScript files that require no server-side runtime, server-side scripting, or special server configuration beyond serving static files
2. THE Viewer SHALL operate fully as a client-side SPA for public repository access without the Auth_Backend
3. THE Viewer SHALL use client-side routing for navigation between views without full page reloads
4. IF the Auth_Backend URL is not provided in the build-time or runtime configuration, THEN THE Viewer SHALL hide the "Connect GitHub" button, "Create Share Link" button, and private repository access options, and SHALL display only public access options
5. THE Viewer SHALL detect Auth_Backend availability through a single configuration value (the Auth_Backend base URL) that can be set at build time or provided via a static configuration file at deploy time

### Requirement 13: URL State Management

**User Story:** As a user, I want the current viewing state reflected in the browser URL, so that I can share links to specific files.

#### Acceptance Criteria

1. WHEN a user navigates to a Markdown file, THE Viewer SHALL update the browser URL hash to encode the repository owner, repo name, branch, folder path, and current file path
2. WHEN the application loads with a URL containing repository and file path parameters in the hash, THE Viewer SHALL automatically fetch and render the specified file
3. THE Viewer SHALL use URL hash fragments for state to maintain compatibility with static hosting (no server-side routing required)
4. WHEN the user presses the browser back or forward button, THE Viewer SHALL navigate to the previously or next viewed Markdown file without a full page reload
5. IF the URL hash contains parameters pointing to a file or repository that cannot be fetched, THEN THE Viewer SHALL display an error message and offer the URL input field for entering a new path
