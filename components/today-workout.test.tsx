// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

vi.mock('@/lib/routines/actions', () => ({
  markRoutineDone: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  markRoutineSkipped: vi.fn(() => Promise.resolve({ success: true, data: {} })),
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { TodayWorkout } from './today-workout'

function mockApiResponse(data: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockApiError() {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'Internal server error' }),
  })
}

describe('TodayWorkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<TodayWorkout />)
    expect(screen.getByTestId('today-loading')).toBeInTheDocument()
  })

  it('renders no-active-mesocycle state', async () => {
    mockApiResponse({ type: 'no_active_mesocycle', date: '2026-03-15' })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('no-active-mesocycle')).toBeInTheDocument()
    })
    expect(screen.getByText(/no active training phase/i)).toBeInTheDocument()
  })

  it('renders rest day state with mesocycle name', async () => {
    mockApiResponse({
      type: 'rest_day',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      routines: { items: [], logs: [] },
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    expect(screen.getByText(/rest day/i)).toBeInTheDocument()
  })

  it('renders rest day with active routines for check-off', async () => {
    mockApiResponse({
      type: 'rest_day',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      routines: {
        items: [
          { id: 1, name: 'Body Weight', category: 'tracking', has_weight: true, has_length: false, has_duration: false, has_sets: false, has_reps: false },
        ],
        logs: [],
      },
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    // Routine check-off section present
    expect(screen.getByText('Body Weight')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
  })

  it('renders rest day routines empty state when no routines active', async () => {
    mockApiResponse({
      type: 'rest_day',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      routines: { items: [], logs: [] },
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    expect(screen.getByText(/no routines for today/i)).toBeInTheDocument()
  })

  it('renders rest day with completed routines showing done badge', async () => {
    mockApiResponse({
      type: 'rest_day',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      routines: {
        items: [
          { id: 1, name: 'Body Weight', category: 'tracking', has_weight: true, has_length: false, has_duration: false, has_sets: false, has_reps: false },
        ],
        logs: [
          { id: 10, routine_item_id: 1, log_date: '2026-03-15', status: 'done', value_weight: 72.5, value_length: null, value_duration: null, value_sets: null, value_reps: null },
        ],
      },
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('72.5 kg')).toBeInTheDocument()
  })

  it('does not show workout content on rest day', async () => {
    mockApiResponse({
      type: 'rest_day',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      routines: { items: [], logs: [] },
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('workout-display')).not.toBeInTheDocument()
    expect(screen.queryByTestId('start-logging-btn')).not.toBeInTheDocument()
  })

  it('renders resistance workout with template name prominently', async () => {
    mockApiResponse({
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push Day A', modality: 'resistance', notes: null },
      slots: [],
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })
    expect(screen.getByText('Push Day A')).toBeInTheDocument()
  })

  it('renders exercise slots in order with all targets', async () => {
    mockApiResponse({
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push Day A', modality: 'resistance', notes: null },
      slots: [
        {
          id: 1,
          exercise_name: 'Bench Press',
          sets: 4,
          reps: '8',
          weight: 80,
          rpe: 8,
          rest_seconds: 180,
          guidelines: 'Slow eccentric',
          order: 1,
          is_main: true,
        },
        {
          id: 2,
          exercise_name: 'Lateral Raise',
          sets: 3,
          reps: '15',
          weight: 10,
          rpe: null,
          rest_seconds: 60,
          guidelines: null,
          order: 2,
          is_main: false,
        },
      ],
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument()
    })

    // Exercise names
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Lateral Raise')).toBeInTheDocument()

    // Slot targets
    const slots = screen.getAllByTestId('exercise-slot')
    expect(slots).toHaveLength(2)

    // First slot: main exercise with all targets
    const firstSlot = slots[0]
    expect(firstSlot).toHaveTextContent('Bench Press')
    expect(firstSlot).toHaveTextContent('4')
    expect(firstSlot).toHaveTextContent('8')
    expect(firstSlot).toHaveTextContent('80')
    expect(firstSlot).toHaveTextContent('8') // RPE
    expect(firstSlot).toHaveTextContent('3m') // 180s
    expect(firstSlot).toHaveTextContent('Slow eccentric')

    // Second slot: complementary
    const secondSlot = slots[1]
    expect(secondSlot).toHaveTextContent('Lateral Raise')
    expect(secondSlot).toHaveTextContent('3')
    expect(secondSlot).toHaveTextContent('15')
  })

  it('visually distinguishes main vs complementary exercises', async () => {
    mockApiResponse({
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push Day A', modality: 'resistance', notes: null },
      slots: [
        {
          id: 1, exercise_name: 'Bench Press', sets: 4, reps: '8',
          weight: 80, rpe: 8, rest_seconds: 180, guidelines: null,
          order: 1, is_main: true,
        },
        {
          id: 2, exercise_name: 'Lateral Raise', sets: 3, reps: '15',
          weight: 10, rpe: null, rest_seconds: 60, guidelines: null,
          order: 2, is_main: false,
        },
      ],
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Main')).toBeInTheDocument()
    })

    // Main badge present for main exercises
    expect(screen.getByText('Main')).toBeInTheDocument()
    // Complementary badge for non-main
    expect(screen.getByText('Complementary')).toBeInTheDocument()
  })

  it('shows week type badge (normal/deload)', async () => {
    mockApiResponse({
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'deload' },
      template: { id: 1, name: 'Push Day A', modality: 'resistance', notes: null },
      slots: [],
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText(/deload/i)).toBeInTheDocument()
    })
  })

  it('handles API error gracefully', async () => {
    mockApiError()
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('today-error')).toBeInTheDocument()
    })
  })

  it('displays template notes when present', async () => {
    mockApiResponse({
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push Day A', modality: 'resistance', notes: 'Focus on mind-muscle connection' },
      slots: [],
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Focus on mind-muscle connection')).toBeInTheDocument()
    })
  })

  it('formats rest period in minutes and seconds', async () => {
    mockApiResponse({
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push Day A', modality: 'resistance', notes: null },
      slots: [
        {
          id: 1, exercise_name: 'Squat', sets: 3, reps: '5',
          weight: 100, rpe: 9, rest_seconds: 90, guidelines: null,
          order: 1, is_main: true,
        },
      ],
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('1m30s')).toBeInTheDocument()
    })
  })

  // --- Already logged (T060) ---

  describe('Already logged state', () => {
    const baseMeso = { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' as const }

    it('renders already-logged summary with no log buttons', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00Z',
          canonical_name: 'push-day',
          rating: 4,
          notes: 'Good session',
          template_snapshot: { version: 1, name: 'Push Day', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      expect(screen.getByText(/already completed|workout logged/i)).toBeInTheDocument()
      expect(screen.queryByTestId('start-logging-btn')).not.toBeInTheDocument()
      expect(screen.queryByTestId('start-running-logging-btn')).not.toBeInTheDocument()
      expect(screen.queryByTestId('start-mma-logging-btn')).not.toBeInTheDocument()
    })

    it('displays workout name from snapshot', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00Z',
          canonical_name: 'push-day',
          rating: null,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('Push Day')).toBeInTheDocument()
      })
    })
  })

  // --- Running workout display (T047) ---

  describe('Running workout display', () => {
    const baseMeso = { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' as const }

    it('renders running workout with run type badge', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Easy Run', modality: 'running', notes: null,
          run_type: 'easy', target_pace: '5:30/km', hr_zone: 2,
          interval_count: null, interval_rest: null, coaching_cues: 'Keep it conversational',
          planned_duration: null,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('running-display')).toBeInTheDocument()
      })
      expect(screen.getByText('Easy Run')).toBeInTheDocument()
      expect(screen.getByTestId('run-type-badge')).toHaveTextContent('Easy')
    })

    it('displays target pace and HR zone', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Tempo Run', modality: 'running', notes: null,
          run_type: 'tempo', target_pace: '4:45/km', hr_zone: 4,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: null,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('4:45/km')).toBeInTheDocument()
      })
      expect(screen.getByText('Zone 4')).toBeInTheDocument()
    })

    it('displays interval details for interval run type', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Track Intervals', modality: 'running', notes: null,
          run_type: 'interval', target_pace: '3:50/km', hr_zone: 5,
          interval_count: 6, interval_rest: 90, coaching_cues: 'Fast turnover',
          planned_duration: null,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('running-display')).toBeInTheDocument()
      })
      // Interval-specific details
      expect(screen.getByText('6')).toBeInTheDocument() // interval count
      expect(screen.getByText('1m30s')).toBeInTheDocument() // interval rest (90s)
    })

    it('does not show interval details for non-interval run types', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Long Run', modality: 'running', notes: null,
          run_type: 'long', target_pace: '5:45/km', hr_zone: 2,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: null,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('running-display')).toBeInTheDocument()
      })
      expect(screen.queryByText('Intervals')).not.toBeInTheDocument()
    })

    it('displays coaching cues when present', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Easy Run', modality: 'running', notes: null,
          run_type: 'easy', target_pace: '5:30/km', hr_zone: 2,
          interval_count: null, interval_rest: null, coaching_cues: 'Nose breathing, relaxed shoulders',
          planned_duration: null,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('Nose breathing, relaxed shoulders')).toBeInTheDocument()
      })
    })

    it('renders all run type variants with distinct badges', async () => {
      for (const runType of ['easy', 'tempo', 'interval', 'long', 'race'] as const) {
        cleanup()
        vi.clearAllMocks()
        mockApiResponse({
          type: 'workout',
          date: '2026-03-15',
          mesocycle: baseMeso,
          template: {
            id: 1, name: `${runType} session`, modality: 'running', notes: null,
            run_type: runType, target_pace: '5:00/km', hr_zone: 3,
            interval_count: runType === 'interval' ? 4 : null,
            interval_rest: runType === 'interval' ? 60 : null,
            coaching_cues: null,
            planned_duration: null,
          },
          slots: [],
        })
        render(<TodayWorkout />)

        await waitFor(() => {
          expect(screen.getByTestId('run-type-badge')).toBeInTheDocument()
        })
      }
    })
  })

  // --- MMA/BJJ workout display (T047) ---

  describe('MMA/BJJ workout display', () => {
    const baseMeso = { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' as const }

    it('renders MMA workout with planned duration', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'BJJ Fundamentals', modality: 'mma', notes: null,
          run_type: null, target_pace: null, hr_zone: null,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: 60,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('mma-display')).toBeInTheDocument()
      })
      expect(screen.getByText('BJJ Fundamentals')).toBeInTheDocument()
      expect(screen.getByText('60 min')).toBeInTheDocument()
    })

    it('displays coaching notes when present', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Muay Thai Sparring', modality: 'mma', notes: 'Light sparring, focus on footwork and jab combinations',
          run_type: null, target_pace: null, hr_zone: null,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: 90,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('Light sparring, focus on footwork and jab combinations')).toBeInTheDocument()
      })
    })

    it('renders without duration when not set', async () => {
      mockApiResponse({
        type: 'workout',
        date: '2026-03-15',
        mesocycle: baseMeso,
        template: {
          id: 1, name: 'Open Mat', modality: 'mma', notes: 'Free rolling',
          run_type: null, target_pace: null, hr_zone: null,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: null,
        },
        slots: [],
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('mma-display')).toBeInTheDocument()
      })
      expect(screen.getByText('Open Mat')).toBeInTheDocument()
      expect(screen.queryByText(/min/)).not.toBeInTheDocument()
    })
  })

  // --- Already-logged summary display (T059) ---

  describe('Already-logged summary', () => {
    const baseMeso = { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' as const }

    it('renders completion banner with "Workout Logged" label', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: 'push-a',
          rating: 4,
          notes: 'Felt strong',
          template_snapshot: {
            version: 1,
            name: 'Push Day A',
            modality: 'resistance',
          },
          exercises: [
            {
              id: 1,
              exercise_name: 'Bench Press',
              order: 1,
              sets: [
                { set_number: 1, actual_reps: 8, actual_weight: 80, actual_rpe: 7 },
                { set_number: 2, actual_reps: 8, actual_weight: 80, actual_rpe: 8 },
              ],
            },
          ],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      expect(screen.getByText(/workout logged/i)).toBeInTheDocument()
    })

    it('displays workout name from template_snapshot', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T10:00:00.000Z',
          canonical_name: 'push-a',
          rating: null,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('Push Day A')).toBeInTheDocument()
      })
    })

    it('displays logged_at timestamp', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: null,
          rating: null,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      // Should show logged time
      expect(screen.getByTestId('logged-at-time')).toBeInTheDocument()
    })

    it('displays rating when present', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: null,
          rating: 4,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('workout-rating')).toBeInTheDocument()
      })
      expect(screen.getByTestId('workout-rating')).toHaveTextContent('4')
    })

    it('displays notes when present', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: null,
          rating: null,
          notes: 'Great session overall',
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('Great session overall')).toBeInTheDocument()
      })
    })

    it('does not render any log buttons or edit controls', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: null,
          rating: 3,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('start-logging-btn')).not.toBeInTheDocument()
      expect(screen.queryByTestId('start-running-logging-btn')).not.toBeInTheDocument()
      expect(screen.queryByTestId('start-mma-logging-btn')).not.toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    // Resistance modality: exercises + sets
    it('renders resistance actuals: exercises with sets, reps, weight', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: 'push-a',
          rating: 4,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [
            {
              id: 1,
              exercise_name: 'Bench Press',
              order: 1,
              sets: [
                { set_number: 1, actual_reps: 8, actual_weight: 80, actual_rpe: 7 },
                { set_number: 2, actual_reps: 7, actual_weight: 80, actual_rpe: 8.5 },
              ],
            },
            {
              id: 2,
              exercise_name: 'Lateral Raise',
              order: 2,
              sets: [
                { set_number: 1, actual_reps: 15, actual_weight: 10, actual_rpe: null },
              ],
            },
          ],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
      })
      expect(screen.getByText('Lateral Raise')).toBeInTheDocument()

      // Should show logged exercise entries
      const exerciseEntries = screen.getAllByTestId('logged-exercise')
      expect(exerciseEntries).toHaveLength(2)
    })

    // Running modality: distance/pace/HR from snapshot
    it('renders running actuals: distance, pace, HR', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T07:00:00.000Z',
          canonical_name: 'easy-run',
          rating: 3,
          notes: null,
          template_snapshot: {
            version: 1,
            name: 'Easy Run',
            modality: 'running',
            run_type: 'easy',
            actual_distance: 8.5,
            actual_avg_pace: '5:20/km',
            actual_avg_hr: 145,
          },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      expect(screen.getByText('8.5')).toBeInTheDocument()
      expect(screen.getByText('5:20/km')).toBeInTheDocument()
      expect(screen.getByText('145')).toBeInTheDocument()
    })

    // MMA modality: duration + notes from snapshot
    it('renders MMA actuals: duration and notes', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T18:00:00.000Z',
          canonical_name: 'bjj-fundamentals',
          rating: 5,
          notes: 'Worked on guard passing',
          template_snapshot: {
            version: 1,
            name: 'BJJ Fundamentals',
            modality: 'mma',
            actual_duration_minutes: 75,
          },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      expect(screen.getByText('BJJ Fundamentals')).toBeInTheDocument()
      expect(screen.getByText('75 min')).toBeInTheDocument()
      expect(screen.getByText('Worked on guard passing')).toBeInTheDocument()
    })

    it('hides rating section when not present', async () => {
      mockApiResponse({
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: baseMeso,
        loggedWorkout: {
          id: 1,
          log_date: '2026-03-15',
          logged_at: '2026-03-15T14:30:00.000Z',
          canonical_name: null,
          rating: null,
          notes: null,
          template_snapshot: { version: 1, name: 'Push Day A', modality: 'resistance' },
          exercises: [],
        },
      })
      render(<TodayWorkout />)

      await waitFor(() => {
        expect(screen.getByTestId('already-logged-summary')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('workout-rating')).not.toBeInTheDocument()
    })
  })
})
