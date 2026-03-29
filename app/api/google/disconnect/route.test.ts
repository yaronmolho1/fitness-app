import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/google/actions', () => ({
  disconnectGoogle: vi.fn(),
}))

import { POST } from './route'
import { disconnectGoogle } from '@/lib/google/actions'

const mockedDisconnect = vi.mocked(disconnectGoogle)

describe('POST /api/google/disconnect', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 200 on successful disconnect', async () => {
    mockedDisconnect.mockResolvedValue({ success: true })
    const req = new Request('http://localhost/api/google/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ success: true })
  })

  it('returns 400 when not connected', async () => {
    mockedDisconnect.mockResolvedValue({ success: false, error: 'not_connected' })
    const req = new Request('http://localhost/api/google/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('not_connected')
  })

  it('passes deleteCalendar option from request body', async () => {
    mockedDisconnect.mockResolvedValue({ success: true })
    const req = new Request('http://localhost/api/google/disconnect', {
      method: 'POST',
      body: JSON.stringify({ deleteCalendar: true }),
    })
    await POST(req)
    expect(mockedDisconnect).toHaveBeenCalledWith({ deleteCalendar: true })
  })

  it('returns 500 on unexpected error', async () => {
    mockedDisconnect.mockRejectedValue(new Error('DB error'))
    const req = new Request('http://localhost/api/google/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('disconnect_failed')
  })
})
