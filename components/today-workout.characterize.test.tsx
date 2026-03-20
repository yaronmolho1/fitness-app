// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'

// Mock child components to isolate today-workout behavior
vi.mock('@/components/workout-logging-form', () => ({
  WorkoutLoggingForm: ({ data }: { data: unknown }) => (
    <div data-testid="mock-workout-logging-form">WorkoutLoggingForm</div>
  ),
}))
vi.mock('@/components/running-logging-form', () => ({
  RunningLoggingForm: ({ data }: { data: unknown }) => (
    <div data-testid="mock-running-logging-form">RunningLoggingForm</div>
  ),
}))
vi.mock('@/components/mma-logging-form', () => ({
  MmaLoggingForm: ({ data }: { data: unknown }) => (
    <div data-testid="mock-mma-logging-form">MmaLoggingForm</div>
  ),
}))
vi.mock('@/components/routine-check-off', () => ({
  RoutineCheckOff: () => (
    <div data-testid="mock-routine-check-off">RoutineCheckOff</div>
  ),
}))

import { TodayWorkout } from './today-workout'

// Helpers

function mockFetchResponse(data: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(data),
  })
}

function mockFetchError() {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))
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
    name: 'Push Day A',
    modality: 'resistance',
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

describe('TodayWorkout — characterization', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ================================================================
  // Loading state
  // ================================================================

  it('renders loading skeleton initially', () => {
    // Never resolving fetch to keep loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
    render(<TodayWorkout />)

    expect(screen.getByTestId('today-loading')).toBeInTheDocument()
  })

  // ================================================================
  // Error state
  // ================================================================

  it('renders error card when fetch fails', async () => {
    mockFetchError()
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('today-error')).toBeInTheDocument()
    })
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('renders error card when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('today-error')).toBeInTheDocument()
    })
  })

  // ================================================================
  // No active mesocycle
  // ================================================================

  it('renders no-active-mesocycle card', async () => {
    mockFetchResponse([{ type: 'no_active_mesocycle', date: '2026-03-15' }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('no-active-mesocycle')).toBeInTheDocument()
    })
    expect(screen.getByText('No active training phase')).toBeInTheDocument()
  })

  // ================================================================
  // Empty sessions array
  // ================================================================

  it('renders nothing when sessions array is empty', async () => {
    mockFetchResponse([])
    const { container } = render(<TodayWorkout />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    // Wait a tick for state to settle
    await new Promise((r) => setTimeout(r, 50))
    // Component returns null for empty array
    expect(container.innerHTML).toBe('')
  })

  // ================================================================
  // Rest day
  // ================================================================

  it('renders rest day with routine check-off', async () => {
    mockFetchResponse([{
      type: 'rest_day',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      routines: { items: [], logs: [] },
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    expect(screen.getByText('Rest Day')).toBeInTheDocument()
    expect(screen.getByText('Daily Routines')).toBeInTheDocument()
    expect(screen.getByTestId('mock-routine-check-off')).toBeInTheDocument()
  })

  // ================================================================
  // Single workout — resistance display
  // ================================================================

  it('renders resistance display for single resistance workout', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot()],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })
    expect(screen.getByText('Push Day A')).toBeInTheDocument()
    expect(screen.getByText('Block A')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()
  })

  it('renders "Log Workout" button for resistance modality', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('start-logging-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('Log Workout')).toBeInTheDocument()
  })

  it('shows WorkoutLoggingForm when Log Workout is clicked', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ id: 5 }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('start-logging-btn')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId('start-logging-btn'))

    expect(screen.getByTestId('mock-workout-logging-form')).toBeInTheDocument()
  })

  it('shows "No exercises configured" when resistance template has no slots', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText(/No exercises configured/)).toBeInTheDocument()
    })
  })

  // ================================================================
  // ExerciseSlot rendering
  // ================================================================

  it('renders exercise slot with all target cells', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot({
        sets: 4,
        reps: '8-10',
        weight: 80,
        rpe: 8,
        rest_seconds: 180,
        guidelines: 'Slow eccentric',
      })],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument()
    })
    expect(screen.getByText('Sets')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Reps')).toBeInTheDocument()
    expect(screen.getByText('8-10')).toBeInTheDocument()
    expect(screen.getByText('Weight')).toBeInTheDocument()
    expect(screen.getByText('80kg')).toBeInTheDocument()
    expect(screen.getByText('RPE')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Rest')).toBeInTheDocument()
    expect(screen.getByText('3m')).toBeInTheDocument()
    expect(screen.getByText('Slow eccentric')).toBeInTheDocument()
  })

  it('renders Complementary label for non-main slots', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot({ is_main: false })],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Complementary')).toBeInTheDocument()
    })
  })

  it('omits Weight cell when weight is null', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot({ weight: null, rpe: null, rest_seconds: null })],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument()
    })
    expect(screen.queryByText('Weight')).not.toBeInTheDocument()
    expect(screen.queryByText('RPE')).not.toBeInTheDocument()
    expect(screen.queryByText('Rest')).not.toBeInTheDocument()
  })

  // ================================================================
  // formatRest paths
  // ================================================================

  it('formatRest: renders seconds-only for values < 60', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot({ rest_seconds: 45 })],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('45s')).toBeInTheDocument()
    })
  })

  it('formatRest: renders minutes only for exact minutes', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot({ rest_seconds: 120 })],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('2m')).toBeInTheDocument()
    })
  })

  it('formatRest: renders minutes+seconds for non-exact', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [makeSlot({ rest_seconds: 90 })],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('1m30s')).toBeInTheDocument()
    })
  })

  // ================================================================
  // WorkoutHeader — deload badge
  // ================================================================

  it('shows "Deload" badge when week_type is deload', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle({ week_type: 'deload' }),
      template: makeTemplate(),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Deload')).toBeInTheDocument()
    })
  })

  it('shows "Normal" badge when week_type is normal', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle({ week_type: 'normal' }),
      template: makeTemplate(),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument()
    })
  })

  it('shows template notes when present', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ notes: 'Focus on tempo' }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Focus on tempo')).toBeInTheDocument()
    })
  })

  // ================================================================
  // Running display
  // ================================================================

  it('renders running display for running modality', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({
        modality: 'running',
        run_type: 'easy',
        target_pace: '5:30',
        hr_zone: 2,
        coaching_cues: null,
      }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.getByTestId('run-type-badge')).toHaveTextContent('Easy')
    expect(screen.getByText('5:30')).toBeInTheDocument()
    expect(screen.getByText('Zone 2')).toBeInTheDocument()
    expect(screen.getByText('Log Run')).toBeInTheDocument()
  })

  it('renders interval-specific fields for interval run_type', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({
        modality: 'running',
        run_type: 'interval',
        interval_count: 6,
        interval_rest: 90,
      }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Intervals')).toBeInTheDocument()
    })
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('1m30s')).toBeInTheDocument()
  })

  it('renders coaching cues when present', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({
        modality: 'running',
        run_type: 'tempo',
        coaching_cues: 'Relax shoulders',
      }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Coaching Cues')).toBeInTheDocument()
    })
    expect(screen.getByText('Relax shoulders')).toBeInTheDocument()
  })

  it('shows RunningLoggingForm when Log Run is clicked', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ id: 7, modality: 'running', run_type: 'easy' }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('start-running-logging-btn')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId('start-running-logging-btn'))

    expect(screen.getByTestId('mock-running-logging-form')).toBeInTheDocument()
  })

  // ================================================================
  // MMA display
  // ================================================================

  it('renders MMA display for mma modality', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'mma', planned_duration: 90 }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('mma-display')).toBeInTheDocument()
    })
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('90 min')).toBeInTheDocument()
    expect(screen.getByText('Log Session')).toBeInTheDocument()
  })

  it('shows MmaLoggingForm when Log Session is clicked', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ id: 9, modality: 'mma', planned_duration: 60 }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('start-mma-logging-btn')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByTestId('start-mma-logging-btn'))

    expect(screen.getByTestId('mock-mma-logging-form')).toBeInTheDocument()
  })

  // ================================================================
  // Already-logged — resistance summary
  // ================================================================

  it('renders already-logged resistance summary', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: 'push-a',
        rating: 4,
        notes: 'Great session',
        template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
        exercises: [{
          id: 1,
          exercise_name: 'Bench Press',
          order: 1,
          actual_rpe: 8,
          sets: [
            { set_number: 1, actual_reps: 8, actual_weight: 80 },
            { set_number: 2, actual_reps: 7, actual_weight: 80 },
          ],
        }],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.getByText('Push A')).toBeInTheDocument()
    expect(screen.getByText('Workout Logged')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('RPE 8')).toBeInTheDocument()
    expect(screen.getByText('8 reps')).toBeInTheDocument()
    // Multiple sets with 80kg, so use getAllByText
    expect(screen.getAllByText('80kg')).toHaveLength(2)
    expect(screen.getByTestId('workout-rating')).toBeInTheDocument()
    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText('Great session')).toBeInTheDocument()
  })

  it('omits rating display when rating is null', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: 'push-a',
        rating: null,
        notes: null,
        template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
        exercises: [],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('workout-rating')).not.toBeInTheDocument()
  })

  it('omits notes card when notes is null', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: null,
        rating: null,
        notes: null,
        template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
        exercises: [],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
  })

  // ================================================================
  // Already-logged — running summary
  // ================================================================

  it('renders already-logged running summary', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T07:00:00Z',
        canonical_name: 'easy-run',
        rating: null,
        notes: null,
        template_snapshot: {
          version: 1,
          name: 'Easy Run',
          modality: 'running',
          actual_distance: 5.2,
          actual_avg_pace: '5:30',
          actual_avg_hr: 145,
        },
        exercises: [],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.getByText('Distance')).toBeInTheDocument()
    expect(screen.getByText('5.2')).toBeInTheDocument()
    expect(screen.getByText('Avg Pace')).toBeInTheDocument()
    expect(screen.getByText('5:30')).toBeInTheDocument()
    expect(screen.getByText('Avg HR')).toBeInTheDocument()
    expect(screen.getByText('145')).toBeInTheDocument()
  })

  // ================================================================
  // Already-logged — mma summary
  // ================================================================

  it('renders already-logged mma summary', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T18:00:00Z',
        canonical_name: 'bjj-class',
        rating: null,
        notes: null,
        template_snapshot: {
          version: 1,
          name: 'BJJ Class',
          modality: 'mma',
          actual_duration_minutes: 90,
        },
        exercises: [],
      },
      period: 'evening',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('90 min')).toBeInTheDocument()
  })

  // ================================================================
  // Already-logged — modality defaults to 'resistance' when missing
  // ================================================================

  it('defaults to resistance modality when snapshot has no modality', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: 'push-a',
        rating: null,
        notes: null,
        template_snapshot: { version: 1, name: 'Push A' },
        exercises: [{
          id: 1,
          exercise_name: 'Bench Press',
          order: 1,
          actual_rpe: null,
          sets: [{ set_number: 1, actual_reps: 8, actual_weight: 80 }],
        }],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    // Should render resistance summary (exercise name visible)
    expect(screen.getByTestId('logged-exercise')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
  })

  // ================================================================
  // Already-logged — workout name defaults to 'Workout' when missing
  // ================================================================

  it('defaults to "Workout" title when snapshot has no name', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: null,
        rating: null,
        notes: null,
        template_snapshot: { version: 1 },
        exercises: [],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.getByText('Workout')).toBeInTheDocument()
  })

  // ================================================================
  // Multi-session — period labels
  // ================================================================

  it('renders multi-session view with period labels', async () => {
    mockFetchResponse([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 1, name: 'Push Day A' }),
        slots: [],
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 2, name: 'Easy Run', modality: 'running', run_type: 'easy' }),
        slots: [],
        period: 'evening',
        time_slot: null,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })
    const labels = screen.getAllByTestId('period-label')
    expect(labels).toHaveLength(2)
    expect(labels[0]).toHaveTextContent('Morning')
    expect(labels[1]).toHaveTextContent('Evening')
  })

  it('uses time_slot text instead of period label when time_slot is set', async () => {
    mockFetchResponse([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 1 }),
        slots: [],
        period: 'morning',
        time_slot: '06:00 AM',
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 2, modality: 'running', run_type: 'easy' }),
        slots: [],
        period: 'evening',
        time_slot: '07:00 PM',
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })
    const labels = screen.getAllByTestId('period-label')
    expect(labels[0]).toHaveTextContent('06:00 AM')
    expect(labels[1]).toHaveTextContent('07:00 PM')
  })

  it('does not show period labels for single session', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate(),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('period-label')).not.toBeInTheDocument()
  })

  // ================================================================
  // Multi-session — mixed workout + already_logged
  // ================================================================

  it('renders mix of workout and already_logged in multi-session', async () => {
    mockFetchResponse([
      {
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T07:00:00Z',
          canonical_name: 'push-a',
          rating: null,
          notes: null,
          template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
          exercises: [],
        },
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 2, name: 'Easy Run', modality: 'running', run_type: 'easy' }),
        slots: [],
        period: 'evening',
        time_slot: null,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })
    expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    expect(screen.getByTestId('running-display')).toBeInTheDocument()
  })

  // ================================================================
  // Multi-session — logging transitions per session
  // ================================================================

  it('clicking log on one session does not affect the other', async () => {
    mockFetchResponse([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 1, name: 'Push Day' }),
        slots: [],
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 2, name: 'BJJ', modality: 'mma', planned_duration: 60 }),
        slots: [],
        period: 'evening',
        time_slot: null,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })

    // Click log on the MMA session
    await userEvent.click(screen.getByTestId('start-mma-logging-btn'))

    // MMA session shows logging form
    expect(screen.getByTestId('mock-mma-logging-form')).toBeInTheDocument()
    // Resistance session still shows workout display
    expect(screen.getByTestId('start-logging-btn')).toBeInTheDocument()
  })

  // ================================================================
  // ResistanceSummary — empty exercises
  // ================================================================

  it('already-logged with no exercises renders no logged-exercise elements', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: 'push-a',
        rating: null,
        notes: null,
        template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
        exercises: [],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('logged-exercise')).not.toBeInTheDocument()
  })

  // ================================================================
  // ResistanceSummary — set with null reps/weight
  // ================================================================

  it('already-logged set with null reps/weight omits those spans', async () => {
    mockFetchResponse([{
      type: 'already_logged',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      loggedWorkout: {
        id: 1,
        log_date: '2026-03-15',
        logged_at: '2026-03-15T14:30:00Z',
        canonical_name: 'push-a',
        rating: null,
        notes: null,
        template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
        exercises: [{
          id: 1,
          exercise_name: 'Bench Press',
          order: 1,
          actual_rpe: null,
          sets: [{ set_number: 1, actual_reps: null, actual_weight: null }],
        }],
      },
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('logged-exercise')).toBeInTheDocument()
    })
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.queryByText(/reps/)).not.toBeInTheDocument()
    // No "kg" text either
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument()
  })

  // ================================================================
  // Run type badge variants
  // ================================================================

  it.each([
    ['easy', 'Easy'],
    ['tempo', 'Tempo'],
    ['interval', 'Interval'],
    ['long', 'Long'],
    ['race', 'Race'],
  ])('renders run type badge for %s', async (runType, label) => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'running', run_type: runType }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('run-type-badge')).toHaveTextContent(label)
    })
    cleanup()
  })

  it('does not render run-type-badge when run_type is null', async () => {
    mockFetchResponse([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: makeMesocycle(),
      template: makeTemplate({ modality: 'running', run_type: null }),
      slots: [],
      period: 'morning',
      time_slot: null,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('running-display')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('run-type-badge')).not.toBeInTheDocument()
  })

  // ================================================================
  // SessionSection — returns null for non-session types
  // ================================================================

  it('multi-session ignores no_active_mesocycle type in session list', async () => {
    // NOTE: possible bug — SessionSection returns null for non-workout/already_logged types
    // but multi-session view only occurs with workout/already_logged items
    // Testing that it doesn't crash
    mockFetchResponse([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        template: makeTemplate({ id: 1 }),
        slots: [],
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'rest_day',
        date: '2026-03-15',
        mesocycle: makeMesocycle(),
        routines: { items: [], logs: [] },
      },
    ])
    render(<TodayWorkout />)

    // NOTE: possible bug — rest_day as second item in multi-session array
    // goes through SessionSection which returns null for it.
    // The first session (workout) still renders.
    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })
  })
})
