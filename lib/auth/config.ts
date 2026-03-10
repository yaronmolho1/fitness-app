import bcrypt from 'bcrypt'

/**
 * Lazy-loaded auth configuration.
 * Validates required env vars on first access, not at module load.
 * This allows tests to set env vars before importing this module.
 */
let cachedConfig: {
  username: string
  passwordHash: string
  jwtSecret: string
  jwtExpiresIn: string
} | null = null

function getAuthConfig() {
  if (cachedConfig) {
    return cachedConfig
  }

  const AUTH_USERNAME = process.env.AUTH_USERNAME
  const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH
  const JWT_SECRET = process.env.JWT_SECRET
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d'

  if (!AUTH_USERNAME) {
    throw new Error('AUTH_USERNAME environment variable is required')
  }
  if (!AUTH_PASSWORD_HASH) {
    throw new Error('AUTH_PASSWORD_HASH environment variable is required')
  }
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }

  cachedConfig = {
    username: AUTH_USERNAME,
    passwordHash: AUTH_PASSWORD_HASH,
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: JWT_EXPIRES_IN,
  }

  return cachedConfig
}

export const authConfig = {
  get username() {
    return getAuthConfig().username
  },
  get passwordHash() {
    return getAuthConfig().passwordHash
  },
  get jwtSecret() {
    return getAuthConfig().jwtSecret
  },
  get jwtExpiresIn() {
    return getAuthConfig().jwtExpiresIn
  },
} as const

/**
 * Validates credentials using timing-safe bcrypt comparison.
 * Returns true only if username AND password match.
 * No early exit on username mismatch (timing-safe).
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const config = getAuthConfig()

  // Always perform bcrypt compare to prevent timing attacks
  // even if username doesn't match
  const passwordMatch = await bcrypt.compare(password, config.passwordHash)
  const usernameMatch = username === config.username

  return usernameMatch && passwordMatch
}
