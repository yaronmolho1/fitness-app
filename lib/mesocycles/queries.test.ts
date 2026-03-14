import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return { testDb: drizzle(sqlite) }
})

vi.mock('@/lib/db/index', () => ({
  db: testDb,
}))

import { getMesocycles, getMesocycleById } from './queries'

const CREATE_TABLE = sql`
  CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  )
`

function insertMeso(overrides: Partial<{
  name: string
  start_date: string
  end_date: string
  work_weeks: number
  has_deload: boolean
  status: string
}> = {}) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: overrides.name ?? 'Test Meso',
      start_date: overrides.start_date ?? '2026-03-01',
      end_date: overrides.end_date ?? '2026-03-28',
      work_weeks: overrides.work_weeks ?? 4,
      has_deload: overrides.has_deload ?? false,
      status: overrides.status ?? 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

describe('getMesocycles', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(CREATE_TABLE)
  })

  it('returns empty array when no mesocycles exist', async () => {
    const result = await getMesocycles()
    expect(result).toEqual([])
  })

  it('returns all mesocycles', async () => {
    insertMeso({ name: 'First' })
    insertMeso({ name: 'Second' })

    const result = await getMesocycles()
    expect(result).toHaveLength(2)
  })

  it('returns mesocycles with all expected fields', async () => {
    insertMeso({
      name: 'Hypertrophy Block',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: true,
      status: 'active',
    })

    const result = await getMesocycles()
    expect(result[0]).toMatchObject({
      id: expect.any(Number),
      name: 'Hypertrophy Block',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: true,
      status: 'active',
    })
  })

  it('orders mesocycles by most recent first', async () => {
    insertMeso({ name: 'First', start_date: '2026-01-01' })
    insertMeso({ name: 'Second', start_date: '2026-06-01' })

    const result = await getMesocycles()
    // Most recently created (higher id) first
    expect(result[0].name).toBe('Second')
    expect(result[1].name).toBe('First')
  })
})

describe('getMesocycleById', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(CREATE_TABLE)
  })

  it('returns the mesocycle when it exists', async () => {
    const { id } = insertMeso({ name: 'Target Meso' })

    const result = await getMesocycleById(id)
    expect(result).toBeDefined()
    expect(result?.name).toBe('Target Meso')
  })

  it('returns undefined when mesocycle does not exist', async () => {
    const result = await getMesocycleById(999)
    expect(result).toBeUndefined()
  })

  it('returns all fields for the mesocycle', async () => {
    const { id } = insertMeso({
      name: 'Detail Test',
      start_date: '2026-04-01',
      end_date: '2026-05-06',
      work_weeks: 5,
      has_deload: true,
      status: 'planned',
    })

    const result = await getMesocycleById(id)
    expect(result).toMatchObject({
      id,
      name: 'Detail Test',
      start_date: '2026-04-01',
      end_date: '2026-05-06',
      work_weeks: 5,
      has_deload: true,
      status: 'planned',
    })
  })
})
