// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/templates/section-actions', () => ({
  createMixedTemplate: vi.fn(),
}))

import { MixedTemplateForm } from './mixed-template-form'
import { createMixedTemplate } from '@/lib/templates/section-actions'

const mockedCreate = vi.mocked(createMixedTemplate)

const mockTemplateRow = {
  id: 1, mesocycle_id: 3, name: 'Strength + Cardio', canonical_name: 'strength-cardio',
  modality: 'mixed' as const, notes: null, run_type: null, target_pace: null,
  hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null,
  target_distance: null, target_duration: null, target_elevation_gain: null,
  planned_duration: null, estimated_duration: null, display_order: 0, created_at: null,
}

const mockSectionRow = {
  id: 1, template_id: 1, modality: 'resistance' as const, section_name: 'Weights',
  order: 1, run_type: null, target_pace: null, hr_zone: null, interval_count: null,
  interval_rest: null, coaching_cues: null, target_distance: null, target_duration: null,
  target_elevation_gain: null, planned_duration: null, estimated_duration: null, created_at: null,
}

describe('MixedTemplateForm — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let counter = 0
    vi.stubGlobal('crypto', {
      ...crypto,
      randomUUID: () => `uuid-${++counter}`,
    })
  })

  afterEach(cleanup)

  it('renders template name field and buttons', () => {
    render(<MixedTemplateForm mesocycleId={1} />)

    expect(screen.getByLabelText('Template Name')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add Section' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: 'Create Mixed Template' }).length).toBeGreaterThanOrEqual(1)
  })

  it('does not render Cancel button when onCancel not provided', () => {
    render(<MixedTemplateForm mesocycleId={1} />)
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('renders Cancel button when onCancel provided', () => {
    render(<MixedTemplateForm mesocycleId={1} onCancel={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'Cancel' }).length).toBeGreaterThanOrEqual(1)
  })

  it('adds a section when Add Section clicked', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])

    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Section name')).toBeInTheDocument()
  })

  it('section defaults to resistance modality with help text', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])

    expect(screen.getByText('Exercise slots can be added after creating the template.')).toBeInTheDocument()
  })

  it('shows running fields when modality changed to running', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.selectOptions(screen.getByLabelText('Modality'), 'running')

    expect(screen.getByText('Run Type', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Target Pace', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('HR Zone', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Coaching Cues', { selector: 'label' })).toBeInTheDocument()
  })

  it('shows MMA fields when modality changed to mma', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.selectOptions(screen.getByLabelText('Modality'), 'mma')

    expect(screen.getByText('Planned Duration (minutes)', { selector: 'label' })).toBeInTheDocument()
  })

  it('shows interval fields when run type is interval', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.selectOptions(screen.getByLabelText('Modality'), 'running')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'interval')

    expect(screen.getByText('Intervals', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Rest (seconds)', { selector: 'label' })).toBeInTheDocument()
  })

  it('does not show interval fields for non-interval run types', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.selectOptions(screen.getByLabelText('Modality'), 'running')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'easy')

    expect(screen.queryByText('Intervals', { selector: 'label' })).not.toBeInTheDocument()
    expect(screen.queryByText('Rest (seconds)', { selector: 'label' })).not.toBeInTheDocument()
  })

  it('removes section when Remove clicked', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    expect(screen.getByText('Section 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByText('Section 1')).not.toBeInTheDocument()
  })

  it('shows Move Up/Down buttons for multi-section layout', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.click(addBtns[0])

    // Section 1: no Move Up, has Move Down. Section 2: has Move Up, no Move Down.
    expect(screen.getAllByRole('button', { name: 'Move Up' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Move Down' })).toHaveLength(1)
  })

  it('validates name required', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    const submitBtns = screen.getAllByRole('button', { name: 'Create Mixed Template' })
    await user.click(submitBtns[0])

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
  })

  it('validates minimum 2 sections', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Mixed')
    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    const submitBtns = screen.getAllByRole('button', { name: 'Create Mixed Template' })
    await user.click(submitBtns[0])

    expect(screen.getByRole('alert')).toHaveTextContent('Mixed templates require at least 2 sections')
  })

  it('validates different modalities required', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Mixed')
    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.click(addBtns[0])

    const nameInputs = screen.getAllByPlaceholderText('Section name')
    await user.type(nameInputs[0], 'A')
    await user.type(nameInputs[1], 'B')

    const submitBtns = screen.getAllByRole('button', { name: 'Create Mixed Template' })
    await user.click(submitBtns[0])

    expect(screen.getByRole('alert')).toHaveTextContent('Mixed templates must contain at least 2 different modalities')
  })

  it('validates section names required', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Mixed')
    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.click(addBtns[0])

    const nameInputs = screen.getAllByPlaceholderText('Section name')
    await user.type(nameInputs[0], 'A')
    // Leave second name empty

    const modalitySelects = screen.getAllByLabelText('Modality')
    await user.selectOptions(modalitySelects[1], 'running')

    const submitBtns = screen.getAllByRole('button', { name: 'Create Mixed Template' })
    await user.click(submitBtns[0])

    expect(screen.getByRole('alert')).toHaveTextContent('All section names are required')
  })

  it('calls createMixedTemplate on valid submit', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    mockedCreate.mockResolvedValueOnce({ success: true, data: { template: mockTemplateRow, sections: [mockSectionRow] } })

    render(<MixedTemplateForm mesocycleId={3} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Template Name'), 'Strength + Cardio')
    const addBtns = screen.getAllByRole('button', { name: 'Add Section' })
    await user.click(addBtns[0])
    await user.click(addBtns[0])

    const nameInputs = screen.getAllByPlaceholderText('Section name')
    await user.type(nameInputs[0], 'Weights')
    await user.type(nameInputs[1], 'Run')

    const modalitySelects = screen.getAllByLabelText('Modality')
    await user.selectOptions(modalitySelects[1], 'running')

    const submitBtns = screen.getAllByRole('button', { name: 'Create Mixed Template' })
    await user.click(submitBtns[0])

    expect(mockedCreate).toHaveBeenCalledWith({
      name: 'Strength + Cardio',
      mesocycle_id: 3,
      sections: [
        { section_name: 'Weights', modality: 'resistance', order: 1 },
        {
          section_name: 'Run',
          modality: 'running',
          order: 2,
          run_type: undefined,
          target_pace: undefined,
          hr_zone: null,
          interval_count: null,
          interval_rest: null,
          coaching_cues: undefined,
          target_distance: null,
          target_duration: null,
          target_elevation_gain: null,
        },
      ],
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('does not render error alert initially', () => {
    render(<MixedTemplateForm mesocycleId={1} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
