// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { usePathname } from 'next/navigation'
import { BottomBar } from './bottom-bar'

describe('BottomBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePathname).mockReturnValue('/')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all 5 nav links', () => {
    render(<BottomBar />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[1]).toHaveAttribute('href', '/exercises')
    expect(links[2]).toHaveAttribute('href', '/mesocycles')
    expect(links[3]).toHaveAttribute('href', '/calendar')
    expect(links[4]).toHaveAttribute('href', '/routines')
  })

  it('does not render logout button', () => {
    render(<BottomBar />)
    expect(screen.queryByTestId('sidebar-logout')).not.toBeInTheDocument()
  })

  it('highlights active route', () => {
    vi.mocked(usePathname).mockReturnValue('/calendar')
    render(<BottomBar />)
    const links = screen.getAllByRole('link')
    const calendarLink = links[3]
    expect(calendarLink.className).toMatch(/text-primary/)
    expect(links[0].className).toMatch(/text-muted-foreground/)
  })

  it('is visible on mobile, hidden on desktop', () => {
    const { container } = render(<BottomBar />)
    const nav = container.firstElementChild
    expect(nav?.className).toMatch(/flex/)
    expect(nav?.className).toMatch(/md:hidden/)
  })

  it('is fixed to bottom', () => {
    const { container } = render(<BottomBar />)
    const nav = container.firstElementChild
    expect(nav?.className).toMatch(/fixed/)
    expect(nav?.className).toMatch(/bottom-0/)
  })
})
