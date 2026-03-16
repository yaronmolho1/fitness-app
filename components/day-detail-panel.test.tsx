// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { DayDetailPanel } from './day-detail-panel'
import type { DayDetailResult } from '@/lib/calendar/day-detail'

function mockFetchResponse(data: DayDetailResult) {
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(data)))
  )
}

describe('DayDetailPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('does not render content when date is null', () => {
    render(<DayDetailPanel date={null} onClose={() => {}} />)
    expect(screen.queryByTestId('day-detail-panel')).not.toBeInTheDocument()
  })

  // ============================================================================
  // Rest day
  // ============================================================================

  it('shows Rest Day message for rest day', async () => {
    mockFetchResponse({ type: 'rest', date: '2026-03-03' })

    render(<DayDetailPanel date="2026-03-03" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByTestId('rest-day-message')).toBeInTheDocument()
    })

    expect(screen.getByTestId('rest-day-message')).toHaveTextContent('Rest Day')
  })

  // ============================================================================
  // Projected resistance
  // ============================================================================

  it('shows projected resistance template with exercise slots', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      template: {
        id: 1,
        name: 'Push A',
        modality: 'resistance',
        notes: 'Focus on chest',
        run_type: null,
        target_pace: null,
        hr_zone: null,
        interval_count: null,
        interval_rest: null,
        coaching_cues: null,
        planned_duration: null,
      },
      slots: [
        { exercise_name: 'Bench Press', sets: 4, reps: '6-8', weight: 100, rpe: 8, rest_seconds: 120, guidelines: 'Pause at bottom', order: 1, is_main: true },
        { exercise_name: 'Incline DB Press', sets: 3, reps: '10-12', weight: 30, rpe: 7, rest_seconds: 90, guidelines: null, order: 2, is_main: false },
      ],
      is_deload: false,
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    expect(screen.getByText('resistance')).toBeInTheDocument()
    expect(screen.getByText('Focus on chest')).toBeInTheDocument()

    const slots = screen.getAllByTestId('slot-row')
    expect(slots).toHaveLength(2)

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Incline DB Press')).toBeInTheDocument()
    expect(screen.getByText('Pause at bottom')).toBeInTheDocument()

    // Main badge on first slot
    expect(screen.getByText('main')).toBeInTheDocument()
  })

  // ============================================================================
  // Projected running
  // ============================================================================

  it('shows projected running template with run-specific fields', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-04',
      template: {
        id: 2,
        name: 'Tempo Run',
        modality: 'running',
        notes: null,
        run_type: 'tempo',
        target_pace: '5:00',
        hr_zone: 3,
        interval_count: null,
        interval_rest: null,
        coaching_cues: 'Stay relaxed',
        planned_duration: null,
      },
      slots: [],
      is_deload: false,
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-04" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Tempo Run')).toBeInTheDocument()
    })

    expect(screen.getByTestId('running-detail')).toBeInTheDocument()
    expect(screen.getByText('Stay relaxed')).toBeInTheDocument()
  })

  // ============================================================================
  // Projected MMA
  // ============================================================================

  it('shows projected MMA template with duration', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-06',
      template: {
        id: 3,
        name: 'BJJ Sparring',
        modality: 'mma',
        notes: null,
        run_type: null,
        target_pace: null,
        hr_zone: null,
        interval_count: null,
        interval_rest: null,
        coaching_cues: null,
        planned_duration: 90,
      },
      slots: [],
      is_deload: false,
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-06" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('BJJ Sparring')).toBeInTheDocument()
    })

    expect(screen.getByTestId('mma-detail')).toBeInTheDocument()
    expect(screen.getByText(/90 min/)).toBeInTheDocument()
  })

  // ============================================================================
  // Completed day — planned + actuals
  // ============================================================================

  it('shows completed day with snapshot, rating, notes, and actuals', async () => {
    const completed: DayDetailResult = {
      type: 'completed',
      date: '2026-03-02',
      snapshot: {
        version: 1,
        name: 'Push A Snapshot',
        modality: 'resistance',
        notes: 'Snapshot notes',
        slots: [
          { exercise_name: 'Bench Press', sets: 3, reps: '8-10', weight: 80, rpe: 8, rest_seconds: 120, guidelines: null, order: 1, is_main: true },
        ],
      },
      exercises: [
        {
          exercise_name: 'Bench Press',
          order: 1,
          sets: [
            { set_number: 1, actual_reps: 10, actual_weight: 82.5, actual_rpe: 8.5 },
            { set_number: 2, actual_reps: 9, actual_weight: 82.5, actual_rpe: 9 },
          ],
        },
      ],
      rating: 4,
      notes: 'Great session',
      is_deload: false,
    }
    mockFetchResponse(completed)

    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A Snapshot')).toBeInTheDocument()
    })

    // Rating
    expect(screen.getByTestId('rating-display')).toBeInTheDocument()
    expect(screen.getByText('(4/5)')).toBeInTheDocument()

    // Notes
    expect(screen.getByText('Great session')).toBeInTheDocument()

    // Snapshot notes
    expect(screen.getByText('Snapshot notes')).toBeInTheDocument()

    // Actual sets
    const actualSets = screen.getAllByTestId('actual-set')
    expect(actualSets).toHaveLength(2)
  })

  // ============================================================================
  // Completed day reads snapshot, not current template
  // ============================================================================

  it('completed day shows snapshot name, not live template name', async () => {
    const completed: DayDetailResult = {
      type: 'completed',
      date: '2026-03-02',
      snapshot: {
        version: 1,
        name: 'Push A v1 Original',
        modality: 'resistance',
        notes: null,
      },
      exercises: [],
      rating: null,
      notes: null,
      is_deload: false,
    }
    mockFetchResponse(completed)

    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A v1 Original')).toBeInTheDocument()
    })
  })

  // ============================================================================
  // Deload badge
  // ============================================================================

  it('shows deload badge for deload day', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-09',
      template: {
        id: 2,
        name: 'Push Deload',
        modality: 'resistance',
        notes: null,
        run_type: null,
        target_pace: null,
        hr_zone: null,
        interval_count: null,
        interval_rest: null,
        coaching_cues: null,
        planned_duration: null,
      },
      slots: [],
      is_deload: true,
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-09" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push Deload')).toBeInTheDocument()
    })

    expect(screen.getByText('Deload')).toBeInTheDocument()
  })

  // ============================================================================
  // Fetches correct endpoint
  // ============================================================================

  it('fetches from /api/calendar/day with date param', async () => {
    mockFetchResponse({ type: 'rest', date: '2026-03-10' })

    render(<DayDetailPanel date="2026-03-10" onClose={() => {}} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/calendar/day?date=2026-03-10')
    })
  })
})
