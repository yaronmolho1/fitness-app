// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { LoginForm } from '@/components/login-form'

describe('LoginForm', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    render(<LoginForm />)
  })

  it('renders username input, password input, and submit button', () => {
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('password field has type="password"', () => {
    const passwordInput = screen.getByLabelText(/password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('shows validation error when submitting with empty fields', async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/required/i)
  })

  it('shows validation error when only username is filled', async () => {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/username/i), 'testuser')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/required/i)
  })

  it('shows validation error when only password is filled', async () => {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/password/i), 'testpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/required/i)
  })

  it('does not show error initially', () => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
