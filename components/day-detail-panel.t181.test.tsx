// T181: elevation gain display in calendar day-detail panel
// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { DayDetailPanel } from './day-detail-panel'
import type { DayDetailResult } from '@/lib/calendar/day-detail'

function mockFetchResponse(data: DayDetailResult | DayDetailResult[]) {
  const arr = Array.isArray(data) ? data : [data]
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(arr)))
  )
}

function makeRunningTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    name: 'Hill Run',
    modality: 'running',
    notes: null,
    run_type: 'easy',
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    planned_duration: null,
    ...overrides,
  }
}

describe('T181: DayDetailPanel — elevation gain in projected running', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('shows elevation gain in projected running workout card', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-15',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: makeRunningTemplate({ target_elevation_gain: 200 }),
      slots: [],
      is_deload: false,
      period: 'morning',
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-15" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Hill Run')).toBeInTheDocument()
    })

    expect(screen.getByTestId('running-detail')).toBeInTheDocument()
    expect(screen.getByText(/200m/)).toBeInTheDocument()
    expect(screen.getByText(/ascent/)).toBeInTheDocument()
  })

  it('does not show elevation gain when target_elevation_gain is null', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-15',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      template: makeRunningTemplate({ target_elevation_gain: null }),
      slots: [],
      is_deload: false,
      period: 'morning',
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-15" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Hill Run')).toBeInTheDocument()
    })

    expect(screen.queryByText(/ascent/)).not.toBeInTheDocument()
  })

  it('does not show elevation gain when field is absent (backward compat)', async () => {
    const projected: DayDetailResult = {
      type: 'projected',
      date: '2026-03-15',
      mesocycle_id: 1,
      mesocycle_status: 'active',
      // Template without target_elevation_gain field at all
      template: makeRunningTemplate(),
      slots: [],
      is_deload: false,
      period: 'morning',
    }
    mockFetchResponse(projected)

    render(<DayDetailPanel date="2026-03-15" onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('Hill Run')).toBeInTheDocument()
    })

    expect(screen.queryByText(/ascent/)).not.toBeInTheDocument()
  })
})
