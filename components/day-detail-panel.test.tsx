// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { DayDetailPanel } from './day-detail-panel'
import type { DayDetailResult } from '@/lib/calendar/day-detail'

// API returns array since T144
function mockFetchResponse(data: DayDetailResult | DayDetailResult[]) {
  const arr = Array.isArray(data) ? data : [data]
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(arr)))
  )
}

// Reusable fixtures
const projectedResistance: DayDetailResult = {
  type: 'projected',
  date: '2026-03-02',
  mesocycle_id: 1,
  mesocycle_status: 'active',
  template: {
    id: 1,
    name: 'Push A',
    modality: 'resistance',
    notes: 'Focus on chest',
    run_type: null, target_pace: null, hr_zone: null,
    interval_count: null, interval_rest: null, coaching_cues: null,
    planned_duration: null,
  },
  slots: [
    { exercise_name: 'Bench Press', sets: 4, reps: '6-8', weight: 100, rpe: 8, rest_seconds: 120, guidelines: 'Pause at bottom', order: 1, is_main: true },
    { exercise_name: 'Incline DB Press', sets: 3, reps: '10-12', weight: 30, rpe: 7, rest_seconds: 90, guidelines: null, order: 2, is_main: false },
  ],
  is_deload: false,
  period: 'morning',
}

