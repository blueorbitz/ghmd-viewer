import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { Header } from '@/components/Header'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ViewSettingsProvider } from '@/components/ViewSettingsProvider'

function renderHeader() {
  return render(
    <ThemeProvider>
      <ViewSettingsProvider>
        <Header />
      </ViewSettingsProvider>
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

  it('renders Settings dropdown trigger button', () => {
    renderHeader()
    expect(screen.getByLabelText('Display settings')).toBeInTheDocument()
  })

  it('does not render standalone Mermaid toggle button', () => {
    renderHeader()
    // The old standalone Mermaid button with aria-pressed is gone
    expect(screen.queryByLabelText('Disable Mermaid diagrams')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Enable Mermaid diagrams')).not.toBeInTheDocument()
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
})
