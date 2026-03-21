// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData } from './workout-logging-form'

function makeWorkoutData(overrides: Partial<WorkoutData> = {}): WorkoutData {
  return {
    date: '2026-03-21',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
    },
    template: {
      id: 1,
      name: 'Push Day',
      modality: 'resistance',
      notes: null,
    },
    slots: [],
    ...overrides,
  }
}

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 3,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 120,
    group_id: null,
    group_rest_seconds: null,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

describe('WorkoutLoggingForm — superset display (AC15)', () => {
  afterEach(() => {
    cleanup()
  })

  it('groups exercises with same group_id in a visual container', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'Cable Fly', order: 2, group_id: 1, group_rest_seconds: 60, is_main: false }),
        makeSlot({ id: 3, exercise_name: 'Lateral Raise', order: 3, is_main: false }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    const group = screen.getByTestId('superset-group')
    expect(group).toBeInTheDocument()

    // Both grouped exercises inside
    expect(within(group).getByText('Bench Press')).toBeInTheDocument()
    expect(within(group).getByText('Cable Fly')).toBeInTheDocument()

    // Ungrouped exercise NOT in the group
    expect(within(group).queryByText('Lateral Raise')).not.toBeInTheDocument()
  })

  it('shows "Superset" label for 2-exercise group', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'Row', order: 2, group_id: 1, group_rest_seconds: 60 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    expect(screen.getByText('Superset')).toBeInTheDocument()
  })

  it('shows "Tri-set" label for 3-exercise group', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'A', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'B', order: 2, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, exercise_name: 'C', order: 3, group_id: 1, group_rest_seconds: 60 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    expect(screen.getByText('Tri-set')).toBeInTheDocument()
  })

  it('shows "Giant set" label for 4+ exercise group', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'A', order: 1, group_id: 1, group_rest_seconds: 30 }),
        makeSlot({ id: 2, exercise_name: 'B', order: 2, group_id: 1, group_rest_seconds: 30 }),
        makeSlot({ id: 3, exercise_name: 'C', order: 3, group_id: 1, group_rest_seconds: 30 }),
        makeSlot({ id: 4, exercise_name: 'D', order: 4, group_id: 1, group_rest_seconds: 30 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    expect(screen.getByText('Giant set')).toBeInTheDocument()
  })

  it('shows group rest after superset container', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 90 }),
        makeSlot({ id: 2, exercise_name: 'Cable Fly', order: 2, group_id: 1, group_rest_seconds: 90 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    const group = screen.getByTestId('superset-group')
    expect(within(group).getByText('Group rest:')).toBeInTheDocument()
    expect(within(group).getByText('1m30s')).toBeInTheDocument()
  })

  it('renders ungrouped exercises without superset container', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Squat', order: 1 }),
        makeSlot({ id: 2, exercise_name: 'Leg Curl', order: 2, is_main: false }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    expect(screen.queryByTestId('superset-group')).not.toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.getByText('Leg Curl')).toBeInTheDocument()
  })

  it('each exercise in a superset still has its own set inputs', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, sets: 3, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'Row', order: 2, sets: 4, group_id: 1, group_rest_seconds: 60 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    const sections = screen.getAllByTestId('exercise-section')
    expect(sections).toHaveLength(2)
    expect(within(sections[0]).getAllByTestId('set-row')).toHaveLength(3)
    expect(within(sections[1]).getAllByTestId('set-row')).toHaveLength(4)
  })

  it('handles multiple superset groups', () => {
    const data = makeWorkoutData({
      slots: [
        makeSlot({ id: 1, exercise_name: 'A', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'B', order: 2, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, exercise_name: 'C', order: 3, group_id: 2, group_rest_seconds: 90 }),
        makeSlot({ id: 4, exercise_name: 'D', order: 4, group_id: 2, group_rest_seconds: 90 }),
      ],
    })
    render(<WorkoutLoggingForm data={data} />)

    const groups = screen.getAllByTestId('superset-group')
    expect(groups).toHaveLength(2)
  })
})
