// T203: Time display across views — tests for new behavior
// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
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

function makeRestDays(count: number, startDate: string): CalendarDay[] {
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1
    const date = `${startDate.slice(0, 8)}${String(day).padStart(2, '0')}`
    return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const, period: null, time_slot: null, duration: null }
  })
}

// ============================================================================
// A. Calendar Grid — AC1: pill shows "HH:MM Template Name"
// ============================================================================

describe('CalendarGrid pills — T203 time prefix', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('AC1: single workout pill shows time prefix "07:00" instead of "AM"', async () => {
    const days: CalendarDay[] = makeRestDays(31, '2026-03-01')
    days[1] = { date: '2026-03-02', template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected', period: 'morning', time_slot: '07:00', duration: 90 }
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    expect(pill).toHaveTextContent('07:00')
    expect(pill).toHaveTextContent('Push A')
    // Should NOT show old period label
    expect(pill.textContent).not.toMatch(/\bAM\b/)
  })

  it('AC1: afternoon workout shows "14:00" instead of "PM"', async () => {
    const days: CalendarDay[] = makeRestDays(31, '2026-03-01')
    days[1] = { date: '2026-03-02', template_name: 'Tempo Run', modality: 'running', mesocycle_id: 1, is_deload: false, status: 'projected', period: 'afternoon', time_slot: '14:00', duration: 60 }
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    expect(pill).toHaveTextContent('14:00')
    expect(pill.textContent).not.toMatch(/\bPM\b/)
  })

  it('AC2: multi-workout pills sorted chronologically by time_slot', async () => {
    const days: CalendarDay[] = makeRestDays(31, '2026-03-01').flatMap((d, i) => {
      if (i === 1) return [
        { date: '2026-03-02', template_name: '5K Run', modality: 'running' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'evening' as const, time_slot: '18:00', duration: 45 },
        { date: '2026-03-02', template_name: 'Push A', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 90 },
      ]
      return [d]
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const dayCell = screen.getByTestId('calendar-day-2026-03-02')
    const pills = dayCell.querySelectorAll('[data-testid="workout-pill"]')
    expect(pills).toHaveLength(2)
    // First pill should be 07:00 (earlier), second 18:00
    expect(pills[0]).toHaveTextContent('07:00')
    expect(pills[0]).toHaveTextContent('Push A')
    expect(pills[1]).toHaveTextContent('18:00')
    expect(pills[1]).toHaveTextContent('5K Run')
  })

  it('AC1: null time_slot falls back to period label', async () => {
    const days: CalendarDay[] = makeRestDays(31, '2026-03-01')
    days[1] = { date: '2026-03-02', template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected', period: 'morning', time_slot: null, duration: null }
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const pill = screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="workout-pill"]')!
    // Falls back to period label when no time_slot
    expect(pill).toHaveTextContent('AM')
  })

  it('edge: same start time — sorted by template name as tiebreaker', async () => {
    const days: CalendarDay[] = makeRestDays(31, '2026-03-01').flatMap((d, i) => {
      if (i === 1) return [
        { date: '2026-03-02', template_name: 'Yoga', modality: 'mma' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 60 },
        { date: '2026-03-02', template_name: 'Abs', modality: 'resistance' as const, mesocycle_id: 1, is_deload: false, status: 'projected' as const, period: 'morning' as const, time_slot: '07:00', duration: 30 },
      ]
      return [d]
    })
    mockCalendarFetch({ '2026-03': days })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const dayCell = screen.getByTestId('calendar-day-2026-03-02')
    const pills = dayCell.querySelectorAll('[data-testid="workout-pill"]')
    expect(pills).toHaveLength(2)
    // "Abs" < "Yoga" alphabetically
    expect(pills[0]).toHaveTextContent('Abs')
    expect(pills[1]).toHaveTextContent('Yoga')
  })
})

// ============================================================================
// B. Day Detail Panel — AC3-4: "HH:MM — Xmin" and chronological sort
// ============================================================================

describe('DayDetailPanel — T203 time + duration display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('AC3: workout card shows "07:00 — 90 min" instead of "AM" badge', async () => {
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
    expect(trigger.textContent).toContain('07:00')
    expect(trigger.textContent).toContain('90 min')
    // No old period badge
    expect(trigger.textContent).not.toMatch(/\bAM\b/)
  })

  it('AC3: null time_slot falls back to period label, no duration shown', async () => {
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
      time_slot: null,
      duration: null,
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
    // Falls back to period label
    expect(trigger.textContent).toContain('AM')
  })

  it('AC4: multi-workout cards sorted by time_slot, not period order', async () => {
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
    // Send evening first — should still render morning first (chronological)
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
})

// ============================================================================
// C. Today View — AC5-7: time + duration display
// ============================================================================

describe('TodayWorkout — T203 time + duration display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('AC5: multi-session period label shows "07:00 — 90 min"', async () => {
    mockTodayFetch([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'morning',
        time_slot: '07:00',
        duration: 90,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'Run', modality: 'running', notes: null, run_type: 'easy', target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'evening',
        time_slot: '18:00',
        duration: 45,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })

    const labels = screen.getAllByTestId('period-label')
    expect(labels).toHaveLength(2)
    expect(labels[0]).toHaveTextContent('07:00')
    expect(labels[0]).toHaveTextContent('90 min')
    expect(labels[1]).toHaveTextContent('18:00')
    expect(labels[1]).toHaveTextContent('45 min')
  })

  it('AC5: null time_slot falls back to period name, no duration', async () => {
    mockTodayFetch([
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'morning',
        time_slot: null,
        duration: null,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'Run', modality: 'running', notes: null, run_type: 'easy', target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'evening',
        time_slot: null,
        duration: null,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })

    const labels = screen.getAllByTestId('period-label')
    expect(labels[0]).toHaveTextContent('Morning')
    expect(labels[1]).toHaveTextContent('Evening')
  })

  it('AC7: single session shows time + duration info', async () => {
    mockTodayFetch([{
      type: 'workout',
      date: '2026-03-15',
      mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      template: { id: 1, name: 'Push A', modality: 'resistance', notes: null, run_type: null, target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
      slots: [],
      period: 'morning',
      time_slot: '07:00',
      duration: 90,
    }])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('workout-display')).toBeInTheDocument()
    })

    // Single session should still show time info (AC7: no special case hiding)
    expect(screen.getByTestId('time-info')).toHaveTextContent('07:00')
    expect(screen.getByTestId('time-info')).toHaveTextContent('90 min')
  })

  it('AC5: formatPeriodLabel with time_slot and duration shows both', async () => {
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
        time_slot: '07:00',
        duration: 90,
      },
      {
        type: 'workout',
        date: '2026-03-15',
        mesocycle: { id: 1, name: 'Block A', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
        template: { id: 2, name: 'Run', modality: 'running', notes: null, run_type: 'easy', target_pace: null, hr_zone: null, interval_count: null, interval_rest: null, coaching_cues: null, planned_duration: null },
        slots: [],
        period: 'evening',
        time_slot: '18:00',
        duration: 45,
      },
    ])
    render(<TodayWorkout />)

    await waitFor(() => {
      expect(screen.getByTestId('multi-session-view')).toBeInTheDocument()
    })

    const labels = screen.getAllByTestId('period-label')
    expect(labels[0]).toHaveTextContent('07:00')
    expect(labels[0]).toHaveTextContent('90 min')
  })
})
