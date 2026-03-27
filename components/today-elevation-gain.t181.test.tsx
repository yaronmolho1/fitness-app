// T181: elevation gain display in today page + calendar day-detail panel
// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
}))

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
    id: 1, name: 'Hill Run', modality: 'running', notes: null,
    run_type: 'easy', target_pace: null, hr_zone: null,
    interval_count: null, interval_rest: null, coaching_cues: null,
    planned_duration: null, target_distance: null, target_duration: null,
    target_elevation_gain: null,
    ...overrides,
  }
}

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, section_name: 'Running Section', modality: 'running', order: 1,
    run_type: 'easy', target_pace: null, hr_zone: null,
    interval_count: null, interval_rest: null, coaching_cues: null,
    planned_duration: null, target_distance: null, target_duration: null,
    target_elevation_gain: null,
    slots: [], ...overrides,
  }
}

describe('T181: RunningDisplay — target_elevation_gain', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_elevation_gain as "Xm ascent" in running display', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_elevation_gain: 200 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByText('Elevation')).toBeInTheDocument()
    expect(screen.getByText('200m ascent')).toBeInTheDocument()
  })

  it('does not show elevation cell when target_elevation_gain is null', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_elevation_gain: null }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.queryByText('Elevation')).not.toBeInTheDocument()
    expect(screen.queryByText(/ascent/)).not.toBeInTheDocument()
  })

  it('displays 0m ascent when target_elevation_gain is 0 (flat route)', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_elevation_gain: 0 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByText('0m ascent')).toBeInTheDocument()
  })

  it('displays elevation gain alongside distance when both set', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ target_distance: 10, target_elevation_gain: 150 }),
      slots: [], period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByText('10km')).toBeInTheDocument()
    expect(screen.getByText('150m ascent')).toBeInTheDocument()
  })
})

describe('T181: SectionRunningContent — elevation gain in mixed templates', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('displays target_elevation_gain in mixed section running content', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'mixed' }),
      slots: [], sections: [makeSection({ target_elevation_gain: 300 })],
      period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    expect(screen.getByText('300m ascent')).toBeInTheDocument()
  })

  it('does not show elevation in section when target_elevation_gain is null', async () => {
    mockFetchResponse([{
      type: 'workout', date: '2026-03-15', mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'mixed' }),
      slots: [], sections: [makeSection({ target_elevation_gain: null })],
      period: 'morning', time_slot: null,
    }])
    render(<TodayWorkout />)
    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    expect(screen.queryByText(/ascent/)).not.toBeInTheDocument()
  })
})
