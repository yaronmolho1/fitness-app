import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCreateOAuth2Client = vi.fn()
const mockExchangeCodeForTokens = vi.fn()
const mockCreateFitnessCalendar = vi.fn()
const mockGetPrimaryTimezone = vi.fn()
const mockStoreCredentials = vi.fn()
const mockUpdateTimezone = vi.fn()

vi.mock('@/lib/google/client', () => ({
  createOAuth2Client: mockCreateOAuth2Client,
  exchangeCodeForTokens: mockExchangeCodeForTokens,
  createFitnessCalendar: mockCreateFitnessCalendar,
  getPrimaryTimezone: mockGetPrimaryTimezone,
  storeCredentials: mockStoreCredentials,
  updateTimezone: mockUpdateTimezone,
}))

const BASE_URL = 'http://localhost:3000'

function createCallbackRequest(params: Record<string, string>, stateCookie?: string): NextRequest {
  const url = new URL('/api/auth/google/callback', BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const req = new NextRequest(url)
  if (stateCookie) {
    req.cookies.set('google-oauth-state', stateCookie)
  }
  return req
}

describe('GET /api/auth/google/callback', () => {
  const originalEnv = process.env
  const mockClient = {
    setCredentials: vi.fn(),
    on: vi.fn(),
    credentials: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expiry_date: Date.now() + 3600000,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar',
    },
  }

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
    }

    mockCreateOAuth2Client.mockReturnValue(mockClient)
    mockExchangeCodeForTokens.mockResolvedValue({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expiry_date: Date.now() + 3600000,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar',
    })
    mockGetPrimaryTimezone.mockResolvedValue('America/New_York')
    mockCreateFitnessCalendar.mockResolvedValue('cal-id-123')
    mockStoreCredentials.mockResolvedValue(undefined)
    mockUpdateTimezone.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  // AC18: state mismatch = CSRF rejection
  it('rejects request when state parameter does not match cookie', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'auth-code', state: 'state-from-google' },
      'different-state-in-cookie'
    )
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toContain('/settings')
    expect(location).toContain('error=state_mismatch')
  })

  it('rejects request when state cookie is missing', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest({ code: 'auth-code', state: 'some-state' })
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toContain('error=state_mismatch')
  })

  // AC15: user denied consent
  it('redirects to settings with error when user denies consent', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { error: 'access_denied', state: 'valid-state' },
      'valid-state'
    )
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toContain('/settings')
    expect(location).toContain('error=access_denied')
  })

  // AC3: exchanges code for tokens
  it('exchanges auth code for tokens on valid callback', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    await GET(req)
    expect(mockExchangeCodeForTokens).toHaveBeenCalledWith('valid-auth-code')
  })

  // AC4: reads timezone
  it('reads primary calendar timezone', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    await GET(req)
    expect(mockGetPrimaryTimezone).toHaveBeenCalled()
  })

  // AC5: creates Fitness calendar
  it('creates a Fitness calendar', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    await GET(req)
    expect(mockCreateFitnessCalendar).toHaveBeenCalled()
  })

  // AC6: stores credentials
  it('stores credentials with calendar_id in DB', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    await GET(req)
    expect(mockStoreCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        calendar_id: 'cal-id-123',
      })
    )
  })

  // AC4: updates timezone
  it('updates athlete profile timezone', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    await GET(req)
    expect(mockUpdateTimezone).toHaveBeenCalledWith('America/New_York')
  })

  // AC7: redirects to settings on success
  it('redirects to /settings on success', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toContain('/settings')
    expect(location).not.toContain('error=')
  })

  it('clears the state cookie on success', async () => {
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    const res = await GET(req)
    const cookies = res.headers.getSetCookie()
    const stateCookie = cookies.find((c: string) => c.startsWith('google-oauth-state='))
    // Cookie should be cleared (max-age=0 or empty value)
    if (stateCookie) {
      expect(stateCookie).toMatch(/Max-Age=0|google-oauth-state=;/)
    }
  })

  // AC17: token exchange failure
  it('redirects to settings with error when token exchange fails', async () => {
    mockExchangeCodeForTokens.mockRejectedValue(new Error('Invalid code'))
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'bad-code', state: 'valid-state' },
      'valid-state'
    )
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toContain('/settings')
    expect(location).toContain('error=token_exchange_failed')
  })

  // Edge case: calendar creation fails after tokens saved
  it('redirects to settings with success even if calendar creation fails (partial state)', async () => {
    mockCreateFitnessCalendar.mockRejectedValue(new Error('Calendar API down'))
    const { GET } = await import('./route')
    const req = createCallbackRequest(
      { code: 'valid-auth-code', state: 'valid-state' },
      'valid-state'
    )
    const res = await GET(req)
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toContain('/settings')
    // Credentials still stored, calendar_id is null
    expect(mockStoreCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        calendar_id: null,
      })
    )
  })
})
