import { useMemo } from 'react'

export interface FrontmatterTableProps {
  data: Record<string, string>
}

/**
 * Parses YAML frontmatter from markdown content.
 * Returns the parsed key-value pairs and the remaining content without frontmatter.
 */
export function parseFrontmatter(content: string): {
  data: Record<string, string> | null
  body: string
} {
  const trimmed = content.trimStart()

  // Check if content starts with frontmatter delimiter
  if (!trimmed.startsWith('---')) {
    return { data: null, body: content }
  }

  // Find the closing delimiter
  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1) {
    return { data: null, body: content }
  }

  const frontmatterBlock = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trimStart()

  if (!frontmatterBlock) {
    return { data: null, body: content }
  }

  // Parse simple YAML key-value pairs
  const data: Record<string, string> = {}
  const lines = frontmatterBlock.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) continue

    const colonIndex = trimmedLine.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmedLine.slice(0, colonIndex).trim()
    let value = trimmedLine.slice(colonIndex + 1).trim()

    // Remove surrounding quotes if present
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1)
    }

    if (key) {
      data[key] = value
    }
  }

  if (Object.keys(data).length === 0) {
    return { data: null, body: content }
  }

  return { data, body }
}

/**
 * FrontmatterTable — Renders YAML frontmatter metadata as a styled table.
 */
export function FrontmatterTable({ data }: FrontmatterTableProps) {
  const entries = useMemo(() => Object.entries(data), [data])

  if (entries.length === 0) return null

  return (
    <div className="frontmatter-table">
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td><code>{key}</code></td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
