# Implementation Plan: Markdown Viewer Enhancements

## Overview

This plan implements three frontend enhancements to the GitHub Markdown Viewer: copy-to-clipboard buttons on code blocks, a raw markdown view toggle, and a unified settings dropdown. All work is in the React/TypeScript frontend layer. The implementation proceeds from shared infrastructure (ViewSettingsProvider, UI primitives) through individual feature components, then wiring and integration.

## Tasks

- [x] 1. Set up shared infrastructure and UI primitives
  - [x] 1.1 Create ViewSettingsProvider to replace MermaidProvider
    - Create `src/components/ViewSettingsProvider.tsx` with the `ViewSettingsContextValue` interface
    - Manage both `mermaidEnabled` and `rawViewEnabled` state with localStorage persistence (keys: `ghmd-mermaid-enabled`, `ghmd-raw-view`)
    - Wrap localStorage calls in try/catch for graceful degradation
    - Export `useViewSettings()` hook
    - _Requirements: 2.5, 3.11_

  - [x] 1.2 Install shadcn/ui DropdownMenu and Switch components
    - Run `npx shadcn@latest add dropdown-menu switch` to add the components to `src/components/ui/`
    - Verify the generated files are present and TypeScript compiles cleanly
    - _Requirements: 3.10_

  - [x] 1.3 Update App.tsx to use ViewSettingsProvider
    - Replace `MermaidProvider` import and usage with `ViewSettingsProvider` in `src/App.tsx`
    - Ensure existing `useMermaid()` call sites still work by re-exporting a compatibility hook or updating imports
    - _Requirements: 3.11_

- [x] 2. Implement Copy-to-Clipboard on Code Blocks
  - [x] 2.1 Create CopyButton component
    - Create `src/components/CopyButton.tsx` implementing the copy button with idle/copied state
    - Use `navigator.clipboard.writeText()` with error handling (silent failure)
    - Show checkmark icon for 2 seconds on success, revert to copy icon
    - Handle re-click during confirmation (restart timer)
    - Clean up setTimeout on unmount via useEffect cleanup
    - Minimum 32×32px, `aria-label="Copy code to clipboard"`, keyboard accessible
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Create CodeBlockWrapper component
    - Create `src/components/CodeBlockWrapper.tsx` with `position: relative` container
    - Place CopyButton at `position: absolute; top-right`
    - Accept `rawText` prop for the code content to copy
    - _Requirements: 1.1, 1.8_

  - [x] 2.3 Integrate CodeBlockWrapper into MarkdownRenderer
    - Modify the `pre` component override in `src/components/MarkdownRenderer.tsx`
    - Wrap fenced code blocks (pre > code) with `CodeBlockWrapper`, extracting raw text from the code element's textContent
    - Ensure Mermaid code blocks are NOT wrapped (they bypass `<pre>` already)
    - Ensure inline `<code>` spans are NOT affected
    - _Requirements: 1.3, 1.8_

  - [ ]* 2.4 Write property test: Code text extraction round-trip (Property 1)
    - **Property 1: Code text extraction round-trip**
    - **Validates: Requirements 1.3**
    - Create test in `tests/components/CopyButton.property.test.tsx`
    - Use fast-check to generate arbitrary code strings, render through rehype-highlight, verify textContent matches original

  - [ ]* 2.5 Write property test: Copy button placement correctness (Property 2)
    - **Property 2: Copy button placement correctness**
    - **Validates: Requirements 1.8**
    - Create test in `tests/components/CodeBlockWrapper.property.test.tsx`
    - Use fast-check to generate markdown with mixed fenced blocks and inline code, verify copy buttons only appear in `<pre>` elements

