import { useCallback, useMemo } from 'react'
import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'
import { isExternalLink, isRelativeMarkdownLink, resolveRelativePath } from '@/services/link-resolver'
import { useTheme } from '@/components/ThemeProvider'
import { MermaidDiagramRenderer } from '@/components/MermaidDiagramRenderer'
import { MarkdownImage } from '@/components/MarkdownImage'
import { CodeBlockWrapper } from '@/components/CodeBlockWrapper'
import { FrontmatterTable, parseFrontmatter } from '@/components/FrontmatterTable'

import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'
import './MarkdownRenderer.css'

/**
 * Recursively extracts plain text from a React node tree.
 * Handles strings, numbers, arrays, and React elements (e.g., <span> from rehype-highlight).
 */
function extractTextFromNode(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextFromNode).join('')
  if (isValidElement(node)) {
    return extractTextFromNode(node.props.children)
  }
  return ''
}

export interface MarkdownRendererProps {
  content: string
  basePath: string // Repo-relative directory path for resolving relative links/images
  owner: string
  repo: string
  branch: string
  isPrivate: boolean
  mermaidEnabled: boolean
  onNavigate: (filePath: string) => void // In-app navigation for relative .md links
}

/**
 * MarkdownRenderer — Renders markdown content with GFM support, syntax highlighting,
 * Mermaid diagram rendering, image resolution, and smart link resolution.
 *
 * Requirements: 8.1-8.7, 9.1-9.5, 10.1-10.6
 */
export function MarkdownRenderer({
  content,
  basePath,
  owner,
  repo,
  branch,
  isPrivate,
  mermaidEnabled,
  onNavigate,
}: MarkdownRendererProps) {
  const { effectiveTheme } = useTheme()

  // Handle click on relative .md links for in-app navigation
  const handleMdLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, resolvedPath: string) => {
      e.preventDefault()
      onNavigate(resolvedPath)
    },
    [onNavigate],
  )

  // Custom components for react-markdown
  const components: Components = useMemo(
    () => ({
      a: ({ href, children, ...props }) => {
        const linkHref = href ?? ''

        // External links: open in new tab
        if (isExternalLink(linkHref)) {
          return (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          )
        }

        // Relative .md links: in-app navigation
        if (isRelativeMarkdownLink(linkHref)) {
          const resolvedPath = resolveRelativePath(basePath, linkHref)
          return (
            <a
              href={linkHref}
              onClick={(e) => handleMdLinkClick(e, resolvedPath)}
              {...props}
            >
              {children}
            </a>
          )
        }

        // All other links: render as normal anchor
        return (
          <a href={linkHref} {...props}>
            {children}
          </a>
        )
      },

      // Custom code block handler for Mermaid diagrams
      code: ({ className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '')
        const language = match ? match[1] : null
        const codeString = String(children).replace(/\n$/, '')

        // Mermaid code blocks are rendered as diagrams
        if (language === 'mermaid') {
          return (
            <MermaidDiagramRenderer
              code={codeString}
              enabled={mermaidEnabled}
            />
          )
        }

        // Regular code blocks — render with syntax highlighting (handled by rehype-highlight)
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },

      // Use pre to detect block-level code and pass through for mermaid handling
      pre: ({ children, ...props }) => {
        // If the child is a MermaidDiagramRenderer (rendered from mermaid code block),
        // or a code element with language-mermaid class, render it without wrapping in <pre>
        const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
        if (child && typeof child === 'object' && 'props' in child) {
          const childClassName = child.props?.className || ''
          // Check for mermaid language class or if child is already a MermaidDiagramRenderer
          if (/language-mermaid/.test(childClassName)) {
            return <>{children}</>
          }
          // When our custom code component returns a MermaidDiagramRenderer,
          // it won't have the className. Check if the child type is our MermaidDiagramRenderer.
          if (child.type === MermaidDiagramRenderer) {
            return <>{children}</>
          }
        }

        // For non-mermaid fenced code blocks, wrap with CodeBlockWrapper
        // Extract raw text by recursively walking the React element tree
        // (rehype-highlight wraps tokens in <span> elements)
        let rawText = ''
        if (child && typeof child === 'object' && 'props' in child) {
          rawText = extractTextFromNode(child.props?.children).replace(/\n$/, '')
        }

        return (
          <CodeBlockWrapper rawText={rawText}>
            <pre {...props}>{children}</pre>
          </CodeBlockWrapper>
        )
      },

      // Custom image component with URL resolution and error handling
      img: ({ src, alt, ...props }) => {
        return (
          <MarkdownImage
            src={src}
            alt={alt}
            basePath={basePath}
            owner={owner}
            repo={repo}
            branch={branch}
            isPrivate={isPrivate}
            {...props}
          />
        )
      },
    }),
    [basePath, owner, repo, branch, isPrivate, mermaidEnabled, handleMdLinkClick],
  )

  // Parse frontmatter from content
  const { data: frontmatter, body: markdownBody } = useMemo(
    () => parseFrontmatter(content),
    [content],
  )

  const containerClass = effectiveTheme === 'dark'
    ? 'markdown-body markdown-body--dark'
    : 'markdown-body'

  return (
    <div className={containerClass}>
      {frontmatter && <FrontmatterTable data={frontmatter} />}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {markdownBody}
      </ReactMarkdown>
    </div>
  )
}
