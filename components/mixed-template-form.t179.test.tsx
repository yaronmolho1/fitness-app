// @vitest-environment jsdom
// T179: elevation gain in mixed template running sections (AC14)

import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/templates/section-actions', () => ({
  createMixedTemplate: vi.fn(),
}))

import { MixedTemplateForm } from './mixed-template-form'
import { createMixedTemplate } from '@/lib/templates/section-actions'

const mockedCreate = vi.mocked(createMixedTemplate)

describe('MixedTemplateForm — elevation gain (T179)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  // AC14: running section in mixed template has elevation gain input
  it('renders elevation gain input for running sections', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    // Add a section and set to running
    await user.click(screen.getByText('Add Section'))

    // Switch modality to running
    const modalitySelects = screen.getAllByLabelText('Modality')
    await user.selectOptions(modalitySelects[0], 'running')

    // Elevation gain field should appear
    expect(screen.getByLabelText(/Target Elevation Gain/)).toBeInTheDocument()
  })

  it('does not render elevation gain for resistance sections', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.click(screen.getByText('Add Section'))

    // Default is resistance — no elevation gain
    expect(screen.queryByLabelText(/Target Elevation Gain/)).not.toBeInTheDocument()
  })

  it('includes elevation gain in mixed template submit payload', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValueOnce({
      success: true,
      data: {
        template: {
          id: 1, mesocycle_id: 1, name: 'Mixed', canonical_name: 'mixed',
          modality: 'mixed', notes: null, run_type: null, target_pace: null,
          hr_zone: null, interval_count: null, interval_rest: null,
          coaching_cues: null, target_distance: null, target_duration: null,
          target_elevation_gain: null, planned_duration: null, estimated_duration: null, display_order: 0, created_at: null,
        },
        sections: [],
      },
    })

    render(<MixedTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Mixed Workout')

    // Add 2 sections (running + resistance for mixed)
    await user.click(screen.getByText('Add Section'))
    await user.click(screen.getByText('Add Section'))

    // First section: running
    const modalitySelects = screen.getAllByLabelText('Modality')
    await user.selectOptions(modalitySelects[0], 'running')

    // Fill section names
    const sectionNames = screen.getAllByPlaceholderText('Section name')
    await user.type(sectionNames[0], 'Cardio')
    await user.type(sectionNames[1], 'Strength')

    // Fill elevation gain on running section
    await user.type(screen.getByLabelText(/Target Elevation Gain/), '200')

    await user.click(screen.getByRole('button', { name: 'Create Mixed Template' }))

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            modality: 'running',
            target_elevation_gain: 200,
          }),
        ]),
      })
    )
  })
})
