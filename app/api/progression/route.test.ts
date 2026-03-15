import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetProgressionData = vi.fn()

vi.mock('@/lib/progression/queries', () => ({
  getProgressionData: (...args: unknown[]) => mockGetProgressionData(...args),
}))

import { GET } from './route'

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/progression')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new Request(url.toString())
}

describe('GET /api/progression', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 400 when canonical_name is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/canonical_name/)
  })

  it('returns progression data as JSON', async () => {
    const mockData = {
      data: [
        {
          date: '2026-01-08',
          mesocycleId: 1,
          mesocycleName: 'Block A',
          plannedWeight: 80,
          actualWeight: 80,
          plannedVolume: 1920,
          actualVolume: 1840,
        },
      ],
    }
    mockGetProgressionData.mockResolvedValue(mockData)

    const res = await GET(makeRequest({ canonical_name: 'push-a' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
    expect(data.data[0].date).toBe('2026-01-08')
  })

  it('passes exercise_id when provided', async () => {
    mockGetProgressionData.mockResolvedValue({ data: [] })

    await GET(makeRequest({ canonical_name: 'push-a', exercise_id: '10' }))
    expect(mockGetProgressionData).toHaveBeenCalledWith(
      expect.anything(),
      { canonicalName: 'push-a', exerciseId: 10 }
    )
  })

  it('returns empty data for unknown canonical_name', async () => {
    mockGetProgressionData.mockResolvedValue({ data: [] })

    const res = await GET(makeRequest({ canonical_name: 'nonexistent' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data).toEqual([])
  })

  it('returns 500 on internal error', async () => {
    mockGetProgressionData.mockRejectedValue(new Error('DB failure'))

    const res = await GET(makeRequest({ canonical_name: 'push-a' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })
})
