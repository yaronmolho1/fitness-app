import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const TEST_DB_PATH = path.join(__dirname, '../../.e2e-test.db')

export default async function globalSetup() {
  // Clean previous test DB
  for (const suffix of ['', '-wal', '-shm']) {
    const file = TEST_DB_PATH + suffix
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }

  process.env.DATABASE_URL = TEST_DB_PATH
  process.env.JWT_SECRET = 'test-secret-key-for-e2e-testing-only'
  process.env.AUTH_USERNAME = 'testuser'
  process.env.AUTH_PASSWORD_HASH =
    '$2b$10$z0rEew3QLGyjSs0gSDRqouN4FBccLYDU8slZn96SMY4bMKgJXbBz2'

  // Run migrations to create tables
  execSync('pnpm db:migrate', {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: TEST_DB_PATH },
    stdio: 'pipe',
  })
}