const projectedRunning: DayDetailResult = {
  type: 'projected',
  date: '2026-03-02',
  mesocycle_id: 1,
  mesocycle_status: 'active',
  template: {
    id: 2,
    name: 'Evening Run',
    modality: 'running',
    notes: null,
    run_type: 'tempo',
    target_pace: '5:00',
    hr_zone: 3,
    interval_count: null, interval_rest: null,
    coaching_cues: 'Stay relaxed',
    planned_duration: null,
  },
  slots: [],
  is_deload: false,
  period: 'evening',
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
    mockFetchResponse(projectedResistance)

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
      mesocycle_id: 1,
      mesocycle_status: 'active',
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
      period: 'morning',
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
      mesocycle_id: 1,
      mesocycle_status: 'active',
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
      period: 'morning',
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
      mesocycle_id: 1,
      mesocycle_status: 'active',
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
          actual_rpe: 8.5,
          sets: [
            { set_number: 1, actual_reps: 10, actual_weight: 82.5 },
            { set_number: 2, actual_reps: 9, actual_weight: 82.5 },
          ],
        },
      ],
      rating: 4,
      notes: 'Great session',
      is_deload: false,
      period: 'morning',
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
      mesocycle_id: 1,
      mesocycle_status: 'active',
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
      period: 'morning',
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
      mesocycle_id: 1,
      mesocycle_status: 'active',
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
      period: 'morning',
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

  // ============================================================================
  // T124: Quick links — Edit template + schedule grid
  // ============================================================================

  describe('Quick links (T124)', () => {
    it('shows "Edit template" link next to projected workout name for active mesocycle', async () => {
      const projected: DayDetailResult = {
        type: 'projected',
        date: '2026-03-02',
        mesocycle_id: 5,
        mesocycle_status: 'active',
        template: {
          id: 1,
          name: 'Push A',
          modality: 'resistance',
          notes: null,
          run_type: null, target_pace: null, hr_zone: null,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: null,
        },
        slots: [],
        is_deload: false,
        period: 'morning',
      }
      mockFetchResponse(projected)

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      const editLink = screen.getByTestId('edit-template-link')
      expect(editLink).toBeInTheDocument()
      expect(editLink).toHaveAttribute('href', '/mesocycles/5')
    })

    it('hides "Edit template" link when mesocycle is completed', async () => {
      const projected: DayDetailResult = {
        type: 'projected',
        date: '2026-03-02',
        mesocycle_id: 5,
        mesocycle_status: 'completed',
        template: {
          id: 1,
          name: 'Push A',
          modality: 'resistance',
          notes: null,
          run_type: null, target_pace: null, hr_zone: null,
          interval_count: null, interval_rest: null, coaching_cues: null,
          planned_duration: null,
        },
        slots: [],
        is_deload: false,
        period: 'morning',
      }
      mockFetchResponse(projected)

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('edit-template-link')).not.toBeInTheDocument()
    })

    it('rest day within active mesocycle shows schedule grid link', async () => {
      const rest: DayDetailResult = {
        type: 'rest',
        date: '2026-03-03',
        mesocycle_id: 5,
        mesocycle_status: 'active',
      }
      mockFetchResponse(rest)

      render(<DayDetailPanel date="2026-03-03" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('rest-day-message')).toBeInTheDocument()
      })

      const scheduleLink = screen.getByTestId('schedule-link')
      expect(scheduleLink).toBeInTheDocument()
      expect(scheduleLink).toHaveAttribute('href', '/mesocycles/5')
    })

    it('rest day outside mesocycle has no schedule link', async () => {
      const rest: DayDetailResult = {
        type: 'rest',
        date: '2026-03-10',
      }
      mockFetchResponse(rest)

      render(<DayDetailPanel date="2026-03-10" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('rest-day-message')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('schedule-link')).not.toBeInTheDocument()
    })

    it('rest day within completed mesocycle has no schedule link', async () => {
      const rest: DayDetailResult = {
        type: 'rest',
        date: '2026-03-03',
        mesocycle_id: 5,
        mesocycle_status: 'completed',
      }
      mockFetchResponse(rest)

      render(<DayDetailPanel date="2026-03-03" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('rest-day-message')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('schedule-link')).not.toBeInTheDocument()
    })

    it('completed day within active mesocycle shows edit template link', async () => {
      const completed: DayDetailResult = {
        type: 'completed',
        date: '2026-03-02',
        mesocycle_id: 5,
        mesocycle_status: 'active',
        snapshot: {
          version: 1,
          name: 'Push A',
          modality: 'resistance',
          notes: null,
        },
        exercises: [],
        rating: 4,
        notes: null,
        is_deload: false,
        period: 'morning',
      }
      mockFetchResponse(completed)

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      const editLink = screen.getByTestId('edit-template-link')
      expect(editLink).toBeInTheDocument()
      expect(editLink).toHaveAttribute('href', '/mesocycles/5')
    })

    it('completed day within completed mesocycle hides edit template link', async () => {
      const completed: DayDetailResult = {
        type: 'completed',
        date: '2026-03-02',
        mesocycle_id: 5,
        mesocycle_status: 'completed',
        snapshot: {
          version: 1,
          name: 'Push A',
          modality: 'resistance',
          notes: null,
        },
        exercises: [],
        rating: 4,
        notes: null,
        is_deload: false,
        period: 'morning',
      }
      mockFetchResponse(completed)

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('edit-template-link')).not.toBeInTheDocument()
    })
  })

  // ============================================================================
  // T146: Expandable cards — multi-workout display
  // ============================================================================

  describe('Expandable cards (T146)', () => {
    it('renders one card per non-rest workout', async () => {
      mockFetchResponse([projectedResistance, projectedRunning])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
      })
    })

    it('card header shows template name, modality badge, and period label', async () => {
      mockFetchResponse([projectedResistance, projectedRunning])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      // Period labels
      expect(screen.getByText('AM')).toBeInTheDocument()
      expect(screen.getByText('EVE')).toBeInTheDocument()

      // Modality badges
      expect(screen.getByText('resistance')).toBeInTheDocument()
      expect(screen.getByText('running')).toBeInTheDocument()
    })

    it('multi-workout cards are collapsed by default', async () => {
      mockFetchResponse([projectedResistance, projectedRunning])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
      })

      // Content should not be visible when collapsed
      expect(screen.queryByTestId('slot-row')).not.toBeInTheDocument()
      expect(screen.queryByTestId('running-detail')).not.toBeInTheDocument()
    })

    it('single workout card is expanded by default', async () => {
      mockFetchResponse([projectedResistance])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('workout-card')).toBeInTheDocument()
      })

      // Content visible — single workout auto-expands
      expect(screen.getAllByTestId('slot-row')).toHaveLength(2)
    })

    it('clicking collapsed card header expands it', async () => {
      const user = userEvent.setup()
      mockFetchResponse([projectedResistance, projectedRunning])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
      })

      // Click the first card header to expand
      const triggers = screen.getAllByTestId('workout-card-trigger')
      await user.click(triggers[0])

      // Resistance slots now visible
      await waitFor(() => {
        expect(screen.getAllByTestId('slot-row')).toHaveLength(2)
      })
    })

    it('clicking expanded card header collapses it', async () => {
      const user = userEvent.setup()
      mockFetchResponse([projectedResistance])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('slot-row')).toHaveLength(2)
      })

      // Click to collapse
      const trigger = screen.getByTestId('workout-card-trigger')
      await user.click(trigger)

      await waitFor(() => {
        expect(screen.queryByTestId('slot-row')).not.toBeInTheDocument()
      })
    })

    it('afternoon period shows PM label', async () => {
      const afternoon: DayDetailResult = {
        ...projectedResistance,
        period: 'afternoon',
        template: { ...projectedResistance.template, id: 10, name: 'Afternoon Push' },
      } as DayDetailResult
      mockFetchResponse([afternoon])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('PM')).toBeInTheDocument()
      })
    })

    it('rest-only array shows rest day message, no cards', async () => {
      mockFetchResponse([{ type: 'rest', date: '2026-03-03' }])

      render(<DayDetailPanel date="2026-03-03" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('rest-day-message')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('workout-card')).not.toBeInTheDocument()
    })

    it('mixed projected + completed renders both cards', async () => {
      const completed: DayDetailResult = {
        type: 'completed',
        date: '2026-03-02',
        mesocycle_id: 1,
        mesocycle_status: 'active',
        snapshot: { version: 1, name: 'Morning Logged', modality: 'resistance', notes: null },
        exercises: [],
        rating: 3,
        notes: null,
        is_deload: false,
        period: 'morning',
      }
      mockFetchResponse([completed, projectedRunning])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
      })

      expect(screen.getByText('Morning Logged')).toBeInTheDocument()
      expect(screen.getByText('Evening Run')).toBeInTheDocument()
    })

    it('renders cards in period order: morning, afternoon, evening', async () => {
      const eveningFirst: DayDetailResult = {
        ...projectedRunning,
        period: 'evening',
      } as DayDetailResult
      const morningSecond: DayDetailResult = {
        ...projectedResistance,
        period: 'morning',
      } as DayDetailResult
      // Send evening first, morning second — should render morning first
      mockFetchResponse([eveningFirst, morningSecond])

      render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
      })

      const cards = screen.getAllByTestId('workout-card')
      expect(cards[0]).toHaveTextContent('AM')
      expect(cards[1]).toHaveTextContent('EVE')
    })
  })

  // ============================================================================
  // T173: "Log Workout" button on projected cards
  // ============================================================================

  describe('Log Workout button (T173)', () => {
    // Fix "today" to 2026-03-25 for deterministic date comparisons
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(new Date('2026-03-25T12:00:00'))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    // AC1: projected workout, date <= today → show button
    it('shows "Log Workout" button on projected card when date <= today', async () => {
      const projected: DayDetailResult = {
        ...projectedResistance,
        date: '2026-03-25', // today
      }
      mockFetchResponse(projected)

      render(<DayDetailPanel date="2026-03-25" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      expect(screen.getByTestId('log-workout-button')).toBeInTheDocument()
      expect(screen.getByTestId('log-workout-button')).toHaveTextContent('Log Workout')
    })

    it('shows "Log Workout" button on projected card for past date', async () => {
      const projected: DayDetailResult = {
        ...projectedResistance,
        date: '2026-03-20', // past
      }
      mockFetchResponse(projected)

      render(<DayDetailPanel date="2026-03-20" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      expect(screen.getByTestId('log-workout-button')).toBeInTheDocument()
    })

    // AC2: button navigates to /?date=YYYY-MM-DD
    it('"Log Workout" button links to /?date=YYYY-MM-DD', async () => {
      const projected: DayDetailResult = {
        ...projectedResistance,
        date: '2026-03-20',
      }
      mockFetchResponse(projected)

      render(<DayDetailPanel date="2026-03-20" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      const btn = screen.getByTestId('log-workout-button')
      // Button renders as <a> via asChild + Link
      expect(btn).toHaveAttribute('href', '/?date=2026-03-20')
    })

    // AC3: projected workout, date > today → no button
    it('hides "Log Workout" button on projected card when date > today', async () => {
      const projected: DayDetailResult = {
        ...projectedResistance,
        date: '2026-03-26', // tomorrow
      }
      mockFetchResponse(projected)

      render(<DayDetailPanel date="2026-03-26" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('log-workout-button')).not.toBeInTheDocument()
    })

    // AC4: completed workout → no button
    it('hides "Log Workout" button on completed card', async () => {
      const completed: DayDetailResult = {
        type: 'completed',
        date: '2026-03-20',
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

      render(<DayDetailPanel date="2026-03-20" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Push A')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('log-workout-button')).not.toBeInTheDocument()
    })

    // AC5: rest day → no button
    it('hides "Log Workout" button on rest day', async () => {
      mockFetchResponse({ type: 'rest', date: '2026-03-20' })

      render(<DayDetailPanel date="2026-03-20" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByTestId('rest-day-message')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('log-workout-button')).not.toBeInTheDocument()
    })

    // AC6: multi-session, one logged + one projected → only unlogged shows button
    it('shows "Log Workout" only on unlogged projected card in multi-session day', async () => {
      const completed: DayDetailResult = {
        type: 'completed',
        date: '2026-03-20',
        mesocycle_id: 1,
        mesocycle_status: 'active',
        snapshot: { version: 1, name: 'Morning Logged', modality: 'resistance', notes: null },
        exercises: [],
        rating: 3,
        notes: null,
        is_deload: false,
        period: 'morning',
      }
      const projected: DayDetailResult = {
        ...projectedRunning,
        date: '2026-03-20',
        period: 'evening' as const,
      }
      mockFetchResponse([completed, projected])

      render(<DayDetailPanel date="2026-03-20" onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
      })

      // Only one "Log Workout" button — on the projected card
      const logButtons = screen.getAllByTestId('log-workout-button')
      expect(logButtons).toHaveLength(1)

      // The button should be inside the evening projected card
      const cards = screen.getAllByTestId('workout-card')
      expect(cards[0]).not.toContainElement(screen.queryByTestId('log-workout-button'))
      expect(cards[1]).toContainElement(logButtons[0])
    })
  })
})
