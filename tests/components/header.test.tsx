import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { Header } from '@/components/Header'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MermaidProvider } from '@/components/MermaidProvider'

function renderHeader() {
  return render(
    <ThemeProvider>
      <MermaidProvider>
        <Header />
      </MermaidProvider>
    </ThemeProvider>,
  )
}

describe('Header', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')
  })

  it('renders the app title', () => {
    renderHeader()
    expect(screen.getByText('GitHub Markdown Viewer')).toBeInTheDocument()
  })

  it('renders theme toggle button', () => {
    renderHeader()
    // Default preference is 'system', so label is 'Switch to light theme'
    expect(screen.getByLabelText('Switch to light theme')).toBeInTheDocument()
  })

  it('renders Mermaid toggle button', () => {
    renderHeader()
    expect(screen.getByText('Mermaid')).toBeInTheDocument()
  })

  it('cycles theme: light → dark → system → light', async () => {
    const user = userEvent.setup()
    renderHeader()

    // Default is system (since no stored value), but label depends on resolved state
    // With no stored value, preference is 'system', so label is 'Switch to light theme'
    const systemBtn = screen.getByLabelText('Switch to light theme')
    expect(systemBtn).toBeInTheDocument()

    // Click to go from system → light
    await user.click(systemBtn)
    expect(screen.getByLabelText('Switch to dark theme')).toBeInTheDocument()
    expect(localStorage.getItem('ghmd-theme')).toBe('light')

    // Click to go from light → dark
    await user.click(screen.getByLabelText('Switch to dark theme'))
    expect(screen.getByLabelText('Switch to system theme')).toBeInTheDocument()
    expect(localStorage.getItem('ghmd-theme')).toBe('dark')

    // Click to go from dark → system
    await user.click(screen.getByLabelText('Switch to system theme'))
    expect(screen.getByLabelText('Switch to light theme')).toBeInTheDocument()
    expect(localStorage.getItem('ghmd-theme')).toBe('system')
  })

  it('toggles Mermaid state on click', async () => {
    const user = userEvent.setup()
    renderHeader()

    const mermaidBtn = screen.getByLabelText('Disable Mermaid diagrams')
    expect(mermaidBtn).toBeInTheDocument()
    expect(mermaidBtn).toHaveAttribute('aria-pressed', 'true')

    await user.click(mermaidBtn)
    expect(screen.getByLabelText('Enable Mermaid diagrams')).toBeInTheDocument()
    expect(localStorage.getItem('ghmd-mermaid-enabled')).toBe('false')

    await user.click(screen.getByLabelText('Enable Mermaid diagrams'))
    expect(screen.getByLabelText('Disable Mermaid diagrams')).toBeInTheDocument()
    expect(localStorage.getItem('ghmd-mermaid-enabled')).toBe('true')
  })

  it('persists Mermaid state to localStorage', async () => {
    const user = userEvent.setup()
    renderHeader()

    // Default is enabled
    expect(localStorage.getItem('ghmd-mermaid-enabled')).toBe('true')

    // Disable
    await user.click(screen.getByLabelText('Disable Mermaid diagrams'))
    expect(localStorage.getItem('ghmd-mermaid-enabled')).toBe('false')
  })

  it('restores Mermaid state from localStorage', () => {
    localStorage.setItem('ghmd-mermaid-enabled', 'false')
    renderHeader()

    expect(screen.getByLabelText('Enable Mermaid diagrams')).toBeInTheDocument()
  })

  it('applies line-through styling when Mermaid is disabled', async () => {
    const user = userEvent.setup()
    renderHeader()

    const mermaidText = screen.getByText('Mermaid')
    expect(mermaidText).not.toHaveClass('line-through')

    await user.click(screen.getByLabelText('Disable Mermaid diagrams'))
    const disabledText = screen.getByText('Mermaid')
    expect(disabledText).toHaveClass('line-through')
  })
})
