// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import AppLayout from './layout'

describe('(app) layout', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders app-shell wrapper around children', () => {
    render(<AppLayout>content</AppLayout>)
    const shell = screen.getByTestId('app-shell')
    expect(shell).toBeInTheDocument()
    expect(shell).toHaveTextContent('content')
  })

  it('renders desktop sidebar nav links', () => {
    render(<AppLayout>content</AppLayout>)
    // Desktop sidebar should have nav links visible
    expect(screen.getByRole('link', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /exercises/i })).toBeInTheDocument()
  })
})
