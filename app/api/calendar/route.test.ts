import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetCalendarProjection = vi.fn()

vi.mock('@/lib/calendar/queries', () => ({
  getCalendarProjection: (...args: unknown[]) => mockGetCalendarProjection(...args),
}))

import { GET } from './route'

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/calendar')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

describe('GET /api/calendar', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 400 when month param is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/month/)
  })

  it('returns 400 for invalid month format', async () => {
    const res = await GET(makeRequest({ month: '2026-13' }))
    expect(res.status).toBe(400)

    const res2 = await GET(makeRequest({ month: '2026' }))
    expect(res2.status).toBe(400)

    const res3 = await GET(makeRequest({ month: 'abc' }))
    expect(res3.status).toBe(400)
  })

  it('returns calendar data for valid month', async () => {
    const mockData = {
      days: [
        {
          date: '2026-03-01',
          template_name: null,
          modality: null,
          mesocycle_id: null,
          is_deload: false,
          status: 'rest' as const,
        },
      ],
    }
    mockGetCalendarProjection.mockResolvedValue(mockData)

    const res = await GET(makeRequest({ month: '2026-03' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.days).toHaveLength(1)
    expect(data.days[0].date).toBe('2026-03-01')
  })

  it('passes month to query function', async () => {
    mockGetCalendarProjection.mockResolvedValue({ days: [] })

    await GET(makeRequest({ month: '2026-06' }))
    expect(mockGetCalendarProjection).toHaveBeenCalledWith(
      expect.anything(),
      '2026-06'
    )
  })

  it('returns 500 on internal error', async () => {
    mockGetCalendarProjection.mockRejectedValue(new Error('DB failure'))

    const res = await GET(makeRequest({ month: '2026-03' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })

  it('each day entry has required fields', async () => {
    const mockData = {
      days: [
        {
          date: '2026-03-02',
          template_name: 'Push A',
          modality: 'resistance',
          mesocycle_id: 1,
          is_deload: false,
          status: 'projected',
        },
      ],
    }
    mockGetCalendarProjection.mockResolvedValue(mockData)

    const res = await GET(makeRequest({ month: '2026-03' }))
    const data = await res.json()
    const day = data.days[0]

    expect(day).toHaveProperty('date')
    expect(day).toHaveProperty('template_name')
    expect(day).toHaveProperty('modality')
    expect(day).toHaveProperty('mesocycle_id')
    expect(day).toHaveProperty('is_deload')
    expect(day).toHaveProperty('status')
  })
})
