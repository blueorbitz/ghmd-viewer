# Implementation Plan: PDF Viewer

## Overview

This plan implements PDF viewing support in the ghmd-viewer application. The implementation progresses from utility functions and service layer changes, through the PDF rendering component, to integration with the existing ReaderView and Sidebar. Each step builds incrementally on the previous, ensuring no orphaned code.

## Tasks

- [ ] 1. Set up file type utilities and install dependencies
  - [ ] 1.1 Install react-pdf dependency and configure PDF.js worker
    - Run `pnpm add react-pdf` to add the runtime dependency
    - Create or update Vite config to handle the `pdfjs-dist` worker file
    - Set the `pdfjs-dist` worker source in a central config (e.g., `src/config/pdf-worker.ts`)
    - _Requirements: 3.1_

  - [ ] 1.2 Create `src/lib/file-type.ts` with file type detection utilities
    - Implement `getFileExtension(filename: string): string` — returns lowercase extension without dot
    - Implement `getFileType(filename: string): SupportedFileType` — returns `'pdf'`, `'markdown'`, or `'unsupported'`
    - Implement `isPdfFile(filename: string): boolean` and `isSupportedFile(filename: string): boolean`
    - Export `SupportedFileType` type
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [ ]* 1.3 Write property tests for file type detection
    - **Property 3: File type routing correctness**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**
    - Use fast-check to generate random filenames with various extensions and casings
    - Verify `getFileType` returns `'pdf'` iff extension is `pdf` (case-insensitive), `'markdown'` iff `md`, and `'unsupported'` otherwise

