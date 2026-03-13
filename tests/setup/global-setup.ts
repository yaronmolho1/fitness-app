import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { E2E_DB_PATH, E2E_AUTH } from '../e2e/e2e-config'

export default async function globalSetup() {
  // Clean previous test DB
  for (const suffix of ['', '-wal', '-shm']) {
    const file = E2E_DB_PATH + suffix
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }

  process.env.DATABASE_URL = E2E_DB_PATH
  process.env.JWT_SECRET = E2E_AUTH.jwtSecret
  process.env.AUTH_USERNAME = E2E_AUTH.username
  process.env.AUTH_PASSWORD_HASH = E2E_AUTH.passwordHash

  // Run migrations to create tables
  execSync('pnpm db:migrate', {
    cwd: path.join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: E2E_DB_PATH },
    stdio: 'pipe',
  })
}
