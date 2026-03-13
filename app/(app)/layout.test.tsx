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

  it('renders sidebar and bottom bar', () => {
    render(<AppLayout>content</AppLayout>)
    const todayLinks = screen.getAllByRole('link', { name: /today/i })
    expect(todayLinks.length).toBe(2)
  })
})
