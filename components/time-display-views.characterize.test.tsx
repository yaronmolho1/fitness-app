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

describe('CalendarGrid pills — pre-T203 period display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('single workout pill shows AM period prefix, not HH:MM time', async () => {
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
    // Current: shows "AM Push A" via PERIOD_LABELS
    expect(pill).toHaveTextContent('AM')
    expect(pill).toHaveTextContent('Push A')
  })

  it('single workout pill does NOT show duration', async () => {
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
    // No duration shown currently
    expect(pill.textContent).not.toContain('90')
    expect(pill.textContent).not.toContain('min')
  })

  it('single workout with null period shows no prefix', async () => {
    const days: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      // period null, but has template — edge case
      if (day === 2) return { date, template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: null, time_slot: '07:00', duration: 90 }
      return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    // No AM/PM/EVE when period is null, no time shown either
    expect(pill.textContent).not.toMatch(/AM|PM|EVE/)
    expect(pill.textContent).not.toContain('07:00')
  })

  it('multi-workout pills show period prefix AM/EVE in pill text', async () => {
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
    // Uses PERIOD_LABELS mapping, not HH:MM time
    expect(pills[0]).toHaveTextContent('AM')
    expect(pills[0]).toHaveTextContent('Push A')
    expect(pills[1]).toHaveTextContent('EVE')
    expect(pills[1]).toHaveTextContent('5K Run')
  })

  it('multi-workout pills do NOT show HH:MM time', async () => {
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
    // No time_slot values in pills
    expect(pills[0].textContent).not.toContain('07:00')
    expect(pills[1].textContent).not.toContain('18:00')
  })

  it('afternoon period shows PM prefix on pill', async () => {
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
    expect(pill).toHaveTextContent('PM')
  })
})

// ============================================================================
// B. Day Detail Panel — current period badge and sort behavior
// ============================================================================

describe('DayDetailPanel — pre-T203 period display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('workout card header shows period badge AM/PM/EVE, not HH:MM', async () => {
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

    // Period badge shows "AM", not "07:00"
    expect(screen.getByText('AM')).toBeInTheDocument()
    // No "07:00" rendered in card header
    const card = screen.getByTestId('workout-card')
    expect(card.textContent).not.toContain('07:00')
  })

  it('workout card does NOT show duration', async () => {
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
    // No "90 min" or duration in header
    expect(trigger.textContent).not.toContain('90 min')
    expect(trigger.textContent).not.toContain('90min')
  })

  it('multi-workout cards sorted by periodOrder (morning < afternoon < evening)', async () => {
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
    // Send evening first — should still render morning first due to periodOrder
    mockDayDetailFetch([evening, morning])
    render(<DayDetailPanel date="2026-03-02" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('workout-card')).toHaveLength(2)
    })

    const cards = screen.getAllByTestId('workout-card')
    expect(cards[0]).toHaveTextContent('AM')
    expect(cards[0]).toHaveTextContent('Push A')
    expect(cards[1]).toHaveTextContent('EVE')
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

describe('TodayWorkout — pre-T203 formatPeriodLabel and time display', () => {
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
