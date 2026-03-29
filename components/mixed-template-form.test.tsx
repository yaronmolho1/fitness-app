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

const mockResult = {
  success: true as const,
  data: {
    template: {
      id: 1, mesocycle_id: 3, name: 'Strength + Cardio', canonical_name: 'strength-cardio',
      modality: 'mixed' as const, notes: null, run_type: null, target_pace: null,
      hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null,
      target_distance: null, target_duration: null, target_elevation_gain: null, planned_duration: null, estimated_duration: null, created_at: null,
    },
    sections: [],
  },
}

describe('MixedTemplateForm — distance/duration (T129)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let counter = 0
    vi.stubGlobal('crypto', {
      ...crypto,
      randomUUID: () => `uuid-${++counter}`,
    })
  })

  afterEach(cleanup)

  // AC11: running section has distance/duration inputs
  it('shows distance/duration inputs when section modality is running', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.click(screen.getByRole('button', { name: 'Add Section' }))
    await user.selectOptions(screen.getByLabelText('Modality'), 'running')

    expect(screen.getByLabelText('Target Distance (km)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Duration (min)')).toBeInTheDocument()
  })

  it('does not show distance/duration for resistance section', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.click(screen.getByRole('button', { name: 'Add Section' }))
    // default is resistance
    expect(screen.queryByLabelText('Target Distance (km)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Target Duration (min)')).not.toBeInTheDocument()
  })

  // AC4: interval "(per rep)" labels in mixed form
  it('shows "(per rep)" suffix on distance/duration when run_type is interval', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.click(screen.getByRole('button', { name: 'Add Section' }))
    await user.selectOptions(screen.getByLabelText('Modality'), 'running')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'interval')

    expect(screen.getByLabelText('Target Distance (km, per rep)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Duration (min, per rep)')).toBeInTheDocument()
  })

  // Includes distance/duration in submit payload
  it('includes target_distance and target_duration in running section submit', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValueOnce(mockResult)

    render(<MixedTemplateForm mesocycleId={3} onSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText('Template Name'), 'Strength + Run')
    const addBtn = screen.getByRole('button', { name: 'Add Section' })
    await user.click(addBtn)
    await user.click(addBtn)

    const nameInputs = screen.getAllByPlaceholderText('Section name')
    await user.type(nameInputs[0], 'Weights')
    await user.type(nameInputs[1], 'Run')

    const modalitySelects = screen.getAllByLabelText('Modality')
    await user.selectOptions(modalitySelects[1], 'running')

    await user.type(screen.getByLabelText('Target Distance (km)'), '5')
    await user.type(screen.getByLabelText('Target Duration (min)'), '30')

    await user.click(screen.getByRole('button', { name: 'Create Mixed Template' }))

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            section_name: 'Run',
            modality: 'running',
            target_distance: 5,
            target_duration: 30,
          }),
        ]),
      })
    )
  })
})
