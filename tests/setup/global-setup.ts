export default async function globalSetup() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-e2e-testing-only'
  process.env.AUTH_USERNAME = process.env.AUTH_USERNAME || 'testuser'
  process.env.AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH || '$2b$10$placeholder'
  process.env.DATABASE_URL = process.env.DATABASE_URL || ':memory:'
}
