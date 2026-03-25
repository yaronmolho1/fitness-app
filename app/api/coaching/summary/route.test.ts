import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks
const mockVerifyToken = vi.fn()
const mockGetAthleteProfile = vi.fn()
const mockGetCurrentPlan = vi.fn()
const mockGetRecentSessions = vi.fn()
const mockGetProgressionData = vi.fn()
const mockGetCalendarProjection = vi.fn()
const mockGenerateCoachingSummary = vi.fn()

vi.mock('@/lib/auth/jwt', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}))

vi.mock('@/lib/coaching/queries', () => ({
  getAthleteProfile: (...args: unknown[]) => mockGetAthleteProfile(...args),
  getCurrentPlan: (...args: unknown[]) => mockGetCurrentPlan(...args),
  getRecentSessions: (...args: unknown[]) => mockGetRecentSessions(...args),
}))

vi.mock('@/lib/progression/queries', () => ({
  getProgressionData: (...args: unknown[]) => mockGetProgressionData(...args),
}))

vi.mock('@/lib/calendar/queries', () => ({
  getCalendarProjection: (...args: unknown[]) => mockGetCalendarProjection(...args),
}))

vi.mock('@/lib/coaching/summary', () => ({
  generateCoachingSummary: (...args: unknown[]) => mockGenerateCoachingSummary(...args),
}))

vi.mock('@/lib/db', () => ({
  db: {},
}))

import { POST } from './route'

function makeRequest(
  body: Record<string, unknown>,
  options?: { cookie?: string }
): NextRequest {
  const req = new NextRequest('http://localhost/api/coaching/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (options?.cookie) {
    req.cookies.set('auth-token', options.cookie)
  }
  return req
}

const validBody = {
  fatigue: 3,
  soreness: 2,
  sleep: 4,
  injuries: 'Sore left shoulder',
  notes: 'Felt good overall',
}

describe('POST /api/coaching/summary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: authenticated
    mockVerifyToken.mockResolvedValue({ sub: 'user' })
    // Default: empty data
    mockGetAthleteProfile.mockResolvedValue(null)
    mockGetCurrentPlan.mockResolvedValue(null)
    mockGetRecentSessions.mockResolvedValue([])
    mockGetProgressionData.mockResolvedValue({ sessions: [], phases: [] })
    mockGetCalendarProjection.mockResolvedValue({ days: [] })
    mockGenerateCoachingSummary.mockReturnValue('# Summary')
  })

  // Auth
  it('returns 401 when no auth cookie present', async () => {
    const req = makeRequest(validBody)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when auth token is invalid', async () => {
    mockVerifyToken.mockRejectedValue(new Error('invalid token'))
    const req = makeRequest(validBody, { cookie: 'bad-token' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  // Validation
  it('returns 400 when body is missing required fields', async () => {
    const req = makeRequest({}, { cookie: 'valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when fatigue is out of range (0)', async () => {
    const req = makeRequest({ ...validBody, fatigue: 0 }, { cookie: 'valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when fatigue is out of range (6)', async () => {
    const req = makeRequest({ ...validBody, fatigue: 6 }, { cookie: 'valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when soreness is out of range', async () => {
    const req = makeRequest({ ...validBody, soreness: -1 }, { cookie: 'valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when sleep is out of range', async () => {
    const req = makeRequest({ ...validBody, sleep: 10 }, { cookie: 'valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when fatigue is not a number', async () => {
    const req = makeRequest({ ...validBody, fatigue: 'high' }, { cookie: 'valid-token' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // Valid requests
  it('returns 200 with markdown on valid request', async () => {
    mockGenerateCoachingSummary.mockReturnValue('# Training Summary\n\nContent here')
    const req = makeRequest(validBody, { cookie: 'valid-token' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.markdown).toBe('# Training Summary\n\nContent here')
  })

  it('accepts null for optional fields (injuries, notes)', async () => {
    mockGenerateCoachingSummary.mockReturnValue('# Summary')
    const req = makeRequest(
      { fatigue: 3, soreness: 2, sleep: 4, injuries: null, notes: null },
      { cookie: 'valid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('accepts missing optional fields (injuries, notes)', async () => {
    mockGenerateCoachingSummary.mockReturnValue('# Summary')
    const req = makeRequest(
      { fatigue: 3, soreness: 2, sleep: 4 },
      { cookie: 'valid-token' }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('passes subjective state to generateCoachingSummary', async () => {
    mockGenerateCoachingSummary.mockReturnValue('# Summary')
    const req = makeRequest(validBody, { cookie: 'valid-token' })
    await POST(req)

    expect(mockGenerateCoachingSummary).toHaveBeenCalledTimes(1)
    const input = mockGenerateCoachingSummary.mock.calls[0][0]
    expect(input.subjectiveState).toEqual({
      fatigue: 3,
      soreness: 2,
      sleepQuality: 4,
      currentInjuries: 'Sore left shoulder',
      additionalNotes: 'Felt good overall',
    })
  })

  it('gathers all data sources for the summary', async () => {
    mockGenerateCoachingSummary.mockReturnValue('# Summary')
    const req = makeRequest(validBody, { cookie: 'valid-token' })
    await POST(req)

    expect(mockGetAthleteProfile).toHaveBeenCalledTimes(1)
    expect(mockGetCurrentPlan).toHaveBeenCalledTimes(1)
    expect(mockGetRecentSessions).toHaveBeenCalledTimes(1)
  })

  it('returns 500 on internal error', async () => {
    mockGetAthleteProfile.mockRejectedValue(new Error('DB down'))
    const req = makeRequest(validBody, { cookie: 'valid-token' })
    const res = await POST(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Internal server error')
  })
})
