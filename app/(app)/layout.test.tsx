// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AppLayout from './layout'

describe('(app) layout', () => {
  it('renders app-shell wrapper around children', () => {
    render(<AppLayout>content</AppLayout>)
    const shell = screen.getByTestId('app-shell')
    expect(shell).toBeInTheDocument()
    expect(shell).toHaveTextContent('content')
  })
})
