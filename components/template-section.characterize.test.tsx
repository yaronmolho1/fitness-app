// Characterization test — captures current behavior for safe refactoring
// Updated for T138: 4 type buttons replaced with "Add Template" picker
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

// Mock useIsMobile (desktop by default)
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

// Mock child components
vi.mock('@/components/running-template-form', () => ({
  RunningTemplateForm: (_props: { mesocycleId: number }) => (
    <div data-testid="mock-running-template-form">RunningTemplateForm</div>
  ),
}))
vi.mock('@/components/mma-bjj-template-form', () => ({
  MmaBjjTemplateForm: (_props: { mesocycleId: number }) => (
    <div data-testid="mock-mma-template-form">MmaBjjTemplateForm</div>
  ),
}))
vi.mock('@/components/mixed-template-form', () => ({
  MixedTemplateForm: (_props: { mesocycleId: number }) => (
    <div data-testid="mock-mixed-template-form">MixedTemplateForm</div>
  ),
}))
vi.mock('@/components/slot-list', () => ({
  SlotList: () => <div data-testid="mock-slot-list">SlotList</div>,
}))
vi.mock('@/components/cascade-scope-selector', () => ({
  CascadeScopeSelector: () => <div data-testid="mock-cascade">CascadeScopeSelector</div>,
}))
vi.mock('@/components/layout/section-heading', () => ({
  SectionHeading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
vi.mock('@/lib/templates/actions', () => ({
  createResistanceTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))
vi.mock('@/lib/templates/copy-actions', () => ({
  copyTemplateToMesocycle: vi.fn(),
}))

import { TemplateSection } from './template-section'
import type { TemplateOption } from '@/lib/schedule/queries'

function makeTemplate(overrides: Partial<TemplateOption> = {}): TemplateOption {
  return {
    id: 1,
    name: 'Push A',
    canonical_name: 'push-a',
    modality: 'resistance',
    notes: null,
    ...overrides,
  }
}

const defaultProps = {
  mesocycleId: 1,
  templates: [] as TemplateOption[],
  exercises: [],
  slotsByTemplate: {},
  isCompleted: false,
}

describe('TemplateSection — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('renders heading', () => {
    render(<TemplateSection {...defaultProps} />)
    expect(screen.getByText('Templates')).toBeInTheDocument()
  })

  it('shows empty state when no templates and no form', () => {
    render(<TemplateSection {...defaultProps} />)
    const msgs = screen.getAllByText('No templates yet.')
    expect(msgs.length).toBeGreaterThanOrEqual(1)
  })

  // T138: replaced 4 type buttons with single "Add Template" picker
  it('renders "Add Template" button when not completed', () => {
    render(<TemplateSection {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add template/i })).toBeInTheDocument()
  })

  it('hides "Add Template" button when completed', () => {
    render(<TemplateSection {...defaultProps} isCompleted={true} />)
    expect(screen.queryByRole('button', { name: /add template/i })).not.toBeInTheDocument()
  })

  it('shows resistance form via picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    expect(screen.getByText('New Resistance Template')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('shows running form via picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Running'))

    expect(screen.getByText('New Running Template')).toBeInTheDocument()
    expect(screen.getByTestId('mock-running-template-form')).toBeInTheDocument()
  })

  it('shows MMA form via picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('MMA/BJJ'))

    expect(screen.getByText('New MMA/BJJ Template')).toBeInTheDocument()
    expect(screen.getByTestId('mock-mma-template-form')).toBeInTheDocument()
  })

  it('shows mixed form via picker', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Mixed Workout'))

    expect(screen.getByText('New Mixed Template')).toBeInTheDocument()
    expect(screen.getByTestId('mock-mixed-template-form')).toBeInTheDocument()
  })

  it('hides "Add Template" button when a form is open', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    expect(screen.queryByRole('button', { name: /add template/i })).not.toBeInTheDocument()
  })

  it('renders template rows with name and modality badge', () => {
    const templates = [
      makeTemplate({ id: 1, name: 'Push A', modality: 'resistance' }),
      makeTemplate({ id: 2, name: 'Easy Run', modality: 'running', run_type: 'easy', target_pace: '5:30/km', hr_zone: 2 }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    expect(screen.getByText('Push A')).toBeInTheDocument()
    expect(screen.getByText('Easy Run')).toBeInTheDocument()
    expect(screen.getByText('resistance')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('shows exercise count for resistance templates', () => {
    const templates = [makeTemplate({ id: 1, modality: 'resistance' })]
    render(
      <TemplateSection
        {...defaultProps}
        templates={templates}
        slotsByTemplate={{ 1: [{ id: 1 }, { id: 2 }] as never[] }}
      />
    )
    expect(screen.getByText('2 exercises')).toBeInTheDocument()
  })

  it('shows singular "exercise" for 1 slot', () => {
    const templates = [makeTemplate({ id: 1, modality: 'resistance' })]
    render(
      <TemplateSection
        {...defaultProps}
        templates={templates}
        slotsByTemplate={{ 1: [{ id: 1 }] as never[] }}
      />
    )
    expect(screen.getByText('1 exercise')).toBeInTheDocument()
  })

  it('shows running details inline', () => {
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Tempo Run',
        modality: 'running',
        run_type: 'tempo',
        target_pace: '5:00/km',
        hr_zone: 3,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    expect(screen.getByText(/tempo/)).toBeInTheDocument()
    expect(screen.getByText(/5:00\/km/)).toBeInTheDocument()
    expect(screen.getByText(/Z3/)).toBeInTheDocument()
  })

  it('shows MMA duration inline', () => {
    const templates = [
      makeTemplate({
        id: 1,
        name: 'BJJ',
        modality: 'mma',
        planned_duration: 90,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getByText('90 min')).toBeInTheDocument()
  })

  it('shows Edit and Delete for non-completed templates', () => {
    const templates = [makeTemplate()]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThanOrEqual(1)
  })

  it('hides Edit and Delete when completed', () => {
    const templates = [makeTemplate()]
    render(<TemplateSection {...defaultProps} templates={templates} isCompleted={true} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows notes when template has notes', () => {
    const templates = [makeTemplate({ notes: 'Focus on form' })]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getByText('Focus on form')).toBeInTheDocument()
  })

  it('shows canonical name next to template name', () => {
    const templates = [makeTemplate({ canonical_name: 'push-a-v2' })]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getByText('push-a-v2')).toBeInTheDocument()
  })

  it('shows target distance and duration for running templates', () => {
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Long Run',
        modality: 'running',
        run_type: 'long',
        target_distance: 15,
        target_duration: 90,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getByText(/15km/)).toBeInTheDocument()
    expect(screen.getByText(/90min/)).toBeInTheDocument()
  })

  it('cancel button closes resistance form and restores "Add Template" button', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))
    expect(screen.getByText('New Resistance Template')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('New Resistance Template')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add template/i })).toBeInTheDocument()
  })

  it('cancel button closes running form', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Running'))
    expect(screen.getByText('New Running Template')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('New Running Template')).not.toBeInTheDocument()
  })

  it('shows validation error when submitting resistance form with empty name', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
  })

  it('hides empty state when templates exist', () => {
    const templates = [makeTemplate()]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.queryByText('No templates yet.')).not.toBeInTheDocument()
  })
})
