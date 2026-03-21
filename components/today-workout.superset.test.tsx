// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/routines/actions', () => ({
  markRoutineDone: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  markRoutineSkipped: vi.fn(() => Promise.resolve({ success: true, data: {} })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { TodayWorkout } from './today-workout'

function mockApiResponse(data: unknown) {
  const payload = Array.isArray(data) ? data : [data]
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  })
}

function makeWorkoutResponse(overrides: Record<string, unknown> = {}) {
  return {
    type: 'workout',
    date: '2026-03-21',
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
      name: 'Push Day',
      modality: 'resistance',
      notes: null,
      run_type: null,
      target_pace: null,
      hr_zone: null,
      interval_count: null,
      interval_rest: null,
      coaching_cues: null,
      target_distance: null,
      target_duration: null,
      planned_duration: null,
    },
    slots: [],
    period: 'morning',
    time_slot: null,
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

describe('TodayWorkout — superset display (AC13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('groups exercises with same group_id in a visual container', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'Cable Fly', order: 2, group_id: 1, group_rest_seconds: 60, is_main: false }),
        makeSlot({ id: 3, exercise_name: 'Lateral Raise', order: 3, group_id: null, is_main: false }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })

    // Superset group container should exist
    const group = screen.getByTestId('superset-group')
    expect(group).toBeInTheDocument()

    // Both grouped exercises inside the container
    expect(within(group).getByText('Bench Press')).toBeInTheDocument()
    expect(within(group).getByText('Cable Fly')).toBeInTheDocument()

    // Ungrouped exercise NOT in the group
    expect(within(group).queryByText('Lateral Raise')).not.toBeInTheDocument()
  })

  it('shows "Superset" label for 2-exercise group', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 90 }),
        makeSlot({ id: 2, exercise_name: 'Row', order: 2, group_id: 1, group_rest_seconds: 90 }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Superset')).toBeInTheDocument()
    })
  })

  it('shows "Tri-set" label for 3-exercise group', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'A', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'B', order: 2, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, exercise_name: 'C', order: 3, group_id: 1, group_rest_seconds: 60 }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Tri-set')).toBeInTheDocument()
    })
  })

  it('shows "Giant set" label for 4+ exercise group', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'A', order: 1, group_id: 1, group_rest_seconds: 30 }),
        makeSlot({ id: 2, exercise_name: 'B', order: 2, group_id: 1, group_rest_seconds: 30 }),
        makeSlot({ id: 3, exercise_name: 'C', order: 3, group_id: 1, group_rest_seconds: 30 }),
        makeSlot({ id: 4, exercise_name: 'D', order: 4, group_id: 1, group_rest_seconds: 30 }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Giant set')).toBeInTheDocument()
    })
  })

  it('shows group rest after superset group', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 90 }),
        makeSlot({ id: 2, exercise_name: 'Cable Fly', order: 2, group_id: 1, group_rest_seconds: 90 }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      const group = screen.getByTestId('superset-group')
      expect(within(group).getByText('Group rest:')).toBeInTheDocument()
      expect(within(group).getByText('1m30s')).toBeInTheDocument()
    })
  })

  it('renders ungrouped exercises normally (no container)', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'Squat', order: 1, group_id: null }),
        makeSlot({ id: 2, exercise_name: 'Leg Curl', order: 2, group_id: null }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('superset-group')).not.toBeInTheDocument()
  })

  it('handles multiple superset groups', async () => {
    mockApiResponse(makeWorkoutResponse({
      slots: [
        makeSlot({ id: 1, exercise_name: 'A', order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, exercise_name: 'B', order: 2, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, exercise_name: 'C', order: 3, group_id: 2, group_rest_seconds: 90 }),
        makeSlot({ id: 4, exercise_name: 'D', order: 4, group_id: 2, group_rest_seconds: 90 }),
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      const groups = screen.getAllByTestId('superset-group')
      expect(groups).toHaveLength(2)
    })
  })

  // AC13 also covers mixed template resistance sections
  it('groups supersets in mixed template resistance sections', async () => {
    mockApiResponse(makeWorkoutResponse({
      template: {
        id: 1,
        name: 'Mixed Day',
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
        planned_duration: null,
      },
      slots: [],
      sections: [
        {
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
          planned_duration: null,
          slots: [
            makeSlot({ id: 1, exercise_name: 'Bench Press', order: 1, group_id: 1, group_rest_seconds: 60 }),
            makeSlot({ id: 2, exercise_name: 'Row', order: 2, group_id: 1, group_rest_seconds: 60 }),
          ],
        },
      ],
    }))
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('superset-group')).toBeInTheDocument()
      expect(screen.getByText('Superset')).toBeInTheDocument()
    })
  })
})
