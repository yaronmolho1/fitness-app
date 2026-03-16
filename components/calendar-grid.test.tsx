// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { CalendarDay } from '@/lib/calendar/queries'

// March 2026: 31 days, starts on Sunday (col 7 in Mon-Sun grid)
const MARCH_2026_DAYS: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
  const day = i + 1
  const date = `2026-03-${String(day).padStart(2, '0')}`
  if (day === 2) return { date, template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected' }
  if (day === 4) return { date, template_name: '5K Tempo', modality: 'running', mesocycle_id: 1, is_deload: false, status: 'projected' }
  if (day === 6) return { date, template_name: 'BJJ Sparring', modality: 'mma', mesocycle_id: 1, is_deload: false, status: 'projected' }
  return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' }
})

function mockFetch(responses: Record<string, CalendarDay[]>) {
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

import { CalendarGrid } from './calendar-grid'

describe('CalendarGrid', () => {
  beforeEach(() => {
    mockFetch({ '2026-03': MARCH_2026_DAYS })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders 7 day-of-week column headers Mon-Sun', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument()
    })

    for (const h of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(h)).toBeInTheDocument()
    }
  })

  it('renders month and year in header', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByText(/March 2026/)).toBeInTheDocument()
    })
  })

  it('defaults to current month when no initialMonth prop', async () => {
    // The actual current month will be used; we just check fetch is called
    render(<CalendarGrid />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('fetches calendar data for the specified month', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/calendar?month=2026-03')
      )
    })
  })

  it('renders all day numbers for the month', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('displays template name on workout days', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByText('Push A')).toBeInTheDocument()
    })
    expect(screen.getByText('5K Tempo')).toBeInTheDocument()
    expect(screen.getByText('BJJ Sparring')).toBeInTheDocument()
  })

  it('rest days show no template name', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-01')).toBeInTheDocument()
    })

    const day1Cell = screen.getByTestId('calendar-day-2026-03-01')
    expect(day1Cell).not.toHaveTextContent('Push')
    expect(day1Cell).not.toHaveTextContent('Tempo')
    expect(day1Cell).not.toHaveTextContent('Sparring')
  })

  it('applies resistance modality color class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-02').className).toMatch(/resistance/)
  })

  it('applies running modality color class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-04')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-04').className).toMatch(/running/)
  })

  it('applies mma modality color class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-06')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-06').className).toMatch(/mma/)
  })

  it('rest days have no modality color class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-01')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-01').className).not.toMatch(/resistance|running|mma/)
  })

  it('navigates to previous month', async () => {
    const febDays: CalendarDay[] = Array.from({ length: 28 }, (_, i) => ({
      date: `2026-02-${String(i + 1).padStart(2, '0')}`,
      template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const,
    }))

    mockFetch({ '2026-03': MARCH_2026_DAYS, '2026-02': febDays })

    render(<CalendarGrid initialMonth="2026-03" />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText(/March 2026/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /prev/i }))

    await waitFor(() => {
      expect(screen.getByText(/February 2026/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/calendar?month=2026-02')
    )
  })

  it('navigates to next month', async () => {
    const aprilDays: CalendarDay[] = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const,
    }))

    mockFetch({ '2026-03': MARCH_2026_DAYS, '2026-04': aprilDays })

    render(<CalendarGrid initialMonth="2026-03" />)
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText(/March 2026/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByText(/April 2026/)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/calendar?month=2026-04')
    )
  })

  it('shows loading state while fetching', () => {
    global.fetch = vi.fn((): Promise<Response> =>
      new Promise(() => {}) // never resolves
    )

    render(<CalendarGrid initialMonth="2026-03" />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('three modality colors are visually distinct', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const resistance = screen.getByTestId('calendar-day-2026-03-02').className
    const running = screen.getByTestId('calendar-day-2026-03-04').className
    const mma = screen.getByTestId('calendar-day-2026-03-06').className

    expect(resistance).not.toBe(running)
    expect(resistance).not.toBe(mma)
    expect(running).not.toBe(mma)
  })
})

