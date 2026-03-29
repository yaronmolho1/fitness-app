// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
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

describe('Copy Down — AC29: button appears after set 1 edit on 2+ set exercise', () => {
  it('does not show copy-down before any edit', () => {
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3 })] })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.queryByTestId('copy-down-btn-0')).toBeNull()
  })

  it('shows copy-down after editing set 1 weight', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3, weight: 80 })] })
    render(<WorkoutLoggingForm data={data} />)

    const weightInput = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '85')

    expect(screen.getByTestId('copy-down-btn-0')).toBeInTheDocument()
  })

  it('shows copy-down after editing set 1 reps', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3, reps: '8', weight: 80 })] })
    render(<WorkoutLoggingForm data={data} />)

    const repsInput = screen.getByTestId('reps-input-0-0')
    await user.clear(repsInput)
    await user.type(repsInput, '10')

    expect(screen.getByTestId('copy-down-btn-0')).toBeInTheDocument()
  })
})

describe('Copy Down — AC30: copies set 1 values to sets 2..N', () => {
  it('copies weight and reps from set 1 to all other sets', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })] })
    render(<WorkoutLoggingForm data={data} />)

    // Edit set 1
    const weightInput = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '90')

    const repsInput = screen.getByTestId('reps-input-0-0')
    await user.clear(repsInput)
    await user.type(repsInput, '6')

    // Tap copy-down
    await user.click(screen.getByTestId('copy-down-btn-0'))

    // Verify sets 2 and 3 match set 1
    expect(screen.getByTestId('weight-input-0-1')).toHaveValue('90')
    expect(screen.getByTestId('reps-input-0-1')).toHaveValue('6')
    expect(screen.getByTestId('weight-input-0-2')).toHaveValue('90')
    expect(screen.getByTestId('reps-input-0-2')).toHaveValue('6')
  })
})

describe('Copy Down — AC31: not shown for single-set exercise', () => {
  it('never shows copy-down for 1-set exercise even after edit', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 1, weight: 80 })] })
    render(<WorkoutLoggingForm data={data} />)

    const weightInput = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '85')

    expect(screen.queryByTestId('copy-down-btn-0')).toBeNull()
  })
})

describe('Copy Down — AC32: RPE unaffected', () => {
  it('does not change RPE when copy-down is tapped', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })] })
    render(<WorkoutLoggingForm data={data} />)

    // Set RPE to 7
    const rpe7 = screen.getByTestId('rpe-selector-0').querySelector('[aria-label="RPE 7"]')!
    await user.click(rpe7)
    expect(rpe7).toHaveAttribute('aria-pressed', 'true')

    // Edit set 1 and copy down
    const weightInput = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '90')
    await user.click(screen.getByTestId('copy-down-btn-0'))

    // RPE still 7
    expect(rpe7).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Copy Down — AC33: hidden when set 1 still matches autofill', () => {
  it('not shown when values unchanged from autofill', () => {
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })] })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.queryByTestId('copy-down-btn-0')).toBeNull()
  })

  it('not shown if user edits set 2 but not set 1', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })] })
    render(<WorkoutLoggingForm data={data} />)

    // Edit set 2 only
    const weightInput2 = screen.getByTestId('weight-input-0-1')
    await user.clear(weightInput2)
    await user.type(weightInput2, '85')

    expect(screen.queryByTestId('copy-down-btn-0')).toBeNull()
  })
})

describe('Copy Down — multiple exercises', () => {
  it('tracks set-1-edited state per exercise independently', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_id: 10, exercise_name: 'Bench Press', sets: 3, weight: 80, reps: '8', order: 1 }),
        makeSlot({ id: 2, exercise_id: 20, exercise_name: 'Squats', sets: 3, weight: 100, reps: '5', order: 2 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Edit set 1 of exercise 0 only
    const weightInput0 = screen.getByTestId('weight-input-0-0')
    await user.clear(weightInput0)
    await user.type(weightInput0, '85')

    // Copy-down visible for exercise 0 but not 1
    expect(screen.getByTestId('copy-down-btn-0')).toBeInTheDocument()
    expect(screen.queryByTestId('copy-down-btn-1')).toBeNull()
  })
})

describe('Copy Down — bodyweight exercise edge case', () => {
  it('copies empty weight correctly', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 3, weight: null, reps: '10' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Edit set 1 reps (weight is empty for bodyweight)
    const repsInput = screen.getByTestId('reps-input-0-0')
    await user.clear(repsInput)
    await user.type(repsInput, '12')

    await user.click(screen.getByTestId('copy-down-btn-0'))

    expect(screen.getByTestId('weight-input-0-1')).toHaveValue('')
    expect(screen.getByTestId('reps-input-0-1')).toHaveValue('12')
    expect(screen.getByTestId('weight-input-0-2')).toHaveValue('')
    expect(screen.getByTestId('reps-input-0-2')).toHaveValue('12')
  })
})
