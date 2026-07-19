# Requirements Document

## Introduction

This feature enhances the GitHub Markdown Viewer application with three improvements to the reader experience: a copy-to-clipboard button on rendered code blocks, a toggle to switch between rendered markdown and raw source text, and a unified dropdown control that consolidates the raw markdown toggle with the existing Mermaid diagram toggle into a single cohesive UI element using switch-style controls.

## Glossary

- **Markdown_Viewer**: The React/TypeScript frontend application that renders GitHub markdown files with syntax highlighting, Mermaid diagrams, and GFM support.
- **Code_Block**: A fenced code block rendered within the markdown content, displayed with syntax highlighting via rehype-highlight.
- **Copy_Button**: A clickable button element overlaid on a Code_Block that copies the block's text content to the system clipboard.
- **Raw_View**: A display mode showing the unprocessed markdown source text of the currently loaded file, as opposed to the rendered HTML output.
- **Rendered_View**: The default display mode showing the markdown content rendered as formatted HTML with syntax highlighting, images, and diagrams.
- **View_Toggle**: A switch-style control within the Settings_Dropdown that allows users to switch between Rendered_View and Raw_View.
- **Settings_Dropdown**: A unified dropdown menu in the Header that contains switch-style controls for toggling display options including Mermaid diagram rendering and the Raw_View mode.
- **Mermaid_Toggle**: A switch-style control within the Settings_Dropdown that enables or disables rendering of Mermaid diagram code blocks as visual diagrams.

## Requirements

### Requirement 1: Code Block Copy Button

**User Story:** As a user reading markdown documentation, I want to copy code blocks to my clipboard with a single click, so that I can quickly use code snippets without manually selecting text.

#### Acceptance Criteria

1. WHEN a Code_Block is rendered within the Markdown_Viewer, THE Copy_Button SHALL appear positioned at the top-right corner of the Code_Block container, overlaying the code content with a fixed size of at least 32×32 CSS pixels.
2. WHEN a user hovers over or focuses a Code_Block, THE Copy_Button SHALL be displayed with a minimum contrast ratio of 3:1 against the code block background, conforming to WCAG 2.1 Level AA for non-text elements.
3. WHEN the user clicks the Copy_Button, THE Markdown_Viewer SHALL copy the raw text content of the associated Code_Block (excluding any HTML markup from syntax highlighting) to the system clipboard.
4. WHEN the clipboard write operation completes successfully, THE Copy_Button SHALL display a visual confirmation icon (such as a checkmark) for 2 seconds before reverting to the default copy icon.
5. IF the user clicks the Copy_Button while the confirmation icon is displayed, THEN THE Markdown_Viewer SHALL re-copy the code block content to the clipboard and restart the 2-second confirmation timer.
6. IF the clipboard write operation fails, THEN THE Copy_Button SHALL revert to the default state without displaying a success indicator.
7. THE Copy_Button SHALL be accessible via keyboard navigation and include an aria-label of "Copy code to clipboard".
8. THE Copy_Button SHALL NOT appear on inline code spans — only on fenced code blocks rendered within a pre element.

### Requirement 2: Raw Markdown View Toggle

**User Story:** As a user viewing a markdown file, I want to toggle between the rendered output and the raw markdown source, so that I can inspect the original markup syntax.

#### Acceptance Criteria

1. WHEN the View_Toggle is switched to the raw position, THE Markdown_Viewer SHALL display the raw markdown source text of the current file in a monospace font within a scrollable container.
2. WHEN the View_Toggle is switched to the rendered position, THE Markdown_Viewer SHALL display the fully rendered markdown output with syntax highlighting, images, and diagrams.
3. WHEN the user switches between Raw_View and Rendered_View, THE Markdown_Viewer SHALL reset the content area scroll position to the top of the container.
4. WHILE the Raw_View is active, THE Markdown_Viewer SHALL display the raw text without any markdown processing, syntax highlighting, or HTML rendering.
5. THE Markdown_Viewer SHALL persist the View_Toggle state in localStorage so that the preference is retained across page reloads, defaulting to Rendered_View when no persisted preference exists or when localStorage is unavailable.
6. WHEN a different file is selected from the sidebar, THE Markdown_Viewer SHALL apply the current View_Toggle state to the newly loaded file content.

### Requirement 3: Unified Settings Dropdown

**User Story:** As a user, I want the display options (Mermaid toggle and raw markdown toggle) consolidated into a single dropdown menu, so that the header remains uncluttered and settings are easy to find.

#### Acceptance Criteria

1. THE Settings_Dropdown SHALL replace the existing standalone Mermaid toggle button in the Header with a single trigger button.
2. WHEN the user clicks the Settings_Dropdown trigger button, THE Settings_Dropdown SHALL open a dropdown menu displaying the Mermaid_Toggle and View_Toggle controls.
3. THE Settings_Dropdown SHALL contain a Mermaid_Toggle presented as a labeled switch control with the label "Mermaid Diagrams", defaulting to the on position.
4. THE Settings_Dropdown SHALL contain a View_Toggle presented as a labeled switch control with the label "Raw Markdown", defaulting to the off position (rendered view shown).
5. WHEN the user toggles the Mermaid_Toggle within the Settings_Dropdown, THE Markdown_Viewer SHALL enable or disable Mermaid diagram rendering in the content area, and the switch control SHALL visually reflect the current state (on or off).
6. WHEN the user toggles the View_Toggle within the Settings_Dropdown, THE Markdown_Viewer SHALL switch the content area between Rendered_View and Raw_View, and the switch control SHALL visually reflect the current state (on or off).
7. WHEN the user clicks outside of the Settings_Dropdown or presses the Escape key, THE Settings_Dropdown SHALL close and return focus to the trigger button.
8. THE Settings_Dropdown trigger button SHALL use a settings or sliders icon from the lucide-react icon library and include an aria-label of "Display settings".
9. THE Settings_Dropdown SHALL be keyboard accessible — users SHALL be able to open the dropdown with Enter or Space, navigate between toggles using Tab or Arrow keys, and activate them using Enter or Space.
10. THE Settings_Dropdown SHALL use shadcn/ui DropdownMenu components for consistent styling and behavior with the existing application design.
11. THE Settings_Dropdown SHALL persist the state of both toggles in localStorage so that user preferences are preserved across page reloads.
