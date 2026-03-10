import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import bcrypt from 'bcrypt'

describe('validateCredentials', () => {
  let validHash: string

  beforeAll(async () => {
    // Generate a real bcrypt hash for 'testpassword'
    validHash = await bcrypt.hash('testpassword', 10)
    process.env.AUTH_PASSWORD_HASH = validHash
    process.env.AUTH_USERNAME = 'testuser'
    process.env.JWT_SECRET = 'test-secret'
    process.env.JWT_EXPIRES_IN = '7d'
  })

  afterEach(() => {
    // Clear the module cache to reset lazy-loaded config between tests
    vi.resetModules()
  })

  it('returns true for correct username and password', async () => {
    // Dynamic import to pick up updated env vars
    const { validateCredentials } = await import('../../../lib/auth/config')
    const result = await validateCredentials('testuser', 'testpassword')
    expect(result).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const { validateCredentials } = await import('../../../lib/auth/config')
    const result = await validateCredentials('testuser', 'wrongpassword')
    expect(result).toBe(false)
  })

  it('returns false for wrong username', async () => {
    const { validateCredentials } = await import('../../../lib/auth/config')
    const result = await validateCredentials('wronguser', 'testpassword')
    expect(result).toBe(false)
  })

  it('returns false for both wrong', async () => {
    const { validateCredentials } = await import('../../../lib/auth/config')
    const result = await validateCredentials('wronguser', 'wrongpassword')
    expect(result).toBe(false)
  })

  it('throws error when AUTH_USERNAME is missing', async () => {
    delete process.env.AUTH_USERNAME
    const { validateCredentials } = await import('../../../lib/auth/config')
    await expect(validateCredentials('user', 'pass')).rejects.toThrow(
      'AUTH_USERNAME environment variable is required'
    )
  })

  it('throws error when AUTH_PASSWORD_HASH is missing', async () => {
    process.env.AUTH_USERNAME = 'testuser'
    delete process.env.AUTH_PASSWORD_HASH
    const { validateCredentials } = await import('../../../lib/auth/config')
    await expect(validateCredentials('user', 'pass')).rejects.toThrow(
      'AUTH_PASSWORD_HASH environment variable is required'
    )
  })

  it('throws error when JWT_SECRET is missing', async () => {
    process.env.AUTH_USERNAME = 'testuser'
    process.env.AUTH_PASSWORD_HASH = validHash
    delete process.env.JWT_SECRET
    const { validateCredentials } = await import('../../../lib/auth/config')
    await expect(validateCredentials('user', 'pass')).rejects.toThrow(
      'JWT_SECRET environment variable is required'
    )
  })
})
