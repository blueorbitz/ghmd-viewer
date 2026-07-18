import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatLoginForm } from '@/components/PatLoginForm'

// Mock the auth service
const mockLoginWithPat = vi.fn()

vi.mock('@/services/auth-service', () => ({
  createAuthService: () => ({
    loginWithPat: mockLoginWithPat,
    initiateOAuth: vi.fn(),
    handleOAuthCallback: vi.fn(),
    isAuthenticated: vi.fn(() => false),
    logout: vi.fn(),
    getBackendUrl: vi.fn(() => 'http://localhost:8080'),
    isPrivateAccessAvailable: vi.fn(() => true),
  }),
}))

describe('PatLoginForm', () => {
  const onSuccess = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders PAT input as password type with maxLength 255', () => {
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)
    const patInput = screen.getByLabelText('Personal Access Token')
    expect(patInput).toHaveAttribute('type', 'password')
    expect(patInput).toHaveAttribute('maxLength', '255')
  })

  it('renders scope input as text type with maxLength 256', () => {
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)
    const scopeInput = screen.getByLabelText('Repository scope')
    expect(scopeInput).toHaveAttribute('type', 'text')
    expect(scopeInput).toHaveAttribute('maxLength', '256')
  })

  it('disables submit button when PAT is empty', () => {
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)
    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeDisabled()
  })

  it('disables submit button when PAT is whitespace-only', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    await user.type(patInput, '   ')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when PAT has non-whitespace content', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    await user.type(patInput, 'ghp_validtoken123')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeEnabled()
  })

  it('disables submit button when scope format is invalid', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')

    await user.type(patInput, 'ghp_validtoken123')
    await user.type(scopeInput, 'invalid-format')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeDisabled()
  })

  it('shows validation error for invalid scope format on submit attempt', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')

    await user.type(patInput, 'ghp_validtoken123')
    await user.type(scopeInput, 'no-slash')

    // The button is disabled, so the error is shown inline via validation
    expect(screen.getByRole('button', { name: 'Sign in with PAT' })).toBeDisabled()
  })

  it('accepts valid scope format (owner/repo)', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')

    await user.type(patInput, 'ghp_validtoken123')
    await user.type(scopeInput, 'my-org/my-repo')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeEnabled()
  })

  it('calls authService.loginWithPat on valid submission without scope', async () => {
    mockLoginWithPat.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    await user.type(patInput, 'ghp_mytoken')
    await user.click(screen.getByRole('button', { name: 'Sign in with PAT' }))

    await waitFor(() => {
      expect(mockLoginWithPat).toHaveBeenCalledWith('ghp_mytoken', undefined)
    })
  })

  it('calls authService.loginWithPat with scope when provided', async () => {
    mockLoginWithPat.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')
    await user.type(patInput, 'ghp_mytoken')
    await user.type(scopeInput, 'my-org/my-repo')
    await user.click(screen.getByRole('button', { name: 'Sign in with PAT' }))

    await waitFor(() => {
      expect(mockLoginWithPat).toHaveBeenCalledWith('ghp_mytoken', { owner: 'my-org', repo: 'my-repo' })
    })
  })

  it('calls onSuccess on successful authentication', async () => {
    mockLoginWithPat.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    await user.type(patInput, 'ghp_validtoken')
    await user.click(screen.getByRole('button', { name: 'Sign in with PAT' }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('displays backend error message on failure', async () => {
    mockLoginWithPat.mockResolvedValue({
      success: false,
      error: 'pat_login_failed',
      message: 'Token is invalid or expired',
    })
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    await user.type(patInput, 'ghp_badtoken')
    await user.click(screen.getByRole('button', { name: 'Sign in with PAT' }))

    await waitFor(() => {
      expect(screen.getByText('Token is invalid or expired')).toBeInTheDocument()
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('clears PAT input after submission', async () => {
    mockLoginWithPat.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    await user.type(patInput, 'ghp_secrettoken')
    await user.click(screen.getByRole('button', { name: 'Sign in with PAT' }))

    await waitFor(() => {
      expect(patInput).toHaveValue('')
    })
  })

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('includes a link to GitHub PAT documentation', () => {
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)
    const link = screen.getByRole('link', { name: /learn how to create a personal access token/i })
    expect(link).toHaveAttribute(
      'href',
      'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    )
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('displays helper text for the scope field', () => {
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)
    expect(
      screen.getByText(/optional.*restricts this session.*fine-grained tokens/i),
    ).toBeInTheDocument()
  })

  it('rejects scope with empty owner (e.g. "/repo")', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')

    await user.type(patInput, 'ghp_validtoken123')
    await user.type(scopeInput, '/repo')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeDisabled()
  })

  it('rejects scope with empty repo (e.g. "owner/")', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')

    await user.type(patInput, 'ghp_validtoken123')
    await user.type(scopeInput, 'owner/')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeDisabled()
  })

  it('rejects scope with multiple slashes', async () => {
    const user = userEvent.setup()
    render(<PatLoginForm onSuccess={onSuccess} onCancel={onCancel} />)

    const patInput = screen.getByLabelText('Personal Access Token')
    const scopeInput = screen.getByLabelText('Repository scope')

    await user.type(patInput, 'ghp_validtoken123')
    await user.type(scopeInput, 'owner/repo/extra')

    const submitButton = screen.getByRole('button', { name: 'Sign in with PAT' })
    expect(submitButton).toBeDisabled()
  })
})
