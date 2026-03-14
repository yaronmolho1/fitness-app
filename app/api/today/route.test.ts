import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetTodayWorkout = vi.fn()

vi.mock('@/lib/today/queries', () => ({
  getTodayWorkout: (...args: unknown[]) => mockGetTodayWorkout(...args),
}))

import { GET } from './route'

describe('GET /api/today', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns workout data as JSON', async () => {
    mockGetTodayWorkout.mockResolvedValue({
      type: 'workout',
      date: '2026-03-14',
      mesocycle: { id: 1, name: 'Block A' },
      template: { id: 1, name: 'Push A', modality: 'resistance' },
      slots: [],
    })

    const res = await GET()
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

    const res = await GET()
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

    const res = await GET()
    const data = await res.json()
    expect(data.type).toBe('rest_day')
  })

  it('returns 500 on internal error', async () => {
    mockGetTodayWorkout.mockRejectedValue(new Error('DB failure'))

    const res = await GET()
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })
})
