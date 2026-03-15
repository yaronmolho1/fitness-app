// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from './status-badge'

describe('StatusBadge', () => {
  it('renders "Planned" with outline variant', () => {
    render(<StatusBadge status="planned" />)
    const badge = screen.getByText('Planned')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('text-foreground')
  })

  it('renders "Active" with default/primary variant', () => {
    render(<StatusBadge status="active" />)
    const badge = screen.getByText('Active')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-primary')
  })

  it('renders "Completed" with secondary variant', () => {
    render(<StatusBadge status="completed" />)
    const badge = screen.getByText('Completed')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-secondary')
  })
})
