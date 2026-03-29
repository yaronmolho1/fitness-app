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

describe('Per-exercise "As Planned" button — resistance', () => {
  it('AC23: shows "As Planned" button in exercise header', () => {
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.getByTestId('as-planned-btn-0')).toBeInTheDocument()
    expect(screen.getByTestId('as-planned-btn-0')).toHaveTextContent('As Planned')
  })

  it('AC24: tapping fills all sets with planned weight and lower-bound reps', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 3, weight: 80, reps: '8-12' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Modify set values first
    const w0 = screen.getByTestId('weight-input-0-0')
    await user.clear(w0)
    await user.type(w0, '90')

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-btn-0'))

    // All 3 sets should have planned weight=80, reps=8 (lower bound of 8-12)
    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`weight-input-0-${i}`)).toHaveValue('80')
      expect(screen.getByTestId(`reps-input-0-${i}`)).toHaveValue('8')
    }
  })

  it('AC26: tapping does NOT modify RPE', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 1, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Set RPE to 7
    await user.click(screen.getByRole('button', { name: 'RPE 7' }))

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-btn-0'))

    // RPE should still be 7
    expect(screen.getByRole('button', { name: 'RPE 7' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('AC27: null weight stays empty, range reps use lower bound', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 2, weight: null, reps: '8-12' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Modify something first
    const r0 = screen.getByTestId('reps-input-0-0')
    await user.clear(r0)
    await user.type(r0, '15')

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-btn-0'))

    // Weight empty, reps = 8
    for (let i = 0; i < 2; i++) {
      expect(screen.getByTestId(`weight-input-0-${i}`)).toHaveValue('')
      expect(screen.getByTestId(`reps-input-0-${i}`)).toHaveValue('8')
    }
  })

  it('restores set count to target_sets when user removed sets', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 3, weight: 80, reps: '8' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Remove a set (set 3)
    const removeButtons = screen.getAllByRole('button', { name: /Remove set/ })
    await user.click(removeButtons[2])

    // Should have 2 sets now
    expect(screen.getAllByTestId('set-row')).toHaveLength(2)

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-btn-0'))

    // Should have 3 sets restored
    expect(screen.getAllByTestId('set-row')).toHaveLength(3)
    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`weight-input-0-${i}`)).toHaveValue('80')
      expect(screen.getByTestId(`reps-input-0-${i}`)).toHaveValue('8')
    }
  })

  it('removes extra sets when user added beyond target_sets', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [makeSlot({ sets: 2, weight: 60, reps: '10' })],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Add 2 extra sets
    await user.click(screen.getByText('+ Add Set'))
    await user.click(screen.getByText('+ Add Set'))

    // Should have 4 sets
    expect(screen.getAllByTestId('set-row')).toHaveLength(4)

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-btn-0'))

    // Should be back to 2
    expect(screen.getAllByTestId('set-row')).toHaveLength(2)
    for (let i = 0; i < 2; i++) {
      expect(screen.getByTestId(`weight-input-0-${i}`)).toHaveValue('60')
      expect(screen.getByTestId(`reps-input-0-${i}`)).toHaveValue('10')
    }
  })

  it('works for multiple exercises independently', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 2, weight: 80, reps: '8', order: 1 }),
        makeSlot({ id: 2, exercise_name: 'OHP', sets: 2, weight: 40, reps: '10', order: 2 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    // Modify second exercise
    const w = screen.getByTestId('weight-input-1-0')
    await user.clear(w)
    await user.type(w, '50')

    // Tap "As Planned" for second exercise only
    await user.click(screen.getByTestId('as-planned-btn-1'))

    // Second exercise restored
    expect(screen.getByTestId('weight-input-1-0')).toHaveValue('40')
    expect(screen.getByTestId('weight-input-1-1')).toHaveValue('40')
  })

  it('does not show button when no slots', () => {
    const data = makeWorkoutData({ slots: [] })
    render(<WorkoutLoggingForm data={data} />)
    expect(screen.queryByTestId('as-planned-btn-0')).not.toBeInTheDocument()
  })
})
