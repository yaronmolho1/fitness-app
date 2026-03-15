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
