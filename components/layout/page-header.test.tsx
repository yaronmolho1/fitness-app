// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { PageHeader } from './page-header'

afterEach(cleanup)

describe('PageHeader', () => {
  // AC6: title and optional action buttons in consistent layout
  it('renders the title', () => {
    render(<PageHeader title="Exercises" />)
    expect(screen.getByText('Exercises')).toBeInTheDocument()
  })

  it('renders title as an h1 heading', () => {
    render(<PageHeader title="My Page" />)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('My Page')
  })

  // AC9: description renders as muted text below title
  it('renders description as muted text when provided', () => {
    render(<PageHeader title="Exercises" description="Manage your exercises" />)
    const desc = screen.getByText('Manage your exercises')
    expect(desc).toBeInTheDocument()
    expect(desc.className).toContain('text-muted-foreground')
  })

  it('does not render description element when not provided', () => {
    const { container } = render(<PageHeader title="Exercises" />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  // AC6: action buttons displayed
  it('renders actions slot when provided', () => {
    render(
      <PageHeader title="Exercises" actions={<button>Add Exercise</button>} />
    )
    expect(screen.getByText('Add Exercise')).toBeInTheDocument()
  })

  // Edge case: no actions — no empty space
  it('does not render actions container when no actions provided', () => {
    const { container } = render(<PageHeader title="Exercises" />)
    const actionsDiv = container.querySelector('[data-slot="actions"]')
    expect(actionsDiv).toBeNull()
  })

  // AC10: consistent vertical spacing (mb-6 bottom margin)
  it('applies mb-6 bottom margin for spacing from content', () => {
    const { container } = render(<PageHeader title="Exercises" />)
    const header = container.firstElementChild
    expect(header?.className).toContain('mb-6')
  })

  // Spacing between title and description (space-y-1.5)
  it('applies space-y-1.5 between title and description', () => {
    const { container } = render(
      <PageHeader title="Exercises" description="Some desc" />
    )
    // The title/description wrapper should have space-y-1.5
    const titleBlock = container.querySelector('[data-slot="title-block"]')
    expect(titleBlock?.className).toContain('space-y-1.5')
  })

  // AC7: mobile — actions stack below title (flex-col on mobile)
  it('uses flex-col by default for mobile stacking', () => {
    const { container } = render(
      <PageHeader title="Exercises" actions={<button>Add</button>} />
    )
    const row = container.querySelector('[data-slot="header-row"]')
    expect(row?.className).toContain('flex-col')
  })

  // AC8: desktop — actions inline right (sm:flex-row + sm:items-center)
  it('uses sm:flex-row for desktop inline layout', () => {
    const { container } = render(
      <PageHeader title="Exercises" actions={<button>Add</button>} />
    )
    const row = container.querySelector('[data-slot="header-row"]')
    expect(row?.className).toContain('sm:flex-row')
    expect(row?.className).toContain('sm:items-center')
  })

  it('uses sm:justify-between to push actions right on desktop', () => {
    const { container } = render(
      <PageHeader title="Exercises" actions={<button>Add</button>} />
    )
    const row = container.querySelector('[data-slot="header-row"]')
    expect(row?.className).toContain('sm:justify-between')
  })

  // Edge case: very long title wraps naturally
  it('allows long titles to wrap naturally', () => {
    const longTitle = 'A'.repeat(200)
    render(<PageHeader title={longTitle} />)
    const heading = screen.getByRole('heading', { level: 1 })
    // Should not have truncate or overflow-hidden classes
    expect(heading.className).not.toContain('truncate')
    expect(heading.className).not.toContain('overflow-hidden')
  })

  // Merges custom className
  it('merges custom className', () => {
    const { container } = render(
      <PageHeader title="Test" className="custom-class" />
    )
    const header = container.firstElementChild
    expect(header?.className).toContain('custom-class')
  })

  // Breadcrumb support for detail/form pages
  it('renders breadcrumb slot above title when provided', () => {
    render(
      <PageHeader
        title="New Mesocycle"
        breadcrumb={<span>Mesocycles</span>}
      />
    )
    expect(screen.getByText('Mesocycles')).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('New Mesocycle')
  })

  it('does not render breadcrumb container when not provided', () => {
    const { container } = render(<PageHeader title="Test" />)
    const breadcrumb = container.querySelector('[data-slot="breadcrumb"]')
    expect(breadcrumb).toBeNull()
  })

  it('renders breadcrumb in data-slot="breadcrumb"', () => {
    const { container } = render(
      <PageHeader
        title="Clone"
        breadcrumb={<span>My Meso</span>}
      />
    )
    const breadcrumb = container.querySelector('[data-slot="breadcrumb"]')
    expect(breadcrumb).not.toBeNull()
  })
})
