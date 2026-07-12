import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MermaidDiagramRenderer } from '@/components/MermaidDiagramRenderer'

const mockRender = vi.fn()
const mockInitialize = vi.fn()

// Mock the mermaid module
vi.mock('mermaid', () => ({
  default: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    render: (...args: unknown[]) => mockRender(...args),
  },
}))

describe('MermaidDiagramRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when disabled', () => {
    it('should display raw source code in a code block', () => {
      const code = 'graph TD\n  A --> B'
      render(<MermaidDiagramRenderer code={code} enabled={false} />)

      const preElement = document.querySelector('pre')
      expect(preElement).toBeInTheDocument()
      const codeElement = preElement?.querySelector('code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toBe(code)
    })

    it('should not attempt to render mermaid diagrams', () => {
      const code = 'graph TD\n  A --> B'
      render(<MermaidDiagramRenderer code={code} enabled={false} />)

      expect(mockRender).not.toHaveBeenCalled()
    })
  })

  describe('when enabled', () => {
    it('should show a loading state initially', () => {
      mockRender.mockImplementation(() => new Promise(() => {})) // never resolves

      render(<MermaidDiagramRenderer code="graph TD\n  A --> B" enabled={true} />)

      expect(screen.getByText('Rendering diagram...')).toBeInTheDocument()
    })

    it('should render SVG on successful mermaid render', async () => {
      const mockSvg = '<svg><text>Rendered Diagram</text></svg>'
      mockRender.mockResolvedValue({ svg: mockSvg })

      render(<MermaidDiagramRenderer code="graph TD\n  A --> B" enabled={true} />)

      await waitFor(() => {
        const container = document.querySelector('[class*="overflow-x-auto"]')
        expect(container).toBeInTheDocument()
        expect(container?.innerHTML).toContain(mockSvg)
      })
    })

    it('should show error message and raw source on syntax error', async () => {
      mockRender.mockRejectedValue(new Error('Syntax error in graph'))

      const code = 'invalid mermaid syntax'
      render(<MermaidDiagramRenderer code={code} enabled={true} />)

      await waitFor(() => {
        expect(screen.getByText(/Mermaid rendering error:/)).toBeInTheDocument()
        expect(screen.getByText('Syntax error in graph')).toBeInTheDocument()
      })

      // Also check raw source is shown
      const codeElement = document.querySelector('pre code')
      expect(codeElement?.textContent).toBe(code)
    })

    it('should show timeout error and raw source when rendering takes too long', async () => {
      // Use a render that delays longer than our short test timeout
      mockRender.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ svg: '<svg></svg>' }), 500))
      )

      const code = 'graph TD\n  A --> B'

      render(<MermaidDiagramRenderer code={code} enabled={true} renderTimeout={50} />)

      await waitFor(() => {
        expect(screen.getByText(/Mermaid rendering error:/)).toBeInTheDocument()
        expect(screen.getByText(/timed out after 5 seconds/)).toBeInTheDocument()
      })

      const codeElement = document.querySelector('pre code')
      expect(codeElement?.textContent).toBe(code)
    }, 10000)
  })

  describe('transitions between enabled and disabled', () => {
    it('should switch from SVG to raw code when disabled after successful render', async () => {
      const mockSvg = '<svg><text>Rendered</text></svg>'
      mockRender.mockResolvedValue({ svg: mockSvg })

      const code = 'graph TD\n  A --> B'
      const { rerender } = render(<MermaidDiagramRenderer code={code} enabled={true} />)

      await waitFor(() => {
        const container = document.querySelector('[class*="overflow-x-auto"]')
        expect(container?.innerHTML).toContain(mockSvg)
      })

      // Now disable
      rerender(<MermaidDiagramRenderer code={code} enabled={false} />)

      const codeElement = document.querySelector('pre code')
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toBe(code)
    })
  })
})
