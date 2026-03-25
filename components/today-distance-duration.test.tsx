// T130: distance/duration display on today page + logging form reference
// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
}))

// Mock child components
vi.mock('@/components/workout-logging-form', () => ({
  WorkoutLoggingForm: () => <div data-testid="mock-workout-logging-form">WorkoutLoggingForm</div>,
}))
vi.mock('@/components/running-logging-form', () => ({
  RunningLoggingForm: () => <div data-testid="mock-running-logging-form">RunningLoggingForm</div>,
}))
vi.mock('@/components/mma-logging-form', () => ({
  MmaLoggingForm: () => <div data-testid="mock-mma-logging-form">MmaLoggingForm</div>,
}))
vi.mock('@/components/mixed-logging-form', () => ({
  MixedLoggingForm: () => <div data-testid="mock-mixed-logging-form">MixedLoggingForm</div>,
}))
vi.mock('@/components/routine-check-off', () => ({
  RoutineCheckOff: () => <div data-testid="mock-routine-check-off">RoutineCheckOff</div>,
}))

import { TodayWorkout } from './today-workout'

function mockFetchResponse(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeMesocycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01',
    week_type: 'normal', status: 'active', ...overrides,
  }
}

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Easy Run', modality: 'running', notes: null,
    run_type: 'easy', target_pace: null, hr_zone: null,
    interval_count: null, interval_rest: null, coaching_cues: null,
    planned_duration: null, target_distance: null, target_duration: null,
    ...overrides,
  }
}

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, section_name: 'Running Section', modality: 'running', order: 1,
    run_type: 'easy', target_pace: null, hr_zone: null,
    interval_count: null, interval_rest: null, coaching_cues: null,
    planned_duration: null, target_distance: null, target_duration: null,
    slots: [], ...overrides,
  }
}

describe('T130: RunningDisplay — target_distance', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_distance as "Xkm" in running display', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_distance: 10 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByText('Distance')).toBeInTheDocument()
    expect(screen.getByText('10km')).toBeInTheDocument()
  })

  it('displays fractional distance like "5.5km"', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_distance: 5.5 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByText('5.5km')).toBeInTheDocument()
  })

  it('does not show distance cell when target_distance is null', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_distance: null }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    // No "Distance" label should appear in the target cells
    const cells = screen.queryAllByText('Distance')
    expect(cells.length).toBe(0)
  })
})

describe('T130: RunningDisplay — target_duration', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_duration as "Xmin" in running display', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_duration: 30 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    // Use a label that won't clash with MMA's "Duration" — we use same label
    expect(screen.getByText('30min')).toBeInTheDocument()
  })

  it('does not show duration cell when target_duration is null', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_duration: null }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.queryByText(/\d+min/)).not.toBeInTheDocument()
  })
})

describe('T130: RunningDisplay — both fields together', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays both distance and duration when both set', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_distance: 10, target_duration: 45 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByText('10km')).toBeInTheDocument()
    expect(screen.getByText('45min')).toBeInTheDocument()
  })
})

describe('T130: SectionRunningContent — distance/duration in mixed templates', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_distance in mixed section running content', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'mixed' }),
      slots: [], sections: [makeSection({ target_distance: 5 })],
      period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    expect(screen.getByText('5km')).toBeInTheDocument()
  })

  it('displays target_duration in mixed section running content', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'mixed' }),
      slots: [], sections: [makeSection({ target_duration: 45 })],
      period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    expect(screen.getByText('45min')).toBeInTheDocument()
  })
})
