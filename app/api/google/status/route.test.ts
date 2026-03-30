import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockIsGoogleConnected = vi.fn()
const mockGetSyncStatus = vi.fn()

vi.mock('@/lib/google/queries', () => ({
  isGoogleConnected: (...args: unknown[]) => mockIsGoogleConnected(...args),
  getSyncStatus: (...args: unknown[]) => mockGetSyncStatus(...args),
}))

import { GET } from './route'

describe('GET /api/google/status', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('AC25: returns sync status counts when connected', async () => {
    mockIsGoogleConnected.mockResolvedValue(true)
    mockGetSyncStatus.mockResolvedValue({
      synced: 20,
      pending: 2,
      error: 1,
      lastSyncedAt: '2026-03-30T10:00:00.000Z',
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.connected).toBe(true)
    expect(data.synced).toBe(20)
    expect(data.pending).toBe(2)
    expect(data.error).toBe(1)
    expect(data.lastSyncedAt).toBe('2026-03-30T10:00:00.000Z')
  })

  it('returns disconnected status when not connected', async () => {
    mockIsGoogleConnected.mockResolvedValue(false)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.connected).toBe(false)
    expect(data.synced).toBe(0)
    expect(data.pending).toBe(0)
    expect(data.error).toBe(0)
  })

  it('returns 500 on unexpected error', async () => {
    mockIsGoogleConnected.mockRejectedValue(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
