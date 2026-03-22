// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/components/running-template-form', () => ({
  RunningTemplateForm: () => <div data-testid="mock-running-template-form">RunningTemplateForm</div>,
}))
vi.mock('@/components/mma-bjj-template-form', () => ({
  MmaBjjTemplateForm: () => <div data-testid="mock-mma-template-form">MmaBjjTemplateForm</div>,
}))
vi.mock('@/components/mixed-template-form', () => ({
  MixedTemplateForm: () => <div data-testid="mock-mixed-template-form">MixedTemplateForm</div>,
}))
vi.mock('@/components/slot-list', () => ({
  SlotList: () => <div data-testid="mock-slot-list">SlotList</div>,
}))
vi.mock('@/components/cascade-scope-selector', () => ({
  CascadeScopeSelector: ({ updates }: { updates: Record<string, unknown> }) => (
    <div data-testid="mock-cascade">
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

describe('TemplateSection — expand-to-edit', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(cleanup)

  // Resistance expand still works
  it('expands resistance template to show SlotList on click', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({ id: 1, modality: 'resistance' })]
    render(<TemplateSection {...defaultProps} templates={templates} slotsByTemplate={{ 1: [] }} />)

    await user.click(screen.getByText('Push A'))
    expect(screen.getByTestId('mock-slot-list')).toBeInTheDocument()
  })

  // Running expand
  it('expands running template to show editable fields on click', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'Easy Run', modality: 'running', run_type: 'easy',
      target_distance: 5, target_duration: 30, target_pace: '5:30/km', hr_zone: 2,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('Easy Run'))

    expect(screen.getByLabelText('Run Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Distance (km)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Duration (min)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Pace')).toBeInTheDocument()
    expect(screen.getByLabelText('HR Zone')).toBeInTheDocument()
  })

  it('populates running expanded fields with current values', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'Easy Run', modality: 'running', run_type: 'easy',
      target_distance: 5, target_duration: 30,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('Easy Run'))

    expect(screen.getByLabelText('Target Distance (km)')).toHaveValue('5')
    expect(screen.getByLabelText('Target Duration (min)')).toHaveValue('30')
  })

  it('shows interval fields for interval run type in expanded panel', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'Intervals', modality: 'running', run_type: 'interval',
      interval_count: 6, interval_rest: 90,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('Intervals'))

    expect(screen.getByLabelText('Intervals')).toHaveValue('6')
    expect(screen.getByLabelText('Rest (seconds)')).toHaveValue('90')
  })

  it('shows Save/Cancel in expanded running panel when not completed', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({ id: 1, name: 'Easy Run', modality: 'running', run_type: 'easy' })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('Easy Run'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('hides Save/Cancel in expanded running panel when completed', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({ id: 1, name: 'Easy Run', modality: 'running', run_type: 'easy' })]
    render(<TemplateSection {...defaultProps} templates={templates} isCompleted />)

    await user.click(screen.getByText('Easy Run'))

    // Fields should show but no save/cancel
    expect(screen.getByLabelText('Run Type')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('triggers cascade when saving from expanded running panel', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'Easy Run', modality: 'running', run_type: 'easy',
      target_distance: null, target_duration: null,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('Easy Run'))
    await user.type(screen.getByLabelText('Target Distance (km)'), '10')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByTestId('mock-cascade')).toBeInTheDocument()
    const updates = JSON.parse(screen.getByTestId('cascade-updates').textContent ?? '{}')
    expect(updates.target_distance).toBe(10)
  })

  it('collapses and resets on Cancel in expanded running panel', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'Easy Run', modality: 'running', run_type: 'easy',
      target_distance: 5, target_duration: null,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('Easy Run'))
    await user.clear(screen.getByLabelText('Target Distance (km)'))
    await user.type(screen.getByLabelText('Target Distance (km)'), '99')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Panel should be collapsed
    expect(screen.queryByLabelText('Target Distance (km)')).not.toBeInTheDocument()

    // Re-expand: values should be reset to original
    await user.click(screen.getByText('Easy Run'))
    expect(screen.getByLabelText('Target Distance (km)')).toHaveValue('5')
  })

  // MMA expand
  it('expands MMA template to show duration field on click', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'BJJ', modality: 'mma', planned_duration: 90,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('BJJ'))

    expect(screen.getByLabelText('Planned Duration (minutes)')).toHaveValue('90')
  })

  it('shows Save/Cancel in expanded MMA panel when not completed', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({ id: 1, name: 'BJJ', modality: 'mma', planned_duration: 90 })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('BJJ'))

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('triggers cascade when saving from expanded MMA panel', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({
      id: 1, name: 'BJJ', modality: 'mma', planned_duration: 90,
    })]
    render(<TemplateSection {...defaultProps} templates={templates} />)

    await user.click(screen.getByText('BJJ'))
    await user.clear(screen.getByLabelText('Planned Duration (minutes)'))
    await user.type(screen.getByLabelText('Planned Duration (minutes)'), '60')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByTestId('mock-cascade')).toBeInTheDocument()
    const updates = JSON.parse(screen.getByTestId('cascade-updates').textContent ?? '{}')
    expect(updates.planned_duration).toBe(60)
  })

  // Mixed expand — read-only section summary
  it('expands mixed template to show section summary on click', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({ id: 1, name: 'Full Body', modality: 'mixed' })]
    const sectionsByTemplate = {
      1: [
        { id: 1, section_name: 'Strength', modality: 'resistance' as const, order: 1, run_type: null, target_pace: null, hr_zone: null, target_distance: null, target_duration: null, planned_duration: null },
        { id: 2, section_name: 'Cardio', modality: 'running' as const, order: 2, run_type: 'easy', target_pace: null, hr_zone: null, target_distance: 3, target_duration: null, planned_duration: null },
      ],
    }
    render(<TemplateSection {...defaultProps} templates={templates} sectionsByTemplate={sectionsByTemplate} />)

    await user.click(screen.getByText('Full Body'))

    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('Cardio')).toBeInTheDocument()
  })

  // No save for mixed expanded (read-only)
  it('does not show Save in expanded mixed panel', async () => {
    const user = userEvent.setup()
    const templates = [makeTemplate({ id: 1, name: 'Full Body', modality: 'mixed' })]
    const sectionsByTemplate = {
      1: [{ id: 1, section_name: 'Strength', modality: 'resistance' as const, order: 1, run_type: null, target_pace: null, hr_zone: null, target_distance: null, target_duration: null, planned_duration: null }],
    }
    render(<TemplateSection {...defaultProps} templates={templates} sectionsByTemplate={sectionsByTemplate} />)

    await user.click(screen.getByText('Full Body'))

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
