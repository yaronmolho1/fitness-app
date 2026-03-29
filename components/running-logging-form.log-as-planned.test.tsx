// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RunningLoggingForm } from './running-logging-form'
import type { RunningWorkoutData } from './running-logging-form'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/workouts/actions', () => ({
  saveRunningWorkout: vi.fn().mockResolvedValue({ success: true }),
}))

function makeRunData(overrides: Partial<RunningWorkoutData> = {}): RunningWorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
      status: 'active',
    },
    template: {
      id: 1,
      name: 'Easy Run',
      modality: 'running',
      notes: null,
      run_type: 'easy',
      target_pace: '5:30/km',
      hr_zone: 2,
      interval_count: null,
      interval_rest: null,
      coaching_cues: null,
      target_distance: 8,
      target_duration: null,
      target_elevation_gain: null,
      planned_duration: null,
    },
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Log as Planned button — running form', () => {
  it('shows button on load', () => {
    render(<RunningLoggingForm data={makeRunData()} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('hides button after user modifies distance', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeRunData()} />)

    const distanceInput = screen.getByTestId('actual-distance')
    await user.clear(distanceInput)
    await user.type(distanceInput, '9')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('hides button after user modifies pace', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeRunData()} />)

    const paceInput = screen.getByTestId('actual-avg-pace')
    await user.type(paceInput, '6:00/km')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('shows button even with all null targets (empty run)', () => {
    const data = makeRunData({
      template: {
        ...makeRunData().template,
        target_distance: null,
        target_pace: null,
        target_elevation_gain: null,
      },
    })
    render(<RunningLoggingForm data={data} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('tapping button scrolls and shows toast', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeRunData()} />)

    const ratingSection = screen.getByTestId('rating-notes-section')
    ratingSection.scrollIntoView = vi.fn()

    await user.click(screen.getByTestId('log-as-planned-btn'))

    expect(ratingSection.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(toast.info).toHaveBeenCalledWith('Review and save when ready.')
  })
})
