import '@testing-library/jest-dom/vitest'

process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-only'
process.env.AUTH_USERNAME = 'testuser'
process.env.AUTH_PASSWORD_HASH = '$2b$10$placeholder'
process.env.JWT_EXPIRES_IN = '7d'
process.env.DATABASE_URL = ':memory:'
