// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MmaLoggingForm } from './mma-logging-form'
import type { MmaWorkoutData } from './mma-logging-form'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/workouts/actions', () => ({
  saveMmaWorkout: vi.fn().mockResolvedValue({ success: true }),
}))

function makeMmaData(overrides: Partial<MmaWorkoutData> = {}): MmaWorkoutData {
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
      name: 'BJJ Practice',
      modality: 'mma',
      notes: null,
      run_type: null,
      target_pace: null,
      hr_zone: null,
      interval_count: null,
      interval_rest: null,
      coaching_cues: null,
      target_distance: null,
      target_duration: null,
      target_elevation_gain: null,
      planned_duration: 90,
    },
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Log as Planned button — MMA form', () => {
  it('shows button on load', () => {
    render(<MmaLoggingForm data={makeMmaData()} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('hides button after user modifies duration', async () => {
    const user = userEvent.setup()
    render(<MmaLoggingForm data={makeMmaData()} />)

    const durationInput = screen.getByTestId('actual-duration')
    await user.clear(durationInput)
    await user.type(durationInput, '95')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('shows button when planned_duration is null', () => {
    const data = makeMmaData({
      template: { ...makeMmaData().template, planned_duration: null },
    })
    render(<MmaLoggingForm data={data} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('tapping button scrolls to feeling/notes and shows toast', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<MmaLoggingForm data={makeMmaData()} />)

    const feelingSection = screen.getByTestId('feeling-notes-section')
    feelingSection.scrollIntoView = vi.fn()

    await user.click(screen.getByTestId('log-as-planned-btn'))

    expect(feelingSection.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(toast.info).toHaveBeenCalledWith('Review and save when ready.')
  })
})
