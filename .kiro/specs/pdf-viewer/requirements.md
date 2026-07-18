# Requirements Document

## Introduction

This feature extends the ghmd-viewer application to support viewing PDF files from GitHub repositories alongside the existing Markdown rendering capability. Users will be able to browse, select, and view PDF files directly in the browser without downloading them. The PDF viewer integrates with the existing sidebar file discovery, content fetching (public and private), and authentication infrastructure.

## Glossary

- **PDF_Viewer**: The React component responsible for rendering PDF file content within the application content area.
- **File_Discovery_Service**: The service that recursively discovers viewable files (Markdown and PDF) within a GitHub repository directory structure.
- **Content_Fetcher**: The service layer responsible for fetching raw file content from GitHub, either directly (public repos) or via the PHP backend proxy (private repos).
- **Sidebar**: The navigation panel that displays the hierarchical tree of viewable files.
- **ReaderView**: The main layout component that composes the Header, Sidebar, and content rendering area.
- **Supported_File**: A file with an extension recognized by the application for viewing (`.md` for Markdown, `.pdf` for PDF).

## Requirements

### Requirement 1: PDF File Discovery

**User Story:** As a user, I want PDF files to appear in the sidebar alongside Markdown files, so that I can browse and select them for viewing.

#### Acceptance Criteria

1. WHEN the File_Discovery_Service scans a repository directory, THE File_Discovery_Service SHALL include files with the `.pdf` extension (case-insensitive, matching `.pdf`, `.PDF`, `.Pdf`, etc.) in the file tree results, using the same recursive traversal depth limit (10 levels) applied to Markdown file discovery.
2. THE File_Discovery_Service SHALL return PDF files sorted alphabetically (using locale-aware string comparison) intermixed with Markdown files at the same directory level, with directories listed before files.
3. WHEN a directory contains only PDF files and no Markdown files, THE File_Discovery_Service SHALL include that directory in the file tree.
4. THE Sidebar SHALL display each PDF file entry with a file-type icon or label that is visually distinct from the icon or label used for Markdown files, such that a user can identify the file type without reading the file extension.
5. WHEN the file tree contains no Markdown files and no PDF files, THE Sidebar SHALL display an empty-state message indicating that no supported files were found.

### Requirement 2: PDF Content Fetching

**User Story:** As a user, I want the application to fetch PDF file content from GitHub, so that I can view PDFs from both public and private repositories.

#### Acceptance Criteria

1. WHEN a user selects a file with a `.pdf` extension (case-insensitive) from the Sidebar in a public repository session, THE Content_Fetcher SHALL fetch the raw binary content from the GitHub raw content URL (`raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`).
2. WHEN a user selects a file with a `.pdf` extension (case-insensitive) from the Sidebar in an authenticated session for a private repository, THE Content_Fetcher SHALL fetch the raw binary content via the PHP backend proxy endpoint (`/api/proxy/raw/`), including session credentials.
3. THE Content_Fetcher SHALL request PDF content using ArrayBuffer response handling so that the binary data is preserved without text decoding.
4. IF a network error or timeout occurs while fetching PDF content, THEN THE Content_Fetcher SHALL propagate the error to the ReaderView via `mapErrorToAppError` for display using the existing error state mechanism.
5. IF the backend proxy returns a 401 status for a PDF fetch, THEN THE Content_Fetcher SHALL throw a SessionExpiredError consistent with existing authentication error handling.
6. IF the backend proxy returns a 403 status for a PDF fetch, THEN THE Content_Fetcher SHALL throw an InstallationAccessError consistent with existing private repository access error handling.

### Requirement 3: PDF Rendering

**User Story:** As a user, I want to view PDF files rendered inline in the content area, so that I can read PDF documents without leaving the application.

#### Acceptance Criteria

