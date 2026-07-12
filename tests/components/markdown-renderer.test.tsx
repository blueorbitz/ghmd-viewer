import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { ThemeProvider } from '@/components/ThemeProvider'

const defaultProps = {
  content: '',
  basePath: 'docs',
  owner: 'octocat',
  repo: 'hello-world',
  branch: 'main',
  isPrivate: false,
  mermaidEnabled: true,
  onNavigate: () => {},
}

function renderMarkdown(content: string) {
  return render(
    <ThemeProvider>
      <MarkdownRenderer {...defaultProps} content={content} />
    </ThemeProvider>,
  )
}

describe('MarkdownRenderer', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  describe('Headings', () => {
    it('renders h1 through h6', () => {
      const md = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`
      renderMarkdown(md)

      expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Heading 2' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 3, name: 'Heading 3' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 4, name: 'Heading 4' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 5, name: 'Heading 5' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 6, name: 'Heading 6' })).toBeInTheDocument()
    })
  })

  describe('Inline formatting', () => {
    it('renders bold text', () => {
      renderMarkdown('This is **bold** text')
      const bold = screen.getByText('bold')
      expect(bold.tagName).toBe('STRONG')
    })

    it('renders italic text', () => {
      renderMarkdown('This is *italic* text')
      const em = screen.getByText('italic')
      expect(em.tagName).toBe('EM')
    })

    it('renders inline code', () => {
      renderMarkdown('Use `console.log()` for debugging')
      const code = screen.getByText('console.log()')
      expect(code.tagName).toBe('CODE')
    })

    it('renders strikethrough (GFM)', () => {
      renderMarkdown('This is ~~deleted~~ text')
      const del = screen.getByText('deleted')
      expect(del.tagName).toBe('DEL')
    })
  })

  describe('Lists', () => {
    it('renders unordered lists', () => {
      renderMarkdown(`- Item 1\n- Item 2\n- Item 3`)
      expect(screen.getByText('Item 1')).toBeInTheDocument()
      expect(screen.getByText('Item 2')).toBeInTheDocument()
      expect(screen.getByText('Item 3')).toBeInTheDocument()
    })

    it('renders ordered lists', () => {
      renderMarkdown(`1. First\n2. Second\n3. Third`)
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })

    it('renders task lists (GFM)', () => {
      renderMarkdown(`- [x] Done\n- [ ] Todo`)
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).not.toBeChecked()
    })
  })

  describe('Blockquotes', () => {
    it('renders blockquotes', () => {
      renderMarkdown('> This is a quote')
      const blockquote = screen.getByText('This is a quote').closest('blockquote')
      expect(blockquote).toBeInTheDocument()
    })
  })

  describe('Horizontal rules', () => {
    it('renders horizontal rules', () => {
      const { container } = renderMarkdown('Before\n\n---\n\nAfter')
      const hr = container.querySelector('hr')
      expect(hr).toBeInTheDocument()
    })
  })

  describe('Tables (GFM)', () => {
    it('renders tables with headers', () => {
      const md = `| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`
      renderMarkdown(md)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Age')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  describe('Code blocks', () => {
    it('renders fenced code blocks with language as highlighted code', () => {
      const md = '```javascript\nconst x = 42;\n```'
      const { container } = renderMarkdown(md)

      const pre = container.querySelector('pre')
      expect(pre).toBeInTheDocument()
      const code = pre?.querySelector('code')
      expect(code).toBeInTheDocument()
      expect(code?.className).toContain('language-javascript')
    })

    it('renders fenced code blocks without language as plain monospace', () => {
      const md = '```\nplain text block\n```'
      const { container } = renderMarkdown(md)

      const pre = container.querySelector('pre')
      expect(pre).toBeInTheDocument()
      const code = pre?.querySelector('code')
      expect(code).toBeInTheDocument()
      expect(code?.textContent).toContain('plain text block')
    })
  })

  describe('Links', () => {
    it('renders links', () => {
      renderMarkdown('[GitHub](https://github.com)')
      const link = screen.getByRole('link', { name: 'GitHub' })
      expect(link).toHaveAttribute('href', 'https://github.com')
    })

    it('renders autolinks (GFM)', () => {
      renderMarkdown('Visit https://example.com for more')
      const link = screen.getByRole('link', { name: 'https://example.com' })
      expect(link).toHaveAttribute('href', 'https://example.com')
    })
  })

  describe('Theme integration', () => {
    it('applies markdown-body class to container', () => {
      const { container } = renderMarkdown('# Hello')
      const markdownBody = container.querySelector('.markdown-body')
      expect(markdownBody).toBeInTheDocument()
    })

    it('applies dark class when theme is dark', () => {
      localStorage.setItem('ghmd-theme', 'dark')
      const { container } = render(
        <ThemeProvider>
          <MarkdownRenderer {...defaultProps} content="# Hello" />
        </ThemeProvider>,
      )
      const markdownBody = container.querySelector('.markdown-body')
      expect(markdownBody).toHaveClass('markdown-body--dark')
    })
  })
})
