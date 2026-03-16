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

import { getStreak } from './queries'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS routine_logs`)
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)

  testDb.run(sql`
    CREATE TABLE routine_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      has_weight INTEGER NOT NULL DEFAULT 0,
      has_length INTEGER NOT NULL DEFAULT 0,
      has_duration INTEGER NOT NULL DEFAULT 0,
      has_sets INTEGER NOT NULL DEFAULT 0,
      has_reps INTEGER NOT NULL DEFAULT 0,
      frequency_target INTEGER NOT NULL,
      scope TEXT NOT NULL,
      mesocycle_id INTEGER,
      start_date TEXT,
      end_date TEXT,
      skip_on_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)

  testDb.run(sql`
    CREATE TABLE routine_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_item_id INTEGER NOT NULL REFERENCES routine_items(id),
      log_date TEXT NOT NULL,
      status TEXT NOT NULL,
      value_weight REAL,
      value_length REAL,
      value_duration REAL,
      value_sets INTEGER,
      value_reps INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX routine_logs_item_date_idx ON routine_logs(routine_item_id, log_date)`
  )
}

function seedItem(name = 'Body Weight'): { id: number } {
  return testDb
    .insert(schema.routine_items)
    .values({
      name,
      frequency_target: 5,
      scope: 'global',
      has_weight: true,
    })
    .returning({ id: schema.routine_items.id })
    .get()
}

function seedLog(
  routineItemId: number,
  logDate: string,
  status: 'done' | 'skipped' = 'done'
) {
  testDb
    .insert(schema.routine_logs)
    .values({
      routine_item_id: routineItemId,
      log_date: logDate,
      status,
      value_weight: status === 'done' ? 72.5 : null,
    })
    .run()
}

describe('getStreak', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns 0 when no logs exist', async () => {
    const item = seedItem()
    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(0)
  })

  it('returns 1 when done today only', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-16', 'done')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(1)
  })

  it('counts consecutive done days ending on today', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-14', 'done')
    seedLog(item.id, '2026-03-15', 'done')
    seedLog(item.id, '2026-03-16', 'done')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(3)
  })

  it('breaks streak on skipped day', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-14', 'done')
    seedLog(item.id, '2026-03-15', 'skipped')
    seedLog(item.id, '2026-03-16', 'done')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(1)
  })

  it('breaks streak on missing day', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-13', 'done')
    // missing 2026-03-14
    seedLog(item.id, '2026-03-15', 'done')
    seedLog(item.id, '2026-03-16', 'done')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(2)
  })

  it('anchors to yesterday when today has no log', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-14', 'done')
    seedLog(item.id, '2026-03-15', 'done')
    // no log for today (2026-03-16)

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(2)
  })

  it('returns 1 when only yesterday is done and today has no log', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-15', 'done')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(1)
  })

  it('returns 0 when neither today nor yesterday done', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-13', 'done')
    // no log for 14, 15, 16

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(0)
  })

  it('returns 0 when yesterday was skipped even with prior done days', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-13', 'done')
    seedLog(item.id, '2026-03-14', 'done')
    seedLog(item.id, '2026-03-15', 'skipped')
    // no log for today

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(0)
  })

  it('counts streak across week boundary', async () => {
    const item = seedItem()
    // 2026-03-15 is Sunday, 2026-03-16 is Monday
    seedLog(item.id, '2026-03-14', 'done') // Saturday
    seedLog(item.id, '2026-03-15', 'done') // Sunday
    seedLog(item.id, '2026-03-16', 'done') // Monday

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(3)
  })

  it('only counts logs for the specified item', async () => {
    const item1 = seedItem('Body Weight')
    const item2 = seedItem('Stretch')
    seedLog(item1.id, '2026-03-15', 'done')
    seedLog(item1.id, '2026-03-16', 'done')
    seedLog(item2.id, '2026-03-14', 'done')
    seedLog(item2.id, '2026-03-15', 'done')
    seedLog(item2.id, '2026-03-16', 'done')

    const streak1 = await getStreak(item1.id, '2026-03-16')
    const streak2 = await getStreak(item2.id, '2026-03-16')
    expect(streak1).toBe(2)
    expect(streak2).toBe(3)
  })

  it('counts partial-fill log as done when status is done', async () => {
    const item = seedItem()
    // Insert log with status='done' but only weight filled (no reps)
    testDb
      .insert(schema.routine_logs)
      .values({
        routine_item_id: item.id,
        log_date: '2026-03-15',
        status: 'done',
        value_weight: 72.5,
        value_reps: null,
      })
      .run()
    testDb
      .insert(schema.routine_logs)
      .values({
        routine_item_id: item.id,
        log_date: '2026-03-16',
        status: 'done',
        value_weight: null,
        value_reps: null,
      })
      .run()

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(2)
  })

  // Integration: done 3 days in a row
  it('integration: 3 consecutive done days = streak 3', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-14', 'done')
    seedLog(item.id, '2026-03-15', 'done')
    seedLog(item.id, '2026-03-16', 'done')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(3)
  })

  // Integration: done then skip
  it('integration: done then skip resets streak to 0', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-14', 'done')
    seedLog(item.id, '2026-03-15', 'done')
    seedLog(item.id, '2026-03-16', 'skipped')

    const streak = await getStreak(item.id, '2026-03-16')
    expect(streak).toBe(0)
  })
})
