// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/templates/actions', () => ({
  createRunningTemplate: vi.fn(),
}))

import { RunningTemplateForm } from './running-template-form'
import { createRunningTemplate } from '@/lib/templates/actions'

const mockedCreate = vi.mocked(createRunningTemplate)

const mockSuccessResult = {
  success: true as const,
  data: {
    id: 1, mesocycle_id: 5, name: 'Easy 5k', canonical_name: 'easy-5k',
    modality: 'running' as const, notes: null, run_type: 'easy' as const,
    target_pace: null, hr_zone: null, interval_count: null, interval_rest: null,
    coaching_cues: null, target_distance: 5.0, target_duration: null,
    target_elevation_gain: null, planned_duration: null, estimated_duration: null, created_at: null,
  },
}

describe('RunningTemplateForm — distance/duration (T129)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  // AC3: form renders distance/duration inputs
  it('renders Target Distance (km) input', () => {
    render(<RunningTemplateForm mesocycleId={1} />)
    expect(screen.getByLabelText('Target Distance (km)')).toBeInTheDocument()
  })

  it('renders Target Duration (min) input', () => {
    render(<RunningTemplateForm mesocycleId={1} />)
    expect(screen.getByLabelText('Target Duration (min)')).toBeInTheDocument()
  })

  // AC4: interval labels show "(per rep)" suffix
  it('shows "(per rep)" suffix on distance label when run_type is interval', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    await user.selectOptions(screen.getByLabelText('Run Type'), 'interval')

    expect(screen.getByLabelText('Target Distance (km, per rep)')).toBeInTheDocument()
  })

  it('shows "(per rep)" suffix on duration label when run_type is interval', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    await user.selectOptions(screen.getByLabelText('Run Type'), 'interval')

    expect(screen.getByLabelText('Target Duration (min, per rep)')).toBeInTheDocument()
  })

  it('does not show "(per rep)" for non-interval run types', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    await user.selectOptions(screen.getByLabelText('Run Type'), 'tempo')

    expect(screen.getByLabelText('Target Distance (km)')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Duration (min)')).toBeInTheDocument()
  })

  // AC5: distance/duration included in submit payload
  it('includes target_distance and target_duration in submit', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValueOnce(mockSuccessResult)

    render(<RunningTemplateForm mesocycleId={5} />)

    await user.type(screen.getByLabelText('Template Name'), 'Easy 5k')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'easy')
    await user.type(screen.getByLabelText('Target Distance (km)'), '5')
    await user.type(screen.getByLabelText('Target Duration (min)'), '30')
    await user.click(screen.getByRole('button', { name: 'Create Running Template' }))

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        target_distance: 5,
        target_duration: 30,
      })
    )
  })

  it('sends null for empty distance/duration', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValueOnce(mockSuccessResult)

    render(<RunningTemplateForm mesocycleId={5} />)

    await user.type(screen.getByLabelText('Template Name'), 'Easy Run')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'easy')
    await user.click(screen.getByRole('button', { name: 'Create Running Template' }))

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        target_distance: null,
        target_duration: null,
      })
    )
  })

  // Validation edge cases
  it('sanitizes negative sign from distance input (NumericInput prevents negative values)', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    const input = screen.getByLabelText('Target Distance (km)')
    await user.type(input, '-1')
    // NumericInput strips non-numeric chars; "-" is removed, leaving "1"
    expect(input).toHaveValue('1')
  })

  it('shows error for zero duration', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Test')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'easy')
    await user.type(screen.getByLabelText('Target Duration (min)'), '0')
    await user.click(screen.getByRole('button', { name: 'Create Running Template' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Duration must be positive')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  // Resets after submit
  it('resets distance/duration after successful submit', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValueOnce(mockSuccessResult)

    render(<RunningTemplateForm mesocycleId={5} />)

    await user.type(screen.getByLabelText('Template Name'), 'Easy 5k')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'easy')
    await user.type(screen.getByLabelText('Target Distance (km)'), '5')
    await user.click(screen.getByRole('button', { name: 'Create Running Template' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Target Distance (km)')).toHaveValue('')
    })
    expect(screen.getByLabelText('Target Duration (min)')).toHaveValue('')
  })
})
