import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

const TEST_SECRET = 'test-secret-key-for-unit-testing-only'
const BASE_URL = 'http://localhost:3000'

async function createToken(options?: { expired?: boolean }): Promise<string> {
  const secret = new TextEncoder().encode(TEST_SECRET)
  const jwt = new SignJWT({ sub: 'testuser' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()

  if (options?.expired) {
    // Set expiration 1 second in the past
    jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 1)
  } else {
    jwt.setExpirationTime('7d')
  }

  return jwt.sign(secret)
}

function createRequest(path: string, token?: string): NextRequest {
  const url = new URL(path, BASE_URL)
  const req = new NextRequest(url)
  if (token) {
    req.cookies.set('auth-token', token)
  }
  return req
}

function isRedirectTo(response: Response, path: string): boolean {
  if (response.status < 300 || response.status >= 400) return false
  const location = response.headers.get('location')
  if (!location) return false
  return new URL(location).pathname === path
}

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET
})

describe('Auth middleware', () => {
  describe('protected routes', () => {
    it('redirects to /login without a cookie', async () => {
      const { middleware } = await import('../../../middleware')
      const req = createRequest('/mesocycles')
      const res = await middleware(req)
      expect(isRedirectTo(res, '/login')).toBe(true)
    })

    it('passes through with a valid JWT cookie', async () => {
      const { middleware } = await import('../../../middleware')
      const token = await createToken()
      const req = createRequest('/mesocycles', token)
      const res = await middleware(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('redirects to /login with an expired JWT', async () => {
      const { middleware } = await import('../../../middleware')
      const token = await createToken({ expired: true })
      const req = createRequest('/mesocycles', token)
      const res = await middleware(req)
      expect(isRedirectTo(res, '/login')).toBe(true)
    })

    it('redirects to /login with a tampered JWT', async () => {
      const { middleware } = await import('../../../middleware')
      const token = await createToken()
      const tampered = token + 'tampered'
      const req = createRequest('/mesocycles', tampered)
      const res = await middleware(req)
      expect(isRedirectTo(res, '/login')).toBe(true)
    })
  })

  describe('public routes', () => {
    it('/login passes through without a cookie', async () => {
      const { middleware } = await import('../../../middleware')
      const req = createRequest('/login')
      const res = await middleware(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    })

    it('/login redirects authenticated user to /', async () => {
      const { middleware } = await import('../../../middleware')
      const token = await createToken()
      const req = createRequest('/login', token)
      const res = await middleware(req)
      expect(isRedirectTo(res, '/')).toBe(true)
    })

    it('/api/health passes through regardless of auth', async () => {
      const { middleware } = await import('../../../middleware')
      const req = createRequest('/api/health')
      const res = await middleware(req)
      expect(res.status).toBe(200)
    })

    it('/api/auth/login passes through regardless of auth', async () => {
      const { middleware } = await import('../../../middleware')
      const req = createRequest('/api/auth/login')
      const res = await middleware(req)
      expect(res.status).toBe(200)
    })
  })
})
