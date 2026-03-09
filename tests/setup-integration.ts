import Database from 'better-sqlite3'
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'

process.env.JWT_SECRET = 'test-secret-key-for-integration-testing-only'
process.env.AUTH_USERNAME = 'testuser'
process.env.AUTH_PASSWORD_HASH = '$2b$10$placeholder'
process.env.JWT_EXPIRES_IN = '7d'
process.env.DATABASE_URL = ':memory:'

let db: Database.Database

beforeAll(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
})

afterAll(() => {
  db.close()
})

beforeEach(() => {
  db.exec('SAVEPOINT test_savepoint')
})

afterEach(() => {
  db.exec('ROLLBACK TO SAVEPOINT test_savepoint')
})