- [x] 3. Implement Raw Markdown View
  - [x] 3.1 Create RawMarkdownView component
    - Create `src/components/RawMarkdownView.tsx`
    - Render raw markdown in `<pre><code>` with monospace font
    - No syntax highlighting, no HTML rendering, no markdown processing
    - Scrollable container matching content area dimensions
    - _Requirements: 2.1, 2.4_

  - [x] 3.2 Integrate raw view toggle into ReaderView
    - Modify `src/views/ReaderView.tsx` to consume `useViewSettings()` for `rawViewEnabled`
    - Conditionally render `RawMarkdownView` or `MarkdownRenderer` based on `rawViewEnabled`
    - Reset scroll position to top when toggling between views
    - Preserve toggle state when switching files
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [ ]* 3.3 Write property test: Raw view identity (Property 3)
    - **Property 3: Raw view identity**
    - **Validates: Requirements 2.4**
    - Create test in `tests/components/RawMarkdownView.property.test.tsx`
    - Use fast-check to generate arbitrary markdown strings, render in RawMarkdownView, verify displayed textContent is character-for-character identical to input

- [x] 4. Implement Unified Settings Dropdown
  - [x] 4.1 Create SettingsDropdown component
    - Create `src/components/SettingsDropdown.tsx` using shadcn/ui `DropdownMenu` and `Switch`
    - Trigger button with `SlidersHorizontal` icon from lucide-react and `aria-label="Display settings"`
    - Two labeled switch rows: "Mermaid Diagrams" (toggles `mermaidEnabled`) and "Raw Markdown" (toggles `rawViewEnabled`)
    - Fully keyboard accessible (Enter/Space to open, Tab/Arrow to navigate, Enter/Space to toggle)
    - Closes on outside click or Escape, returns focus to trigger
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 4.2 Replace standalone Mermaid button in Header with SettingsDropdown
    - Modify `src/components/Header.tsx` to remove the standalone Mermaid toggle button
    - Import and render `SettingsDropdown` in its place
    - Remove the `useMermaid` import from Header (settings are handled inside SettingsDropdown)
    - _Requirements: 3.1_

  - [ ]* 4.3 Write property test: Settings persistence round-trip (Property 4)
    - **Property 4: Settings persistence round-trip**
    - **Validates: Requirements 2.5, 3.11**
    - Create test in `tests/components/ViewSettingsProvider.property.test.tsx`
    - Use fast-check to generate pairs of booleans, write via provider, remount, verify same values read back

  - [ ]* 4.4 Write property test: Toggle is self-inverse (Property 5)
    - **Property 5: Toggle is self-inverse**
    - **Validates: Requirements 3.5, 3.6**
    - Create test in `tests/components/ViewSettingsProvider.property.test.tsx`
    - Use fast-check to generate initial boolean and even number of toggles, verify state returns to initial

- [x] 5. Checkpoint - Verify integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Final cleanup and wiring validation
  - [x] 6.1 Remove MermaidProvider file and update remaining imports
    - Delete `src/components/MermaidProvider.tsx` (replaced by ViewSettingsProvider)
    - Update any remaining imports across the codebase referencing the old provider
    - Ensure `ReaderView` and `MermaidDiagramRenderer` use the new `useViewSettings()` hook correctly
    - _Requirements: 3.1, 3.11_

  - [ ]* 6.2 Write unit tests for CopyButton and SettingsDropdown
    - Test CopyButton renders with correct aria-label and min 32×32px
    - Test CopyButton shows checkmark after successful copy, reverts after 2s
    - Test CopyButton handles clipboard failure gracefully
    - Test SettingsDropdown opens on click, shows both toggles with correct labels
    - Test SettingsDropdown closes on Escape, returns focus to trigger
    - _Requirements: 1.1, 1.4, 1.6, 1.7, 3.2, 3.3, 3.7_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest with jsdom environment and fast-check for property-based tests
- shadcn/ui DropdownMenu and Switch must be installed before building the SettingsDropdown (task 1.2)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 3, "tasks": ["2.3", "4.2"] },
    { "id": 4, "tasks": ["2.4", "2.5", "3.3", "4.3", "4.4"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
