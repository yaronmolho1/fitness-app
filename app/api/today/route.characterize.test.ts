// Characterization test — captures current behavior for safe refactoring
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetTodayWorkout = vi.fn()

vi.mock('@/lib/today/queries', () => ({
  getTodayWorkout: (...args: unknown[]) => mockGetTodayWorkout(...args),
}))

import { GET } from './route'

describe('GET /api/today — characterize gaps', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('passes today date string in YYYY-MM-DD format to getTodayWorkout', async () => {
    mockGetTodayWorkout.mockResolvedValue({
      type: 'no_active_mesocycle',
      date: '2026-03-20',
    })

    await GET()

    expect(mockGetTodayWorkout).toHaveBeenCalledTimes(1)
    const dateArg = mockGetTodayWorkout.mock.calls[0][0]
    // Must match YYYY-MM-DD pattern
    expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns already_logged response as JSON', async () => {
    const alreadyLoggedData = {
      type: 'already_logged',
      date: '2026-03-20',
      mesocycle: {
        id: 1,
        name: 'Block A',
        start_date: '2026-03-01',
        end_date: '2026-03-28',
        week_type: 'normal',
      },
      loggedWorkout: {
        id: 5,
        log_date: '2026-03-20',
        logged_at: '2026-03-20T10:30:00.000Z',
        canonical_name: 'push-a',
        rating: 4,
        notes: 'Good session',
        template_snapshot: { version: 1, name: 'push-a', modality: 'resistance' },
        exercises: [
          {
            id: 1,
            exercise_name: 'Bench Press',
            order: 1,
            actual_rpe: 8,
            sets: [
              { set_number: 1, actual_reps: 8, actual_weight: 80 },
              { set_number: 2, actual_reps: 7, actual_weight: 80 },
            ],
          },
        ],
      },
    }
    mockGetTodayWorkout.mockResolvedValue(alreadyLoggedData)

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.type).toBe('already_logged')
    expect(data.loggedWorkout.id).toBe(5)
    expect(data.loggedWorkout.exercises).toHaveLength(1)
    expect(data.loggedWorkout.exercises[0].sets).toHaveLength(2)
  })

  it('returns 200 for all known result types', async () => {
    const types = [
      { type: 'workout', date: '2026-03-20', mesocycle: {}, template: {}, slots: [] },
      { type: 'rest_day', date: '2026-03-20', mesocycle: {}, routines: { items: [], logs: [] } },
      { type: 'no_active_mesocycle', date: '2026-03-20' },
      { type: 'already_logged', date: '2026-03-20', mesocycle: {}, loggedWorkout: {} },
    ]

    for (const data of types) {
      mockGetTodayWorkout.mockResolvedValue(data)
      const res = await GET()
      // NOTE: all result types return 200 — no per-type status differentiation
      expect(res.status).toBe(200)
    }
  })

  it('error response body shape is { error: string }', async () => {
    mockGetTodayWorkout.mockRejectedValue(new Error('test'))

    const res = await GET()
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(Object.keys(data)).toEqual(['error'])
    expect(typeof data.error).toBe('string')
  })

  it('swallows the original error message (does not leak)', async () => {
    mockGetTodayWorkout.mockRejectedValue(new Error('sensitive DB info'))

    const res = await GET()
    const data = await res.json()
    expect(data.error).toBe('Internal server error')
    expect(data.error).not.toContain('sensitive')
  })
})
