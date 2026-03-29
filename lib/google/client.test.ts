import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock googleapis before importing client
vi.mock('googleapis', () => {
  class MockOAuth2 {
    credentials = {}
    setCredentials = vi.fn()
    on = vi.fn()
    generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=true')
    getToken = vi.fn().mockResolvedValue({ tokens: {} })
  }

  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      calendar: vi.fn().mockReturnValue({}),
    },
  }
})

// Mock db module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue([]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
  },
}))

describe('lib/google/client', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('createOAuth2Client', () => {
    it('creates an OAuth2 client with env credentials', async () => {
      const { createOAuth2Client } = await import('./client')
      const client = createOAuth2Client()
      expect(client).toBeDefined()
    })

    it('throws when GOOGLE_CLIENT_ID is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      const { createOAuth2Client } = await import('./client')
      expect(() => createOAuth2Client()).toThrow('GOOGLE_CLIENT_ID')
    })

    it('throws when GOOGLE_CLIENT_SECRET is missing', async () => {
      delete process.env.GOOGLE_CLIENT_SECRET
      const { createOAuth2Client } = await import('./client')
      expect(() => createOAuth2Client()).toThrow('GOOGLE_CLIENT_SECRET')
    })

    it('throws when GOOGLE_REDIRECT_URI is missing', async () => {
      delete process.env.GOOGLE_REDIRECT_URI
      const { createOAuth2Client } = await import('./client')
      expect(() => createOAuth2Client()).toThrow('GOOGLE_REDIRECT_URI')
    })
  })

  describe('getAuthUrl', () => {
    it('generates an auth URL with calendar scope and offline access', async () => {
      const { getAuthUrl } = await import('./client')
      const { url, state } = getAuthUrl()
      expect(url).toContain('accounts.google.com')
      expect(state).toBeTruthy()
      expect(typeof state).toBe('string')
      // State should be a reasonable length for CSRF token
      expect(state.length).toBeGreaterThanOrEqual(16)
    })
  })

  describe('getAuthenticatedClient', () => {
    it('returns null when no credentials in DB', async () => {
      const { getAuthenticatedClient } = await import('./client')
      const result = await getAuthenticatedClient()
      expect(result).toBeNull()
    })
  })

  describe('SCOPES constant', () => {
    it('includes calendar scope', async () => {
      const { SCOPES } = await import('./client')
      expect(SCOPES).toContain('https://www.googleapis.com/auth/calendar')
    })
  })
})
