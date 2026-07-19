interface RawMarkdownViewProps {
  content: string
}

/**
 * RawMarkdownView — Displays the raw markdown source text in a monospace font.
 * No syntax highlighting, no HTML rendering, no markdown processing.
 * The text content is rendered character-for-character identical to the input.
 *
 * Requirements: 2.1, 2.4
 */
export function RawMarkdownView({ content }: RawMarkdownViewProps): JSX.Element {
  return (
    <div className="overflow-auto h-full w-full">
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm text-foreground">
        <code>{content}</code>
      </pre>
    </div>
  )
}
