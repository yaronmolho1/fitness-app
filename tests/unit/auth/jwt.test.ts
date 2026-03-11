import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { decodeJwt } from 'jose'

describe('JWT issuance and verification', () => {
  beforeAll(() => {
    process.env.AUTH_USERNAME = 'testuser'
    process.env.AUTH_PASSWORD_HASH = '$2b$10$placeholder'
    process.env.JWT_SECRET = 'test-secret-for-jwt-tests'
    process.env.JWT_EXPIRES_IN = '7d'
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('issueToken', () => {
    it('returns a JWT string', async () => {
      const { issueToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')
      expect(typeof token).toBe('string')
      // JWTs have 3 dot-separated parts
      expect(token.split('.')).toHaveLength(3)
    })

    it('contains sub matching the username', async () => {
      const { issueToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')
      const payload = decodeJwt(token)
      expect(payload.sub).toBe('testuser')
    })

    it('contains iat and exp claims', async () => {
      const { issueToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')
      const payload = decodeJwt(token)
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })

    it('exp - iat matches configured expiry (7d)', async () => {
      const { issueToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')
      const payload = decodeJwt(token)
      const sevenDaysInSeconds = 7 * 24 * 60 * 60
      expect(payload.exp! - payload.iat!).toBe(sevenDaysInSeconds)
    })
  })

  describe('verifyToken', () => {
    it('returns payload for a valid token', async () => {
      const { issueToken, verifyToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')
      const payload = await verifyToken(token)
      expect(payload.sub).toBe('testuser')
      expect(payload.iat).toBeDefined()
      expect(payload.exp).toBeDefined()
    })

    it('rejects an expired token', async () => {
      // Issue a token with very short expiry
      process.env.JWT_EXPIRES_IN = '0s'
      const { issueToken, verifyToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')

      // Wait a tick so the token is expired
      await new Promise((resolve) => setTimeout(resolve, 1100))

      await expect(verifyToken(token)).rejects.toThrow()

      // Restore
      process.env.JWT_EXPIRES_IN = '7d'
    })

    it('rejects a tampered token', async () => {
      const { issueToken, verifyToken } = await import('../../../lib/auth/jwt')
      const token = await issueToken('testuser')

      // Tamper with the payload (middle segment)
      const parts = token.split('.')
      parts[1] = parts[1] + 'tampered'
      const tampered = parts.join('.')

      await expect(verifyToken(tampered)).rejects.toThrow()
    })
  })
})
