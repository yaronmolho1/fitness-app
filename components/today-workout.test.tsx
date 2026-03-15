// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    })
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day')).toBeInTheDocument()
    })
    expect(screen.getByText(/rest day/i)).toBeInTheDocument()
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
})
