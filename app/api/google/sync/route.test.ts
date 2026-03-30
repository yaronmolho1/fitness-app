import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRetryFailedSyncs = vi.fn()

vi.mock('@/lib/google/sync', () => ({
  retryFailedSyncs: (...args: unknown[]) => mockRetryFailedSyncs(...args),
}))

import { POST } from './route'

describe('POST /api/google/sync', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('AC20: calls retryFailedSyncs and returns result', async () => {
    mockRetryFailedSyncs.mockResolvedValue({
      created: 3, updated: 0, deleted: 0, failed: 0, errors: [],
    })

    const req = new Request('http://localhost/api/google/sync', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.created).toBe(3)
    expect(data.failed).toBe(0)
    expect(mockRetryFailedSyncs).toHaveBeenCalled()
  })

  it('returns result even when some retries fail', async () => {
    mockRetryFailedSyncs.mockResolvedValue({
      created: 1, updated: 0, deleted: 0, failed: 2,
      errors: [
        { operation: 'create', date: '2026-04-06', templateId: 10, message: 'API error' },
        { operation: 'create', date: '2026-04-07', templateId: 10, message: 'API error' },
      ],
    })

    const req = new Request('http://localhost/api/google/sync', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.created).toBe(1)
    expect(data.failed).toBe(2)
    expect(data.errors).toHaveLength(2)
  })

  it('returns 500 on unexpected error', async () => {
    mockRetryFailedSyncs.mockRejectedValue(new Error('Unexpected'))

    const req = new Request('http://localhost/api/google/sync', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('sync_failed')
  })
})
