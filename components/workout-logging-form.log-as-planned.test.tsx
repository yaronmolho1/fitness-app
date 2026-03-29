// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData, SlotData } from './workout-logging-form'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/workouts/actions', () => ({
  saveWorkout: vi.fn().mockResolvedValue({ success: true }),
}))

function makeSlot(overrides: Partial<SlotData> = {}): SlotData {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 3,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 180,
    group_id: null,
    group_rest_seconds: null,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

function makeWorkoutData(overrides: Partial<WorkoutData> = {}): WorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
    },
    template: {
      id: 1,
      name: 'Push Day A',
      modality: 'resistance',
      notes: null,
    },
    slots: [],
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Log as Planned button — resistance form', () => {
  it('shows button when form loads with autofilled values', () => {
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('button text reads "Log as Planned"', () => {
    const data = makeWorkoutData({
      slots: [makeSlot()],
    })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.getByTestId('log-as-planned-btn')).toHaveTextContent('Log as Planned')
  })

  it('hides button after user modifies weight', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 1, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()

    const weightInput = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '85')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('hides button after user modifies reps', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 1, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    const repsInput = screen.getByTestId('reps-input-0-0')
    await user.clear(repsInput)
    await user.type(repsInput, '10')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('button stays hidden once modified — does not reappear', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 1, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    const weightInput = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '85')
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()

    // Type back the original value
    await user.clear(weightInput)
    await user.type(weightInput, '80')
    // Still hidden per AC: once true, stays true
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('shows button even when exercises have null weight and range reps', () => {
    const data = makeWorkoutData({
      slots: [makeSlot({ weight: null, reps: '8-12' })],
    })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('does not show button when no exercise slots', () => {
    const data = makeWorkoutData({ slots: [] })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('tapping button scrolls to rating section and shows toast', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot()],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Mock scrollIntoView on the rating section
    const ratingSection = screen.getByTestId('rating-notes-section')
    ratingSection.scrollIntoView = vi.fn()

    await user.click(screen.getByTestId('log-as-planned-btn'))

    expect(ratingSection.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(toast.info).toHaveBeenCalledWith('Review and save when ready.')
  })
})
