// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MixedLoggingForm } from './mixed-logging-form'
import type { MixedWorkoutData } from './mixed-logging-form'
import type { SectionData } from '@/lib/today/queries'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/workouts/actions', () => ({
  saveMixedWorkout: vi.fn().mockResolvedValue({ success: true }),
}))

function makeResistanceSection(overrides: Partial<SectionData> = {}): SectionData {
  return {
    id: 1,
    section_name: 'Strength',
    modality: 'resistance',
    order: 1,
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    target_distance: null,
    target_duration: null,
    target_elevation_gain: null,
    planned_duration: null,
    slots: [
      {
        id: 1,
        exercise_id: 10,
        exercise_name: 'Squat',
        sets: 3,
        reps: '5',
        weight: 100,
        rpe: 8,
        rest_seconds: 180,
        group_id: null,
        group_rest_seconds: null,
        guidelines: null,
        order: 1,
        is_main: true,
      },
    ],
    ...overrides,
  }
}

function makeMixedData(sections: SectionData[]): MixedWorkoutData {
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
      name: 'Hybrid Day',
      modality: 'mixed',
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
      planned_duration: null,
    },
    sections,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Mixed form Copy Down — AC34: resistance in mixed workout', () => {
  it('does not show copy-down before any edit', () => {
    const data = makeMixedData([makeResistanceSection()])
    render(<MixedLoggingForm data={data} />)
    expect(screen.queryByTestId('copy-down-resistance-0-0')).toBeNull()
  })

  it('shows copy-down after editing set 1 weight', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeResistanceSection()])
    render(<MixedLoggingForm data={data} />)

    // sectionIndex=0, slotIndex=0, setIndex=0
    const weightInput = screen.getByTestId('weight-input-0-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '110')

    expect(screen.getByTestId('copy-down-resistance-0-0')).toBeInTheDocument()
  })

  it('copies set 1 values to sets 2..N on tap', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeResistanceSection()])
    render(<MixedLoggingForm data={data} />)

    const weightInput = screen.getByTestId('weight-input-0-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '110')

    const repsInput = screen.getByTestId('reps-input-0-0-0')
    await user.clear(repsInput)
    await user.type(repsInput, '3')

    await user.click(screen.getByTestId('copy-down-resistance-0-0'))

    expect(screen.getByTestId('weight-input-0-0-1')).toHaveValue('110')
    expect(screen.getByTestId('reps-input-0-0-1')).toHaveValue('3')
    expect(screen.getByTestId('weight-input-0-0-2')).toHaveValue('110')
    expect(screen.getByTestId('reps-input-0-0-2')).toHaveValue('3')
  })

  it('not shown for 1-set exercise', async () => {
    const user = userEvent.setup()
    const section = makeResistanceSection({
      slots: [{
        id: 1, exercise_id: 10, exercise_name: 'Squat', sets: 1,
        reps: '5', weight: 100, rpe: 8, rest_seconds: 180,
        group_id: null, group_rest_seconds: null, guidelines: null,
        order: 1, is_main: true,
      }],
    })
    const data = makeMixedData([section])
    render(<MixedLoggingForm data={data} />)

    const weightInput = screen.getByTestId('weight-input-0-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '110')

    expect(screen.queryByTestId('copy-down-resistance-0-0')).toBeNull()
  })
})
