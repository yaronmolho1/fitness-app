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
  CascadeScopeSelector: ({ updates }: { updates: Record<string, unknown> }) => (
    <div data-testid="mock-cascade">
      CascadeScopeSelector
      <span data-testid="cascade-updates">{JSON.stringify(updates)}</span>
    </div>
  ),
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

describe('TemplateSection — distance/duration inline edit (T129)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  // AC6: inline edit shows distance/duration fields for running templates
  it('shows distance/duration inputs in edit mode for running template', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy Run',
        modality: 'running',
        run_type: 'easy',
        target_distance: 5,
        target_duration: 30,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Target Distance (km)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Duration (min)')).toBeInTheDocument()
  })

  it('populates distance/duration with existing values in edit mode', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy Run',
        modality: 'running',
        run_type: 'easy',
        target_distance: 5,
        target_duration: 30,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Target Distance (km)')).toHaveValue('5')
    expect(screen.getByLabelText('Target Duration (min)')).toHaveValue('30')
  })

  // AC4: interval labels in inline edit
  it('shows "(per rep)" suffix in inline edit when run_type is interval', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Intervals',
        modality: 'running',
        run_type: 'interval',
        interval_count: 6,
        interval_rest: 90,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Target Distance (km, per rep)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Duration (min, per rep)')).toBeInTheDocument()
  })

  // AC6: changing distance triggers cascade
  it('triggers cascade when target_distance changes', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy Run',
        modality: 'running',
        run_type: 'easy',
        target_distance: null,
        target_duration: null,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Target Distance (km)'), '10')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Cascade scope selector should appear
    expect(screen.getByTestId('mock-cascade')).toBeInTheDocument()
    const updatesEl = screen.getByTestId('cascade-updates')
    const updates = JSON.parse(updatesEl.textContent ?? '{}')
    expect(updates.target_distance).toBe(10)
  })

  it('triggers cascade when target_duration changes', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy Run',
        modality: 'running',
        run_type: 'easy',
        target_distance: null,
        target_duration: null,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Target Duration (min)'), '45')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByTestId('mock-cascade')).toBeInTheDocument()
    const updatesEl = screen.getByTestId('cascade-updates')
    const updates = JSON.parse(updatesEl.textContent ?? '{}')
    expect(updates.target_duration).toBe(45)
  })

  // Validation: inline edit rejects negative/zero values
  it('sanitizes negative sign from distance in inline edit (NumericInput prevents negative values)', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy Run',
        modality: 'running',
        run_type: 'easy',
        target_distance: null,
        target_duration: null,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const input = screen.getByLabelText('Target Distance (km)')
    await user.type(input, '-5')
    // NumericInput strips non-numeric chars; "-" is removed, leaving "5"
    expect(input).toHaveValue('5')
  })

  it('shows error for zero duration in inline edit', async () => {
    const user = userEvent.setup()
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy Run',
        modality: 'running',
        run_type: 'easy',
        target_distance: null,
        target_duration: null,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Target Duration (min)'), '0')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Duration must be positive')
    expect(screen.queryByTestId('mock-cascade')).not.toBeInTheDocument()
  })

  // Display: distance/duration shown inline
  it('shows distance inline in default view', () => {
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Easy 5k',
        modality: 'running',
        run_type: 'easy',
        target_distance: 5,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getByText(/5km/)).toBeInTheDocument()
  })

  it('shows duration inline in default view', () => {
    const templates = [
      makeTemplate({
        id: 1,
        name: 'Tempo Run',
        modality: 'running',
        run_type: 'tempo',
        target_duration: 30,
      }),
    ]
    render(<TemplateSection {...defaultProps} templates={templates} />)
    expect(screen.getByText(/30min/)).toBeInTheDocument()
  })
})
