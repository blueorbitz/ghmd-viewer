import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorDisplay } from '@/components/ErrorDisplay'
import type { AppError } from '@/types/app'

describe('ErrorDisplay', () => {
  it('renders the error message', () => {
    const error: AppError = {
      type: 'network',
      message: 'Network error. Please check your connection.',
      retryable: true,
      action: 'retry',
    }

    render(<ErrorDisplay error={error} />)
    expect(screen.getByText('Network error. Please check your connection.')).toBeInTheDocument()
  })

  it('renders Retry button when action is "retry" and onRetry is provided', () => {
    const error: AppError = {
      type: 'network',
      message: 'Network error.',
      retryable: true,
      action: 'retry',
    }
    const onRetry = vi.fn()

    render(<ErrorDisplay error={error} onRetry={onRetry} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('calls onRetry when Retry button is clicked', async () => {
    const user = userEvent.setup()
    const error: AppError = {
      type: 'network',
      message: 'Network error.',
      retryable: true,
      action: 'retry',
    }
    const onRetry = vi.fn()

    render(<ErrorDisplay error={error} onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders Connect GitHub button when action is "authenticate"', () => {
    const error: AppError = {
      type: 'auth_required',
      message: 'Authentication required.',
      retryable: false,
      action: 'authenticate',
    }
    const onAuthenticate = vi.fn()

    render(<ErrorDisplay error={error} onAuthenticate={onAuthenticate} />)
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeInTheDocument()
  })

  it('calls onAuthenticate when Connect GitHub button is clicked', async () => {
    const user = userEvent.setup()
    const error: AppError = {
      type: 'auth_required',
      message: 'Authentication required.',
      retryable: false,
      action: 'authenticate',
    }
    const onAuthenticate = vi.fn()

    render(<ErrorDisplay error={error} onAuthenticate={onAuthenticate} />)
    await user.click(screen.getByRole('button', { name: 'Connect GitHub' }))
    expect(onAuthenticate).toHaveBeenCalledTimes(1)
  })

  it('renders Enter New URL button when action is "new_url"', () => {
    const error: AppError = {
      type: 'not_found',
      message: 'File not found.',
      retryable: false,
      action: 'new_url',
    }
    const onNewUrl = vi.fn()

    render(<ErrorDisplay error={error} onNewUrl={onNewUrl} />)
    expect(screen.getByRole('button', { name: 'Enter New URL' })).toBeInTheDocument()
  })

  it('renders generic Retry button when retryable but no specific action', () => {
    const error: AppError = {
      type: 'network',
      message: 'Something went wrong.',
      retryable: true,
    }
    const onRetry = vi.fn()

    render(<ErrorDisplay error={error} onRetry={onRetry} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('does not render action buttons when no callbacks are provided', () => {
    const error: AppError = {
      type: 'network',
      message: 'Network error.',
      retryable: true,
      action: 'retry',
    }

    render(<ErrorDisplay error={error} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('has role="alert" for accessibility', () => {
    const error: AppError = {
      type: 'network',
      message: 'Error occurred.',
      retryable: false,
    }

    render(<ErrorDisplay error={error} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
