// T121 — Mixed template display on Today page: component tests
// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/components/workout-logging-form', () => ({
  WorkoutLoggingForm: () => <div data-testid="mock-workout-logging-form">WorkoutLoggingForm</div>,
}))
vi.mock('@/components/running-logging-form', () => ({
  RunningLoggingForm: () => <div data-testid="mock-running-logging-form">RunningLoggingForm</div>,
}))
vi.mock('@/components/mma-logging-form', () => ({
  MmaLoggingForm: () => <div data-testid="mock-mma-logging-form">MmaLoggingForm</div>,
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
    id: 1,
    name: 'Block A',
    start_date: '2026-03-01',
    end_date: '2026-04-01',
    week_type: 'normal',
    ...overrides,
  }
}

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Strength + Cardio',
    modality: 'mixed',
    notes: null,
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    planned_duration: null,
    ...overrides,
  }
}

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 4,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 180,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    section_name: 'Main Lift',
    modality: 'resistance',
    order: 1,
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    planned_duration: null,
    slots: [],
    ...overrides,
  }
}

describe('TodayWorkout — mixed template display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders mixed display with section headers in order', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Main Lift', modality: 'resistance', order: 1 }),
        makeSection({ id: 2, section_name: 'Cooldown Run', modality: 'running', order: 2 }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    const headers = screen.getAllByTestId('section-header')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveTextContent('Main Lift')
    expect(headers[1]).toHaveTextContent('Cooldown Run')
  })

  it('renders modality badges on section headers', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Strength', modality: 'resistance', order: 1 }),
        makeSection({ id: 2, section_name: 'Easy Run', modality: 'running', order: 2 }),
        makeSection({ id: 3, section_name: 'Sparring', modality: 'mma', order: 3 }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    const badges = screen.getAllByTestId('modality-badge')
    expect(badges).toHaveLength(3)
    expect(badges[0]).toHaveTextContent('Resistance')
    expect(badges[1]).toHaveTextContent('Running')
    expect(badges[2]).toHaveTextContent('MMA')
  })

  it('resistance section renders exercise slots with targets', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({
          id: 1,
          section_name: 'Main Lift',
          modality: 'resistance',
          order: 1,
          slots: [
            makeSlot({ id: 1, exercise_name: 'Squat', sets: 5, reps: '3', weight: 140, rpe: 9, is_main: true }),
            makeSlot({ id: 2, exercise_name: 'Leg Press', sets: 3, reps: '12', weight: 200, is_main: false, order: 2 }),
          ],
        }),
        makeSection({ id: 2, section_name: 'Cardio', modality: 'running', order: 2 }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeInTheDocument()
    })
    expect(screen.getByText('Leg Press')).toBeInTheDocument()
    const slots = screen.getAllByTestId('exercise-slot')
    expect(slots).toHaveLength(2)
  })

  it('running section renders run plan details', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Strength', modality: 'resistance', order: 1 }),
        makeSection({
          id: 2,
          section_name: 'Tempo Run',
          modality: 'running',
          order: 2,
          run_type: 'tempo',
          target_pace: '4:30',
          hr_zone: 4,
          coaching_cues: 'Stay relaxed',
        }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Tempo Run')).toBeInTheDocument()
    })
    expect(screen.getByText('4:30')).toBeInTheDocument()
    expect(screen.getByText('Zone 4')).toBeInTheDocument()
    expect(screen.getByText('Stay relaxed')).toBeInTheDocument()
  })

  it('mma section renders duration target', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Strength', modality: 'resistance', order: 1 }),
        makeSection({
          id: 2,
          section_name: 'BJJ Drills',
          modality: 'mma',
          order: 2,
          planned_duration: 45,
        }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('BJJ Drills')).toBeInTheDocument()
    })
    expect(screen.getByText('45 min')).toBeInTheDocument()
  })

  it('renders visual separators between sections', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Strength', modality: 'resistance', order: 1 }),
        makeSection({ id: 2, section_name: 'Cardio', modality: 'running', order: 2 }),
        makeSection({ id: 3, section_name: 'Drills', modality: 'mma', order: 3 }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('mixed-display')).toBeInTheDocument()
    })
    // Separators between sections (n-1 for n sections)
    const separators = screen.getAllByTestId('section-separator')
    expect(separators).toHaveLength(2)
  })

  it('renders workout header with template name for mixed', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ name: 'Full Body + Conditioning' }),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Lifts', modality: 'resistance', order: 1 }),
        makeSection({ id: 2, section_name: 'Run', modality: 'running', order: 2 }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Full Body + Conditioning')).toBeInTheDocument()
    })
    expect(screen.getByText('Block A')).toBeInTheDocument()
  })

  it('running section with interval details renders correctly', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      sections: [
        makeSection({ id: 1, section_name: 'Lifts', modality: 'resistance', order: 1 }),
        makeSection({
          id: 2,
          section_name: 'Intervals',
          modality: 'running',
          order: 2,
          run_type: 'interval',
          interval_count: 6,
          interval_rest: 90,
        }),
      ],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      // "Intervals" appears in both section header and TargetCell label
      expect(screen.getAllByText('Intervals').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('1m30s')).toBeInTheDocument()
  })
})
