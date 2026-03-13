import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import * as relationsModule from './relations'

const DATABASE_URL = process.env.DATABASE_URL ?? '/app/data/db.sqlite'

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const globalForDb = globalThis as unknown as {
  _sqlite: Database.Database | undefined
}

const sqlite = globalForDb._sqlite ?? new Database(DATABASE_URL)

if (!globalForDb._sqlite) {
  // Apply required PRAGMAs on first connection only
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  globalForDb._sqlite = sqlite
}

export const db = drizzle(sqlite, {
  schema: {
    ...schema,
    ...relationsModule,
  },
})
export { sqlite }
