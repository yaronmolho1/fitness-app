import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/index', () => ({
  sqlite: {
    prepare: vi.fn(),
  },
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 200 with db connected when DB is accessible', async () => {
    const { sqlite } = await import('@/lib/db/index')
    vi.mocked(sqlite.prepare).mockReturnValue({ get: () => ({ '1': 1 }) } as ReturnType<typeof sqlite.prepare>)

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', db: 'connected' })
  })

  it('returns 503 with db disconnected when DB query throws', async () => {
    const { sqlite } = await import('@/lib/db/index')
    vi.mocked(sqlite.prepare).mockImplementation(() => {
      throw new Error('database is locked')
    })

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error', db: 'disconnected' })
  })

  it('does not require authentication (public route)', async () => {
    const { sqlite } = await import('@/lib/db/index')
    vi.mocked(sqlite.prepare).mockReturnValue({ get: () => ({ '1': 1 }) } as ReturnType<typeof sqlite.prepare>)

    const { GET } = await import('./route')
    // Call without any auth context — should still return 200
    const res = await GET()

    expect(res.status).toBe(200)
  })
})