// T067: completed day markers
describe('CalendarGrid – status markers', () => {
  // Mix of completed, projected, and rest days
  const DAYS_WITH_STATUS: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1
    const date = `2026-03-${String(day).padStart(2, '0')}`
    // day 2: completed resistance workout
    if (day === 2) return { date, template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'completed' }
    // day 4: projected running (not yet logged)
    if (day === 4) return { date, template_name: '5K Tempo', modality: 'running', mesocycle_id: 1, is_deload: false, status: 'projected' }
    // day 6: completed mma workout
    if (day === 6) return { date, template_name: 'BJJ Sparring', modality: 'mma', mesocycle_id: 1, is_deload: false, status: 'completed' }
    // day 9: projected resistance (past, missed workout)
    if (day === 9) return { date, template_name: 'Pull A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected' }
    return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    mockFetch({ '2026-03': DAYS_WITH_STATUS })
  })

  it('completed day shows a completed marker', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const day2 = screen.getByTestId('calendar-day-2026-03-02')
    expect(day2.querySelector('[data-testid="completed-marker"]')).toBeInTheDocument()
  })

  it('projected day does not show a completed marker', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-04')).toBeInTheDocument()
    })

    const day4 = screen.getByTestId('calendar-day-2026-03-04')
    expect(day4.querySelector('[data-testid="completed-marker"]')).toBeNull()
  })

  it('rest day does not show a completed marker', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-01')).toBeInTheDocument()
    })

    const day1 = screen.getByTestId('calendar-day-2026-03-01')
    expect(day1.querySelector('[data-testid="completed-marker"]')).toBeNull()
  })

  it('completed day retains modality color alongside marker', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    const day2 = screen.getByTestId('calendar-day-2026-03-02')
    // Has modality color
    expect(day2.className).toMatch(/resistance/)
    // Has completed marker
    expect(day2.querySelector('[data-testid="completed-marker"]')).toBeInTheDocument()
  })

  it('completed day has status-completed data attribute', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-02').dataset.status).toBe('completed')
  })

  it('projected day has status-projected data attribute', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-04')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-04').dataset.status).toBe('projected')
  })

  it('rest day has status-rest data attribute', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-01')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-01').dataset.status).toBe('rest')
  })

  it('past unlogged day with template shows as projected (missed workout)', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-09')).toBeInTheDocument()
    })

    const day9 = screen.getByTestId('calendar-day-2026-03-09')
    // Projected, not completed — missed workout
    expect(day9.dataset.status).toBe('projected')
    expect(day9.querySelector('[data-testid="completed-marker"]')).toBeNull()
    // Still shows the template name
    expect(day9).toHaveTextContent('Pull A')
  })

  it('multiple completed days each show their own marker', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    // day 2 and day 6 are both completed
    expect(screen.getByTestId('calendar-day-2026-03-02').querySelector('[data-testid="completed-marker"]')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-day-2026-03-06').querySelector('[data-testid="completed-marker"]')).toBeInTheDocument()
  })
})

// T068: deload week distinction
describe('CalendarGrid – deload week distinction', () => {
  // Mesocycle with 2 work weeks + deload starting Mar 2 (Mon)
  // W1=Mar2-8, W2=Mar9-15, Deload=Mar16-22
  const DAYS_WITH_DELOAD: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1
    const date = `2026-03-${String(day).padStart(2, '0')}`
    // Days 2, 9: normal work week workout days
    if (day === 2) return { date, template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected' }
    if (day === 9) return { date, template_name: 'Push A', modality: 'resistance', mesocycle_id: 1, is_deload: false, status: 'projected' }
    // Days 3-8, 10-15: rest within normal weeks
    if (day >= 3 && day <= 8) return { date, template_name: null, modality: null, mesocycle_id: 1, is_deload: false, status: 'rest' }
    if (day >= 10 && day <= 15) return { date, template_name: null, modality: null, mesocycle_id: 1, is_deload: false, status: 'rest' }
    // Day 16: deload workout day
    if (day === 16) return { date, template_name: 'Push Deload', modality: 'resistance', mesocycle_id: 1, is_deload: true, status: 'projected' }
    // Days 17-22: deload rest days
    if (day >= 17 && day <= 22) return { date, template_name: null, modality: null, mesocycle_id: 1, is_deload: true, status: 'rest' }
    // Outside mesocycle
    return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    mockFetch({ '2026-03': DAYS_WITH_DELOAD })
  })

  it('deload day has data-deload="true" attribute', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-16')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-16').dataset.deload).toBe('true')
  })

  it('normal day has data-deload="false" attribute', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-02').dataset.deload).toBe('false')
  })

  it('deload day has distinct visual class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-16')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-16').className).toMatch(/deload/)
  })

  it('deload rest day (no workout) also has deload visual treatment', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-17')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-17').dataset.deload).toBe('true')
    expect(screen.getByTestId('calendar-day-2026-03-17').className).toMatch(/deload/)
  })

  it('normal work week day does not have deload class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-02')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-02').className).not.toMatch(/deload/)
  })

  it('day outside mesocycle does not have deload class', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-01')).toBeInTheDocument()
    })

    expect(screen.getByTestId('calendar-day-2026-03-01').className).not.toMatch(/deload/)
  })

  it('deload visual treatment is distinct from modality colors', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-16')).toBeInTheDocument()
    })

    const deloadDay = screen.getByTestId('calendar-day-2026-03-16')
    expect(deloadDay.className).toMatch(/deload/)
    expect(deloadDay.className).toMatch(/resistance/)
  })

  it('renders a legend identifying deload treatment', async () => {
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-16')).toBeInTheDocument()
    })

    expect(screen.getByText('Deload week')).toBeInTheDocument()
  })

  it('no deload legend when no deload days in month', async () => {
    const NO_DELOAD_DAYS: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1
      const date = `2026-03-${String(day).padStart(2, '0')}`
      return { date, template_name: null, modality: null, mesocycle_id: null, is_deload: false, status: 'rest' as const }
    })

    mockFetch({ '2026-03': NO_DELOAD_DAYS })
    render(<CalendarGrid initialMonth="2026-03" />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-day-2026-03-01')).toBeInTheDocument()
    })

    expect(screen.queryByText('Deload week')).not.toBeInTheDocument()
  })
})
