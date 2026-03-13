// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AuthLayout from './layout'

describe('(auth) layout', () => {
  it('renders children without app-shell wrapper', () => {
    render(<AuthLayout>login content</AuthLayout>)
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
    expect(screen.getByText('login content')).toBeInTheDocument()
  })
})