- [ ] 2. Extend service layer for PDF content fetching and file discovery
  - [ ] 2.1 Add `fetchPdfContent` and `fetchPrivatePdfContent` to `src/services/github-service.ts`
    - Implement `fetchPdfContent(owner, repo, path, branch, fetchFn?)` that fetches from `raw.githubusercontent.com` with `ArrayBuffer` response type
    - Implement `fetchPrivatePdfContent(owner, repo, path, branch, backendUrl?, fetchFn?)` that fetches via `/api/proxy/raw/` with `credentials: 'include'` and `ArrayBuffer` response type
    - Handle 401 → `SessionExpiredError`, 403 → `InstallationAccessError`, network errors → propagate via `mapErrorToAppError`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property tests for PDF fetch URL construction
    - **Property 4: PDF fetch URL construction**
    - **Validates: Requirements 2.1, 2.2**
    - Use fast-check to generate random owner/repo/branch/path strings
    - Verify constructed URLs match the expected patterns

  - [ ] 2.3 Extend file discovery to include PDF files
    - Update or create `discoverSupportedFiles` function in `github-service.ts` that includes both `.md` and `.pdf` files
    - Ensure the same recursive depth limit (10 levels) applies
    - Add `fileType` field to `FileTreeNode` based on extension
    - Maintain sorting: directories first, then files alphabetically with `localeCompare`
    - _Requirements: 1.1, 1.2, 1.3, 5.5_

  - [ ]* 2.4 Write property tests for file discovery
    - **Property 1: PDF file discovery inclusion**
    - **Validates: Requirements 1.1, 1.3, 5.5**
    - Generate random arrays of `GitHubContentItem` entries and verify all `.pdf` items appear in results

  - [ ]* 2.5 Write property test for file tree sorting
    - **Property 2: File tree sorting invariant**
    - **Validates: Requirements 1.2**
    - Generate random `FileTreeNode[]` arrays and verify directories precede files and names are sorted with `localeCompare`

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement PdfViewer component
  - [ ] 4.1 Create `src/components/PdfViewer.tsx` with core rendering
    - Implement `PdfViewer` component with `PdfViewerProps` interface (data, filename, downloadUrl)
    - Use `react-pdf` `Document` and `Page` components to render all pages vertically with gaps
    - Manage internal state: `numPages`, `currentPage`, `zoomLevel`, `error`, `isLoaded`
    - Scale pages to fit container width while maintaining aspect ratio
    - Handle window resize and sidebar toggle with responsive re-scaling
    - Implement 30-second loading timeout with `AbortController`
    - Display error state with fallback download link when PDF fails to render
    - Set `role="document"` and `aria-label` containing the filename on the container
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.5_

  - [ ] 4.2 Create `src/components/PdfNavControls.tsx` with navigation and zoom
    - Implement `PdfNavControls` component with `PdfNavControlsProps` interface
    - Display page indicator in format "current / total"
    - Implement next/previous page buttons that scroll to the target page
    - Implement zoom in/out buttons with 25% increments, clamped to [50%, 200%]
    - Disable previous on first page, next on last page (with `aria-disabled="true"`)
    - Add `aria-label` to each control (e.g., "Next page", "Previous page", "Zoom in", "Zoom out")
    - Ensure all controls are keyboard accessible (Tab, Enter, Space)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.2, 6.3, 6.6_

  - [ ] 4.3 Implement scroll-based page tracking with IntersectionObserver
    - Use IntersectionObserver to detect which page occupies the majority of the viewport
    - Update `currentPage` state as user scrolls
    - Update ARIA live region to announce page changes to screen readers
    - _Requirements: 4.5, 6.4_

  - [ ]* 4.4 Write property tests for zoom clamping and navigation state
    - **Property 6: Zoom level clamping**
    - **Validates: Requirements 4.4**
    - Generate random sequences of zoom-in/zoom-out operations and verify bounds [50, 200]
    - **Property 5: Navigation control disabled state**
    - **Validates: Requirements 4.3, 6.6**
    - Generate random (currentPage, totalPages) pairs and verify disabled states

  - [ ]* 4.5 Write property test for page indicator format
    - **Property 8: Page indicator format**
    - **Validates: Requirements 4.1**
    - Generate random valid (currentPage, totalPages) pairs and verify output matches "{currentPage} / {totalPages}"

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Integrate PDF viewer into ReaderView and Sidebar
  - [ ] 6.1 Update `ReaderView` to route between MarkdownRenderer and PdfViewer
    - Import `getFileType` from `file-type.ts`
    - Add `pdfData: Uint8Array | null` state
    - Derive `fileType` from selected file's extension using `getFileType`
    - Call `fetchPdfContent` or `fetchPrivatePdfContent` for PDF files, convert ArrayBuffer to Uint8Array
    - Call existing text fetch for Markdown files
    - Conditionally render `PdfViewer` when `fileType === 'pdf'`, `MarkdownRenderer` when `fileType === 'markdown'`, and an unsupported message otherwise
    - Clear previous content state when switching files
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ] 6.2 Update `Sidebar` to use `discoverSupportedFiles` and show file type icons
    - Replace `discoverMarkdownFiles` calls with `discoverSupportedFiles`
    - Display distinct icon for PDF files vs Markdown files in `FileTreeItem`
    - Update empty state message to "No supported files found"
    - _Requirements: 1.4, 1.5, 5.5_

  - [ ]* 6.3 Write unit tests for ReaderView file type routing
    - Test that selecting a `.pdf` file renders PdfViewer and not MarkdownRenderer
    - Test that selecting a `.md` file renders MarkdownRenderer and not PdfViewer
    - Test that selecting an unsupported file shows unsupported message
    - Test that switching files clears previous content
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 6.4 Write unit tests for Sidebar file type display
    - Test PDF icon rendering distinct from Markdown icon
    - Test empty state message when no supported files exist
    - _Requirements: 1.4, 1.5_

- [ ] 7. Error handling and edge cases
  - [ ] 7.1 Integrate PDF error states with existing error display
    - Ensure network errors during PDF fetch show `ErrorDisplay` with retry button
    - Ensure 401 errors trigger re-authentication prompt
    - Ensure 403 errors trigger installation access prompt
    - Ensure malformed PDF / zero pages shows inline error with fallback download link
    - _Requirements: 2.4, 2.5, 2.6, 3.4, 3.5, 6.5_

  - [ ]* 7.2 Write property test for error type mapping
    - **Property 9: Error type preservation in mapping**
    - **Validates: Requirements 2.4**
    - Generate errors with various messages and verify network-related errors map to `type: 'network'` with `retryable: true`

  - [ ]* 7.3 Write unit tests for PDF error scenarios
    - Test loading timeout triggers error state after 30 seconds
    - Test malformed PDF data triggers error with download link
    - Test retry button re-triggers fetch on network error
    - _Requirements: 3.4, 3.5, 6.5_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript, React 19, Vitest, and fast-check
- `react-pdf` wraps `pdfjs-dist` and requires worker configuration for Vite

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.5"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] }
  ]
}
```
