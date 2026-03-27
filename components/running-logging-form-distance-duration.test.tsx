// T130: distance/duration display in running logging form planned reference
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/lib/workouts/actions', () => ({
  saveRunningWorkout: vi.fn(),
}))
vi.mock('@/lib/ui/modality-colors', () => ({
  getModalityAccentClass: () => 'border-green-500',
}))

import { RunningLoggingForm } from './running-logging-form'
import type { RunningWorkoutData } from './running-logging-form'

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Easy Run', modality: 'running' as const, notes: null,
    run_type: 'easy' as string | null, target_pace: null as string | null,
    hr_zone: null as number | null, interval_count: null as number | null,
    interval_rest: null as number | null, coaching_cues: null as string | null,
    planned_duration: null as number | null, target_distance: null as number | null,
    target_duration: null as number | null, target_elevation_gain: null as number | null, ...overrides,
  }
}

function makeData(overrides: Partial<RunningWorkoutData> = {}): RunningWorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal', status: 'active' },
    template: makeTemplate(),
    ...overrides,
  }
}

describe('T130: RunningLoggingForm planned reference — target_distance', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_distance as "Xkm" in planned reference section', () => {
    render(<RunningLoggingForm data={makeData({ template: makeTemplate({ target_distance: 5 }) })} />)
    const ref = screen.getByTestId('planned-reference')
    expect(ref).toHaveTextContent('5km')
  })

  it('displays fractional distance like "8.5km"', () => {
    render(<RunningLoggingForm data={makeData({ template: makeTemplate({ target_distance: 8.5 }) })} />)
    expect(screen.getByTestId('planned-reference')).toHaveTextContent('8.5km')
  })

  it('does not show distance in planned reference when null', () => {
    render(<RunningLoggingForm data={makeData({ template: makeTemplate({ target_distance: null }) })} />)
    const ref = screen.getByTestId('planned-reference')
    expect(ref).not.toHaveTextContent('km')
  })
})

describe('T130: RunningLoggingForm planned reference — target_duration', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_duration as "Xmin" in planned reference section', () => {
    render(<RunningLoggingForm data={makeData({ template: makeTemplate({ target_duration: 30 }) })} />)
    expect(screen.getByTestId('planned-reference')).toHaveTextContent('30min')
  })

  it('does not show duration in planned reference when null', () => {
    render(<RunningLoggingForm data={makeData({ template: makeTemplate({ target_duration: null }) })} />)
    const ref = screen.getByTestId('planned-reference')
    expect(ref).not.toHaveTextContent('min')
  })
})

describe('T130: RunningLoggingForm planned reference — both fields', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays both distance and duration in planned reference', () => {
    render(<RunningLoggingForm data={makeData({
      template: makeTemplate({ target_distance: 10, target_duration: 50 }),
    })} />)
    const ref = screen.getByTestId('planned-reference')
    expect(ref).toHaveTextContent('10km')
    expect(ref).toHaveTextContent('50min')
  })
})
