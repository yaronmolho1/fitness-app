// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { EmptyState } from './empty-state'
import { Dumbbell } from 'lucide-react'

afterEach(cleanup)

describe('EmptyState', () => {
  it('renders message text', () => {
    render(<EmptyState message="No exercises yet" />)
    expect(screen.getByText('No exercises yet')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<EmptyState message="No items" icon={Dumbbell} />)
    expect(screen.getByTestId('empty-state-icon')).toBeInTheDocument()
  })

  it('renders without icon when not provided', () => {
    render(<EmptyState message="No items" />)
    expect(screen.queryByTestId('empty-state-icon')).not.toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    render(
      <EmptyState
        message="No items"
        action={{ label: 'Create Exercise', href: '/exercises/new' }}
      />
    )
    const link = screen.getByRole('link', { name: 'Create Exercise' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/exercises/new')
  })

  it('renders without action when not provided', () => {
    render(<EmptyState message="No items" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <EmptyState
        message="No items"
        description="Get started by creating one."
      />
    )
    expect(screen.getByText('Get started by creating one.')).toBeInTheDocument()
  })

  it('has consistent layout classes', () => {
    const { container } = render(<EmptyState message="No items" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('text-center')
    expect(wrapper.className).toContain('py-12')
  })
})
