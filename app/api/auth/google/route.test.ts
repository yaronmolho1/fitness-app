import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetAuthUrl = vi.fn()

vi.mock('@/lib/google/client', () => ({
  getAuthUrl: mockGetAuthUrl,
}))

describe('GET /api/auth/google', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
    }
    mockGetAuthUrl.mockReturnValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?scope=calendar&state=abc123',
      state: 'abc123',
    })
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('redirects to Google OAuth consent URL', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    // NextResponse.redirect uses 307 by default
    expect([302, 307]).toContain(res.status)
    const location = res.headers.get('location')
    expect(location).toContain('accounts.google.com')
  })

  it('sets a google-oauth-state httpOnly cookie with the CSRF state', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const cookies = res.headers.getSetCookie()
    const stateCookie = cookies.find((c: string) => c.startsWith('google-oauth-state='))
    expect(stateCookie).toBeDefined()
    expect(stateCookie).toContain('HttpOnly')
    expect(stateCookie).toContain('abc123')
  })

  it('sets cookie with SameSite=Lax for OAuth redirect flow', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const cookies = res.headers.getSetCookie()
    const stateCookie = cookies.find((c: string) => c.startsWith('google-oauth-state='))
    // Next.js serializes SameSite as lowercase
    expect(stateCookie!.toLowerCase()).toContain('samesite=lax')
  })
})
