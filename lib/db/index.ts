import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const DATABASE_URL = process.env.DATABASE_URL ?? '/app/data/db.sqlite'

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const sqlite = new Database(DATABASE_URL)

// Apply required PRAGMAs on every connection
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite)
export { sqlite }