1. WHEN PDF binary content is successfully fetched, THE PDF_Viewer SHALL render the PDF document inline within the content area as visible page images, without opening a new window or triggering a file download.
2. THE PDF_Viewer SHALL display all pages of a multi-page PDF document in a scrollable vertical layout with a visible gap between consecutive pages.
3. THE PDF_Viewer SHALL scale PDF pages to fit the available content area width while maintaining the original aspect ratio, and SHALL re-scale pages when the content area width changes due to window resize or sidebar toggle.
4. WHILE a PDF file is loading, THE ReaderView SHALL display the existing loading indicator. IF the PDF does not finish loading within 30 seconds, THEN THE PDF_Viewer SHALL abort the loading attempt and display an error message indicating a loading timeout.
5. IF the PDF content is malformed, cannot be parsed, or contains zero pages, THEN THE PDF_Viewer SHALL display an error message indicating the file could not be rendered.

### Requirement 4: PDF Navigation Controls

**User Story:** As a user, I want basic navigation controls when viewing a PDF, so that I can move between pages and adjust the view.

#### Acceptance Criteria

1. THE PDF_Viewer SHALL display the current page number and total page count in the format "current / total" (e.g., "1 / 5").
2. IF a PDF document has more than one page, THEN THE PDF_Viewer SHALL provide controls to navigate to the next and previous pages, where activating next SHALL scroll the view to the following page and activating previous SHALL scroll the view to the preceding page.
3. IF the user is viewing the first page, THEN THE PDF_Viewer SHALL disable the previous page control, and IF the user is viewing the last page, THEN THE PDF_Viewer SHALL disable the next page control.
4. THE PDF_Viewer SHALL provide controls to zoom in and zoom out of the rendered PDF content in increments of 25%, with a minimum zoom level of 50% and a maximum zoom level of 200%.
5. WHEN the user scrolls through the PDF document, THE PDF_Viewer SHALL update the displayed current page number to the page that occupies the majority of the visible viewport area.

### Requirement 5: File Type Detection and Routing

**User Story:** As a user, I want the application to automatically detect the file type and render it with the appropriate viewer, so that I do not need to take any special action for PDFs.

#### Acceptance Criteria

1. WHEN a file is selected from the Sidebar, THE ReaderView SHALL determine the file type by matching the file extension (the substring after the last `.` in the filename, compared case-insensitively) against the set of supported extensions: `.md` and `.pdf`.
2. WHEN the selected file has a `.pdf` extension (case-insensitive), THE ReaderView SHALL render the file using the PDF_Viewer component and SHALL NOT display the MarkdownRenderer component.
3. WHEN the selected file has a `.md` extension (case-insensitive), THE ReaderView SHALL render the file using the existing MarkdownRenderer component and SHALL NOT display the PDF_Viewer component.
4. WHEN a file is selected, THE ReaderView SHALL remove the previously rendered content and display the new file's content within 1 second of the file data being available, without requiring any additional user action such as choosing a viewer.
5. WHEN the Sidebar discovers files in the repository folder, THE Sidebar SHALL include files with `.pdf` extension (case-insensitive) in addition to `.md` files in the file tree.
6. IF the selected file has an extension that is not in the supported set (`.md`, `.pdf`), THEN THE ReaderView SHALL display a message indicating that the file type is not supported.

### Requirement 6: PDF Viewer Accessibility

**User Story:** As a user with assistive technology, I want the PDF viewer to be accessible, so that I can navigate and understand the PDF content.

#### Acceptance Criteria

1. THE PDF_Viewer container SHALL have a `role="document"` attribute and an `aria-label` that includes the filename of the PDF being viewed.
2. THE PDF_Viewer navigation controls SHALL be reachable via the Tab key and operable via Enter or Space keys.
3. THE PDF_Viewer navigation controls SHALL each have an `aria-label` that describes the control's function (e.g., "Next page", "Previous page", "Zoom in", "Zoom out").
4. WHEN the displayed current page number changes, THE PDF_Viewer SHALL update an ARIA live region so that screen readers announce the new page number and total page count.
5. WHEN the PDF cannot be rendered, THE PDF_Viewer SHALL provide the user with a fallback download link that includes the filename in its accessible text.
6. IF a navigation control is not applicable (e.g., "Previous page" on the first page or "Next page" on the last page), THEN THE PDF_Viewer SHALL set that control to a disabled state with `aria-disabled="true"`.
