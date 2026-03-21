// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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

  it('renders create buttons when not completed', () => {
    render(<TemplateSection {...defaultProps} />)
    expect(screen.getAllByRole('button', { name: '+ Resistance' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: '+ Running' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: '+ MMA/BJJ' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: '+ Mixed Workout' }).length).toBeGreaterThanOrEqual(1)
  })

  it('hides create buttons when completed', () => {
    render(<TemplateSection {...defaultProps} isCompleted={true} />)
    expect(screen.queryByRole('button', { name: '+ Resistance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Running' })).not.toBeInTheDocument()
  })

  it('shows resistance form when + Resistance clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    const btns = screen.getAllByRole('button', { name: '+ Resistance' })
    await user.click(btns[0])

    expect(screen.getByText('New Resistance Template')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('shows running form when + Running clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    const btns = screen.getAllByRole('button', { name: '+ Running' })
    await user.click(btns[0])

    expect(screen.getByText('New Running Template')).toBeInTheDocument()
    expect(screen.getByTestId('mock-running-template-form')).toBeInTheDocument()
  })

  it('shows MMA form when + MMA/BJJ clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    const btns = screen.getAllByRole('button', { name: '+ MMA/BJJ' })
    await user.click(btns[0])

    expect(screen.getByText('New MMA/BJJ Template')).toBeInTheDocument()
    expect(screen.getByTestId('mock-mma-template-form')).toBeInTheDocument()
  })

  it('shows mixed form when + Mixed Workout clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    const btns = screen.getAllByRole('button', { name: '+ Mixed Workout' })
    await user.click(btns[0])

    expect(screen.getByText('New Mixed Template')).toBeInTheDocument()
    expect(screen.getByTestId('mock-mixed-template-form')).toBeInTheDocument()
  })

  it('hides create buttons when a form is open', async () => {
    const user = userEvent.setup()
    render(<TemplateSection {...defaultProps} />)

    const btns = screen.getAllByRole('button', { name: '+ Resistance' })
    await user.click(btns[0])

    // Create buttons hidden when form open
    expect(screen.queryByRole('button', { name: '+ Running' })).not.toBeInTheDocument()
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
})
