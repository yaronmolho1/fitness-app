// T189: Day detail panel integration — override badges, move/undo actions
// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock the server action
const mockUndoScheduleMove = vi.fn()
vi.mock('@/lib/schedule/override-actions', () => ({
  undoScheduleMove: (...args: unknown[]) => mockUndoScheduleMove(...args),
}))

import { DayDetailPanel } from './day-detail-panel'
import type { DayDetailResult } from '@/lib/calendar/day-detail'

function mockFetchResponse(data: DayDetailResult | DayDetailResult[]) {
  const arr = Array.isArray(data) ? data : [data]
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(arr)))
  )
}

// Base projected fixture — active meso, with schedule context
const projectedBase: DayDetailResult = {
  type: 'projected',
  date: '2026-03-30',
  mesocycle_id: 1,
  mesocycle_status: 'active',
  template: {
    id: 10,
    name: 'Push A',
    modality: 'resistance',
    notes: null,
    run_type: null, target_pace: null, hr_zone: null,
    interval_count: null, interval_rest: null, coaching_cues: null,
    planned_duration: null, target_elevation_gain: null,
  },
  slots: [],
  is_deload: false,
  period: 'morning',
  time_slot: '07:00',
  duration: 90,
  schedule_entry_id: 1,
  is_override: false,
  override_group: null,
  week_number: 3,
  day_of_week: 0,
}

// Overridden projected fixture
const projectedOverride: DayDetailResult = {
  ...projectedBase,
  template: { ...projectedBase.template, id: 11, name: 'Pull B (Moved)' },
  is_override: true,
  override_group: 'move-123-abc',
  period: 'afternoon' as const,
  day_of_week: 2,
}

describe('T189: Day detail panel integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-03-27T12:00:00'))
    mockUndoScheduleMove.mockResolvedValue({ success: true, deleted: 2 })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // "Overridden" badge
  // ==========================================================================

  it('shows "Overridden" badge on projected card with is_override: true', async () => {
    mockFetchResponse(projectedOverride)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Pull B (Moved)')).toBeInTheDocument()
    })

    expect(screen.getByText('Overridden')).toBeInTheDocument()
  })

  it('does not show "Overridden" badge on non-override card', async () => {
    mockFetchResponse(projectedBase)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.queryByText('Overridden')).not.toBeInTheDocument()
  })

  it('does not show "Overridden" badge when is_override is absent (backward compat)', async () => {
    // Simulate old API response without is_override field
    const oldStyleResult = { ...projectedBase }
    delete (oldStyleResult as Record<string, unknown>).is_override
    delete (oldStyleResult as Record<string, unknown>).override_group
    mockFetchResponse(oldStyleResult)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.queryByText('Overridden')).not.toBeInTheDocument()
  })

  // ==========================================================================
  // "Move Workout" button
  // ==========================================================================

  it('shows "Move Workout" button on projected card for active mesocycle', async () => {
    mockFetchResponse(projectedBase)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.getByTestId('move-workout-button')).toBeInTheDocument()
  })

  it('shows "Move Workout" button on projected card for planned mesocycle', async () => {
    const planned = { ...projectedBase, mesocycle_status: 'planned' as const }
    mockFetchResponse(planned)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.getByTestId('move-workout-button')).toBeInTheDocument()
  })

  it('hides "Move Workout" button on projected card for completed mesocycle', async () => {
    const completed = { ...projectedBase, mesocycle_status: 'completed' as const }
    mockFetchResponse(completed)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('move-workout-button')).not.toBeInTheDocument()
  })

  it('hides "Move Workout" button on completed workout cards', async () => {
    const completed: DayDetailResult = {
      type: 'completed',
      date: '2026-03-25',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      snapshot: { version: 1, name: 'Push A', modality: 'resistance', notes: null },
      exercises: [],
      rating: 4,
      notes: null,
      is_deload: false,
      period: 'morning',
    }
    mockFetchResponse(completed)

    render(<DayDetailPanel date="2026-03-25" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('move-workout-button')).not.toBeInTheDocument()
  })

  it('clicking "Move Workout" opens the MoveWorkoutModal', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockFetchResponse(projectedBase)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('move-workout-button'))

    await waitFor(() => {
      expect(screen.getByText(/Move Push A/)).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // "Undo Move" action
  // ==========================================================================

  it('shows "Undo Move" button on overridden entries', async () => {
    mockFetchResponse(projectedOverride)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Pull B (Moved)')).toBeInTheDocument()
    })

    expect(screen.getByTestId('undo-move-button')).toBeInTheDocument()
  })

  it('hides "Undo Move" button on non-override entries', async () => {
    mockFetchResponse(projectedBase)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('undo-move-button')).not.toBeInTheDocument()
  })

  it('"Undo Move" calls undoScheduleMove with correct args', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockFetchResponse(projectedOverride)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Pull B (Moved)')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('undo-move-button'))

    await waitFor(() => {
      expect(mockUndoScheduleMove).toHaveBeenCalledWith('move-123-abc', 1)
    })
  })

  it('"Undo Move" refetches data after successful undo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockFetchResponse(projectedOverride)

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Pull B (Moved)')).toBeInTheDocument()
    })

    // Reset fetch mock to track refetch
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([projectedBase])))
    )
    global.fetch = fetchSpy

    await user.click(screen.getByTestId('undo-move-button'))

    await waitFor(() => {
      // Should refetch after undo
      expect(fetchSpy).toHaveBeenCalledWith('/api/calendar/day?date=2026-03-30')
    })
  })

  // ==========================================================================
  // Mixed scenarios
  // ==========================================================================

  it('multi-session: shows override badge + undo only on overridden card', async () => {
    mockFetchResponse([projectedBase, projectedOverride])

    render(<DayDetailPanel date="2026-03-30" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
    })

    const cards = screen.getAllByTestId('workout-card')

    // First card (morning, non-override) — no badge, no undo
    expect(cards[0]).not.toHaveTextContent('Overridden')
    expect(cards[0].querySelector('[data-testid="undo-move-button"]')).not.toBeInTheDocument()

    // Second card (afternoon, override) — badge + undo
    expect(cards[1]).toHaveTextContent('Overridden')
    expect(cards[1].querySelector('[data-testid="undo-move-button"]')).toBeInTheDocument()
  })
})
