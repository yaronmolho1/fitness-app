import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetTodayWorkout = vi.fn()

vi.mock('@/lib/today/queries', () => ({
  getTodayWorkout: (...args: unknown[]) => mockGetTodayWorkout(...args),
}))

import { GET } from './route'

function makeRequest(url = 'http://localhost/api/today'): NextRequest {
  return new NextRequest(url)
}

describe('GET /api/today', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Existing behavior preserved
  it('returns workout data as JSON', async () => {
    mockGetTodayWorkout.mockResolvedValue({
      type: 'workout',
      date: '2026-03-14',
      mesocycle: { id: 1, name: 'Block A' },
      template: { id: 1, name: 'Push A', modality: 'resistance' },
      slots: [],
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.type).toBe('workout')
    expect(data.template.name).toBe('Push A')
  })

  it('returns no_active_mesocycle when none active', async () => {
    mockGetTodayWorkout.mockResolvedValue({
      type: 'no_active_mesocycle',
      date: '2026-03-14',
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.type).toBe('no_active_mesocycle')
  })

  it('returns rest_day when no schedule', async () => {
    mockGetTodayWorkout.mockResolvedValue({
      type: 'rest_day',
      date: '2026-03-14',
      mesocycle: { id: 1, name: 'Block A' },
    })

    const res = await GET(makeRequest())
    const data = await res.json()
    expect(data.type).toBe('rest_day')
  })

  it('returns 500 on internal error', async () => {
    mockGetTodayWorkout.mockRejectedValue(new Error('DB failure'))

    const res = await GET(makeRequest())
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })

  // T171: date query param
  describe('date query param', () => {
    it('passes valid past date to getTodayWorkout', async () => {
      mockGetTodayWorkout.mockResolvedValue([{
        type: 'workout',
        date: '2026-03-20',
      }])

      const res = await GET(makeRequest('http://localhost/api/today?date=2026-03-20'))
      expect(res.status).toBe(200)
      expect(mockGetTodayWorkout).toHaveBeenCalledWith('2026-03-20')
    })

    it('passes today date to getTodayWorkout when date param equals today', async () => {
      mockGetTodayWorkout.mockResolvedValue([{
        type: 'workout',
        date: '2026-03-25',
      }])

      const res = await GET(makeRequest('http://localhost/api/today?date=2026-03-25'))
      expect(res.status).toBe(200)
      expect(mockGetTodayWorkout).toHaveBeenCalledWith('2026-03-25')
    })

    it('defaults to today when date param is absent', async () => {
      mockGetTodayWorkout.mockResolvedValue([{
        type: 'no_active_mesocycle',
        date: '2026-03-25',
      }])

      await GET(makeRequest())
      expect(mockGetTodayWorkout).toHaveBeenCalledWith('2026-03-25')
    })

    it('defaults to today when date param is empty string', async () => {
      mockGetTodayWorkout.mockResolvedValue([{
        type: 'no_active_mesocycle',
        date: '2026-03-25',
      }])

      await GET(makeRequest('http://localhost/api/today?date='))
      expect(mockGetTodayWorkout).toHaveBeenCalledWith('2026-03-25')
    })

    it('returns 400 for invalid date format', async () => {
      const res = await GET(makeRequest('http://localhost/api/today?date=invalid'))
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toBeDefined()
    })

    it('returns 400 for date with wrong separator', async () => {
      const res = await GET(makeRequest('http://localhost/api/today?date=2026/03/20'))
      expect(res.status).toBe(400)
      expect(mockGetTodayWorkout).not.toHaveBeenCalled()
    })

    it('returns 400 for dd/mm/yyyy format', async () => {
      const res = await GET(makeRequest('http://localhost/api/today?date=20-03-2026'))
      expect(res.status).toBe(400)
      expect(mockGetTodayWorkout).not.toHaveBeenCalled()
    })

    it('returns 400 for future date', async () => {
      const res = await GET(makeRequest('http://localhost/api/today?date=2027-01-01'))
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(mockGetTodayWorkout).not.toHaveBeenCalled()
    })

    it('returns 400 for tomorrow', async () => {
      const res = await GET(makeRequest('http://localhost/api/today?date=2026-03-26'))
      expect(res.status).toBe(400)
      expect(mockGetTodayWorkout).not.toHaveBeenCalled()
    })

    it('returns 400 for impossible date like 2026-02-30', async () => {
      const res = await GET(makeRequest('http://localhost/api/today?date=2026-02-30'))
      expect(res.status).toBe(400)
      expect(mockGetTodayWorkout).not.toHaveBeenCalled()
    })
  })
})
