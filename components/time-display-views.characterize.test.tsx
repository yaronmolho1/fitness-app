// Characterization tests — capture current display behavior before T203 modifies it
// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { CalendarDay } from '@/lib/calendar/queries'

// ============================================================================
// Mocks
// ============================================================================

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

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

import { CalendarGrid } from './calendar-grid'
import { DayDetailPanel } from './day-detail-panel'
import { TodayWorkout } from './today-workout'
import type { DayDetailResult } from '@/lib/calendar/day-detail'

// ============================================================================
// Helpers
// ============================================================================

function mockCalendarFetch(responses: Record<string, CalendarDay[]>) {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    for (const [month, days] of Object.entries(responses)) {
      if (urlStr.includes(`month=${month}`)) {
        return Promise.resolve(new Response(JSON.stringify({ days })))
      }
    }
    return Promise.resolve(new Response(JSON.stringify({ days: [] })))
  })
}

function mockDayDetailFetch(data: DayDetailResult | DayDetailResult[]) {
  const arr = Array.isArray(data) ? data : [data]
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(arr)))
  )
}

function mockTodayFetch(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

// ============================================================================
// A. Calendar Grid Pills — current period label behavior
// ============================================================================

describe('CalendarGrid pills — post-T203 time display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('single workout pill shows HH:MM time prefix when time_slot present', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      if (day === 2) return { date, template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 90 }
      return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    // T203: shows "07:00 Push A" via time_slot
    expect(pill).toHaveTextContent('07:00')
    expect(pill).toHaveTextContent('Push A')
  })

  it('single workout pill does NOT show duration (kept compact)', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      if (day === 2) return { date, template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 90 }
      return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    // Pills are compact — no duration in calendar grid
    expect(pill.textContent).not.toContain('90')
    expect(pill.textContent).not.toContain('min')
  })

  it('single workout with null period but time_slot shows time prefix', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      if (day === 2) return { date, template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: null, time_slot: '07:00', duration: 90 }
      return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    // T203: time_slot present, so show it even without period
    expect(pill.textContent).not.toMatch(/AM|PM|EVE/)
    expect(pill).toHaveTextContent('07:00')
  })

  it('multi-workout pills show HH:MM time prefix', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      if (day === 2) return [
        { date, template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 90 },
        { date, template_name: '5K Run', modality: 'running' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'evening' as const, time_slot: '18:00', duration: 45 },
      ]
      return [{ date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }]
    }).flat()
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const dayCell = screen.getByTestId('calendar-day-2026-03-02')
    const pills = dayCell.querySelectorAll('[data-testid="workout-pill"]')
    expect(pills).toHaveLength(2)
    // T203: shows HH:MM time, sorted chronologically
    expect(pills[0]).toHaveTextContent('07:00')
    expect(pills[0]).toHaveTextContent('Push A')
    expect(pills[1]).toHaveTextContent('18:00')
    expect(pills[1]).toHaveTextContent('5K Run')
  })

  it('multi-workout pills show HH:MM time values', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      if (day === 2) return [
        { date, template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 90 },
        { date, template_name: '5K Run', modality: 'running' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'evening' as const, time_slot: '18:00', duration: 45 },
      ]
      return [{ date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }]
    }).flat()
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const dayCell = screen.getByTestId('calendar-day-2026-03-02')
    const pills = dayCell.querySelectorAll('[data-testid="workout-pill"]')
    // T203: time_slot values shown in pills
    expect(pills[0].textContent).toContain('07:00')
    expect(pills[1].textContent).toContain('18:00')
  })

  it('afternoon time_slot shows HH:MM on pill', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      if (day === 2) return { date, template_name: 'Tempo Run', modality: 'running' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'afternoon' as const, time_slot: '14:00', duration: 60 }
      return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    expect(pill).toHaveTextContent('14:00')
  })
})

// ============================================================================
// B. Day Detail Panel — current period badge and sort behavior
// ============================================================================

