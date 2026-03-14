// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('renders "Planned" with blue styling', () => {
    render(<StatusBadge status="planned" />)
    const badge = screen.getByText('Planned')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-blue-100')
  })

  it('renders "Active" with green styling', () => {
    render(<StatusBadge status="active" />)
    const badge = screen.getByText('Active')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-green-100')
  })

  it('renders "Completed" with gray styling', () => {
    render(<StatusBadge status="completed" />)
    const badge = screen.getByText('Completed')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-gray-100')
  })
})
