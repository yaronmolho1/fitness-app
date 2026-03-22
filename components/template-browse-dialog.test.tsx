// @vitest-environment jsdom
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TemplateBrowseDialog } from './template-browse-dialog'
import type { BrowseTemplate } from '@/lib/templates/browse-queries'

function makeBrowseTemplate(overrides: Partial<BrowseTemplate> = {}): BrowseTemplate {
  return {
    id: 1,
    name: 'Push A',
    canonical_name: 'push-a',
    modality: 'resistance',
    exercise_count: 4,
    mesocycle_id: 10,
    mesocycle_name: 'Hypertrophy Block',
    ...overrides,
  }
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onCopy: vi.fn(),
  templates: [] as BrowseTemplate[],
  isPending: false,
}

describe('TemplateBrowseDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('renders dialog with title', () => {
    render(<TemplateBrowseDialog {...defaultProps} />)
    expect(screen.getByText('Copy from Existing')).toBeInTheDocument()
  })

  it('shows empty state when no templates', () => {
    render(<TemplateBrowseDialog {...defaultProps} templates={[]} />)
    expect(screen.getByText('No other templates available')).toBeInTheDocument()
  })

  it('groups templates by mesocycle name', () => {
    const templates = [
      makeBrowseTemplate({ id: 1, name: 'Push A', mesocycle_id: 10, mesocycle_name: 'Hypertrophy Block' }),
      makeBrowseTemplate({ id: 2, name: 'Pull A', mesocycle_id: 10, mesocycle_name: 'Hypertrophy Block' }),
      makeBrowseTemplate({ id: 3, name: 'Easy Run', mesocycle_id: 20, mesocycle_name: 'Strength Block', modality: 'running', exercise_count: 0 }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    expect(screen.getByText('Hypertrophy Block')).toBeInTheDocument()
    expect(screen.getByText('Strength Block')).toBeInTheDocument()
  })

  it('shows modality badge for each template', () => {
    const templates = [
      makeBrowseTemplate({ id: 1, modality: 'resistance' }),
      makeBrowseTemplate({ id: 2, name: 'Run', modality: 'running', mesocycle_id: 20, mesocycle_name: 'Block 2' }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    expect(screen.getByText('resistance')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('shows exercise count for resistance templates', () => {
    const templates = [
      makeBrowseTemplate({ id: 1, modality: 'resistance', exercise_count: 5 }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    expect(screen.getByText(/5 exercises/)).toBeInTheDocument()
  })

  it('does not show exercise count for non-resistance templates', () => {
    const templates = [
      makeBrowseTemplate({ id: 1, modality: 'running', name: 'Easy Run', exercise_count: 0 }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    expect(screen.queryByText(/exercises/)).not.toBeInTheDocument()
  })

  it('filters templates by search input', async () => {
    const user = userEvent.setup()
    const templates = [
      makeBrowseTemplate({ id: 1, name: 'Push A' }),
      makeBrowseTemplate({ id: 2, name: 'Pull B' }),
      makeBrowseTemplate({ id: 3, name: 'Easy Run', modality: 'running' }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    const search = screen.getByPlaceholderText('Search templates...')
    await user.type(search, 'Push')

    expect(screen.getByText('Push A')).toBeInTheDocument()
    expect(screen.queryByText('Pull B')).not.toBeInTheDocument()
    expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
  })

  it('search is case-insensitive', async () => {
    const user = userEvent.setup()
    const templates = [
      makeBrowseTemplate({ id: 1, name: 'Push A' }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    await user.type(screen.getByPlaceholderText('Search templates...'), 'push')
    expect(screen.getByText('Push A')).toBeInTheDocument()
  })

  it('calls onCopy with template id when copy button clicked', async () => {
    const user = userEvent.setup()
    const templates = [
      makeBrowseTemplate({ id: 42, name: 'Push A' }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: /copy/i }))
    expect(defaultProps.onCopy).toHaveBeenCalledWith(42)
  })

  it('disables copy buttons when isPending', () => {
    const templates = [
      makeBrowseTemplate({ id: 1, name: 'Push A' }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} isPending={true} />)

    const copyBtn = screen.getByRole('button', { name: /copy/i })
    expect(copyBtn).toBeDisabled()
  })

  it('hides mesocycle group when all its templates are filtered out', async () => {
    const user = userEvent.setup()
    const templates = [
      makeBrowseTemplate({ id: 1, name: 'Push A', mesocycle_name: 'Block 1' }),
      makeBrowseTemplate({ id: 2, name: 'Easy Run', modality: 'running', mesocycle_id: 20, mesocycle_name: 'Block 2' }),
    ]
    render(<TemplateBrowseDialog {...defaultProps} templates={templates} />)

    await user.type(screen.getByPlaceholderText('Search templates...'), 'Push')

    expect(screen.getByText('Block 1')).toBeInTheDocument()
    expect(screen.queryByText('Block 2')).not.toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(<TemplateBrowseDialog {...defaultProps} open={false} />)
    expect(screen.queryByText('Copy from Existing')).not.toBeInTheDocument()
  })

  it('displays error message when copy fails', () => {
    const templates = [
      makeBrowseTemplate({ id: 1, name: 'Push A' }),
    ]
    render(
      <TemplateBrowseDialog
        {...defaultProps}
        templates={templates}
        error="Template already exists in this mesocycle"
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Template already exists in this mesocycle')
  })

  it('does not display error alert when error is empty', () => {
    render(<TemplateBrowseDialog {...defaultProps} error="" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