describe('DayDetailPanel — post-T203 time display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('workout card header shows "HH:MM — Xmin" time badge', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: {
        id: 1, name: 'Push A', modality: 'resistance', notes: null,
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
      week_number: 1,
      day_of_week: 0,
    }
    mockDayDetailFetch([projected])
    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    // T203: badge shows "07:00 — 90 min"
    const card = screen.getByTestId('workout-card')
    expect(card.textContent).toContain('07:00')
    expect(card.textContent).toContain('90 min')
  })

  it('workout card shows duration in trigger', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: {
        id: 1, name: 'Push A', modality: 'resistance', notes: null,
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
      week_number: 1,
      day_of_week: 0,
    }
    mockDayDetailFetch([projected])
    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })

    const trigger = screen.getByTestId('workout-card-trigger')
    // T203: duration shown in trigger badge
    expect(trigger.textContent).toContain('90 min')
  })

  it('multi-workout cards sorted chronologically by time_slot', async () => {
    const evening: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: {
        id: 2, name: 'Evening Run', modality: 'running', notes: null,
        run_type: 'easy', target_pace: null, hr_zone: null,
        interval_count: null, interval_rest: null, coaching_cues: null,
        planned_duration: null, target_elevation_gain: null,
      },
      slots: [],
      is_deload: false,
      period: 'evening',
      time_slot: '18:00',
      duration: 45,
      schedule_entry_id: 2,
      is_override: false,
      override_group: null,
      week_number: 1,
      day_of_week: 0,
    }
    const morning: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: {
        id: 1, name: 'Push A', modality: 'resistance', notes: null,
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
      week_number: 1,
      day_of_week: 0,
    }
    // Send evening first — should still render morning first (chronological by time_slot)
    mockDayDetailFetch([evening, morning])
    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
    })

    const cards = screen.getAllByTestId('workout-card')
    expect(cards[0]).toHaveTextContent('07:00')
    expect(cards[0]).toHaveTextContent('Push A')
    expect(cards[1]).toHaveTextContent('18:00')
    expect(cards[1]).toHaveTextContent('Evening Run')
  })

  it('sheet description says "N workouts" for multi-workout day, no times', async () => {
    const morning: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: {
        id: 1, name: 'Push A', modality: 'resistance', notes: null,
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
      week_number: 1,
      day_of_week: 0,
    }
    const evening: DayDetailResult = {
      type: 'projected',
      date: '2026-03-02',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: {
        id: 2, name: 'Run', modality: 'running', notes: null,
        run_type: null, target_pace: null, hr_zone: null,
        interval_count: null, interval_rest: null, coaching_cues: null,
        planned_duration: null, target_elevation_gain: null,
      },
      slots: [],
      is_deload: false,
      period: 'evening',
      time_slot: '18:00',
      duration: 45,
      schedule_entry_id: 2,
      is_override: false,
      override_group: null,
      week_number: 1,
      day_of_week: 0,
    }
    mockDayDetailFetch([morning, evening])
    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('2 workouts')).toBeInTheDocument()
    })
  })
})

// ============================================================================
// C. Today View — formatPeriodLabel behavior
// ============================================================================

describe('TodayWorkout — post-T203 formatPeriodLabel and time display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('multi-session with null time_slot shows period name (Morning/Evening)', async () => {
    mockTodayFetch([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'Run', modality: 'running', notes: null, run_type: 'easy', target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
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
    // formatPeriodLabel: time_slot is null => PERIOD_LABELS[period]
    expect(labels[0]).toHaveTextContent('Morning')
    expect(labels[1]).toHaveTextContent('Evening')
  })

  it('multi-session with time_slot shows time_slot string instead of period name', async () => {
    mockTodayFetch([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'morning',
        time_slot: '07:00',
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'Run', modality: 'running', notes: null, run_type: 'easy', target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'evening',
        time_slot: '18:00',
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })

    const labels = screen.getAllByTestId('period-label')
    // formatPeriodLabel: time_slot truthy => returns time_slot as-is
    expect(labels[0]).toHaveTextContent('07:00')
    expect(labels[1]).toHaveTextContent('18:00')
  })

  it('single session does not show period label at all', async () => {
    mockTodayFetch([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
      slots: [],
      period: 'morning',
      time_slot: '07:00',
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })

    // Single session: no period label, no time shown
    expect(screen.queryByTestId('period-label')).not.toBeInTheDocument()
    expect(screen.queryByTestId('multi-session-view')).not.toBeInTheDocument()
  })

  it('single session does not display duration anywhere in header', async () => {
    mockTodayFetch([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
      slots: [],
      period: 'morning',
      time_slot: '07:00',
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })

    // No schedule duration in current UI (planned_duration is template-level for MMA)
    expect(screen.queryByText(/90 min/)).not.toBeInTheDocument()
  })

  it('already_logged in multi-session shows period label from formatPeriodLabel', async () => {
    mockTodayFetch([
      {
        type: 'already_logged',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        loggedWorkout: {
          id: 1, log_date: '2026-03-15', logged_at: '2026-03-15T07:00:00Z',
          canonical_name: 'push-a', rating: null, notes: null,
          template_snapshot: { version: 1, name: 'Push A', modality: 'resistance' },
          exercises: [],
        },
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'Run', modality: 'running', notes: null, run_type: 'easy', target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
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
    // already_logged session also uses formatPeriodLabel
    expect(labels[0]).toHaveTextContent('Morning')
    expect(labels[1]).toHaveTextContent('Evening')
  })

  it('afternoon period shows "Afternoon" in multi-session label', async () => {
    mockTodayFetch([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'morning',
        time_slot: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'BJJ', modality: 'mma', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: 60 },
        slots: [],
        period: 'afternoon',
        time_slot: null,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })

    const labels = screen.getAllByTestId('period-label')
    expect(labels[1]).toHaveTextContent('Afternoon')
  })
})
