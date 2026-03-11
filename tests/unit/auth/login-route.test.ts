import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import bcrypt from 'bcrypt'

function parseCookie(setCookieHeader: string) {
  const parts = setCookieHeader.split(';').map((p) => p.trim())
  const [nameValue, ...attrs] = parts
  const [name, value] = nameValue.split('=', 2)
  const attributes: Record<string, string | boolean> = {}
  for (const attr of attrs) {
    const [key, val] = attr.split('=', 2)
    attributes[key.toLowerCase()] = val ?? true
  }
  return { name, value, attributes }
}

describe('Login route', () => {
  let validHash: string

  beforeAll(async () => {
    validHash = await bcrypt.hash('testpass', 10)
    process.env.AUTH_USERNAME = 'testuser'
    process.env.AUTH_PASSWORD_HASH = validHash
    process.env.JWT_SECRET = 'test-secret-for-jwt-tests'
    process.env.JWT_EXPIRES_IN = '7d'
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('returns 200 and sets auth-token cookie on valid credentials', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const cookies = res.headers.getSetCookie()
    expect(cookies.length).toBeGreaterThanOrEqual(1)
    const authCookie = cookies.find((c) => c.startsWith('auth-token='))
    expect(authCookie).toBeDefined()
  })

  it('sets cookie with httpOnly, secure, sameSite=lax attributes', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const cookies = res.headers.getSetCookie()
    const authCookie = cookies.find((c) => c.startsWith('auth-token='))!
    const parsed = parseCookie(authCookie)

    expect(parsed.attributes['httponly']).toBe(true)
    expect(parsed.attributes['secure']).toBe(true)
    expect(parsed.attributes['samesite'].toString().toLowerCase()).toBe('lax')
  })

  it('sets cookie maxAge matching JWT_EXPIRES_IN (7d = 604800)', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const cookies = res.headers.getSetCookie()
    const authCookie = cookies.find((c) => c.startsWith('auth-token='))!
    const parsed = parseCookie(authCookie)

    expect(parsed.attributes['max-age']).toBe('604800')
  })

  it('returns 401 with generic error on wrong password', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testuser', password: 'wrongpass' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('Invalid credentials')

    const cookies = res.headers.getSetCookie()
    const authCookie = cookies.find((c) => c.startsWith('auth-token='))
    expect(authCookie).toBeUndefined()
  })

  it('returns 401 with generic error on wrong username', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'wronguser', password: 'testpass' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('Invalid credentials')
  })

  it('returns 400 on missing body fields', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 on empty username/password', async () => {
    const { POST } = await import('../../../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: '', password: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('Logout route', () => {
  beforeAll(() => {
    process.env.AUTH_USERNAME = 'testuser'
    process.env.AUTH_PASSWORD_HASH = '$2b$10$placeholder'
    process.env.JWT_SECRET = 'test-secret-for-jwt-tests'
    process.env.JWT_EXPIRES_IN = '7d'
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('clears the auth-token cookie', async () => {
    const { POST } = await import('../../../app/api/auth/logout/route')
    const req = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const cookies = res.headers.getSetCookie()
    const authCookie = cookies.find((c) => c.startsWith('auth-token='))
    expect(authCookie).toBeDefined()

    const parsed = parseCookie(authCookie!)
    // Cookie should be cleared via maxAge=0 or value empty
    expect(
      parsed.attributes['max-age'] === '0' || parsed.value === ''
    ).toBe(true)
  })
})
