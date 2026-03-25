// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { RetroactiveDateBanner } from './retroactive-date-banner'

describe('RetroactiveDateBanner', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows banner when date differs from today', () => {
    render(<RetroactiveDateBanner date="2026-03-20" today="2026-03-25" />)
    expect(screen.getByTestId('retroactive-banner')).toBeInTheDocument()
    expect(screen.getByText(/Logging for 20\/Mar\/2026/)).toBeInTheDocument()
  })

  it('shows "Back to Calendar" link', () => {
    render(<RetroactiveDateBanner date="2026-03-20" today="2026-03-25" />)
    const link = screen.getByRole('link', { name: /back to calendar/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/calendar')
  })

  it('renders nothing when date equals today', () => {
    const { container } = render(<RetroactiveDateBanner date="2026-03-25" today="2026-03-25" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when date is undefined', () => {
    const { container } = render(<RetroactiveDateBanner today="2026-03-25" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when date is absent', () => {
    const { container } = render(<RetroactiveDateBanner date={undefined} today="2026-03-25" />)
    expect(container.innerHTML).toBe('')
  })
})
