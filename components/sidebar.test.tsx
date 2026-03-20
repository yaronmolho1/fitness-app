// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: pushMock, refresh: refreshMock })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePathname).mockReturnValue('/')
    global.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true }))))
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all 6 nav links including Progression', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6)
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[1]).toHaveAttribute('href', '/exercises')
    expect(links[2]).toHaveAttribute('href', '/mesocycles')
    expect(links[3]).toHaveAttribute('href', '/calendar')
    expect(links[4]).toHaveAttribute('href', '/progression')
    expect(links[5]).toHaveAttribute('href', '/routines')
  })

  it('renders logout button', () => {
    render(<Sidebar />)
    expect(screen.getByTestId('sidebar-logout')).toBeInTheDocument()
  })

  it('highlights active route', () => {
    vi.mocked(usePathname).mockReturnValue('/exercises')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const exercisesLink = links[1]
    expect(exercisesLink.className).toContain('bg-accent text-accent-foreground')
    expect(links[0].className).not.toContain('bg-accent text-accent-foreground')
  })

  it('highlights progression route when active', () => {
    vi.mocked(usePathname).mockReturnValue('/progression')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    expect(links[4]).toHaveAttribute('href', '/progression')
    expect(links[4].className).toContain('bg-accent text-accent-foreground')
  })

  it('calls logout endpoint and redirects', async () => {
    render(<Sidebar />)
    const logoutBtn = screen.getByTestId('sidebar-logout')
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
      expect(pushMock).toHaveBeenCalledWith('/login')
    })
  })

  it('has hidden class for mobile', () => {
    const { container } = render(<Sidebar />)
    const nav = container.firstElementChild
    expect(nav?.className).toMatch(/hidden/)
    expect(nav?.className).toMatch(/md:flex/)
  })
})
