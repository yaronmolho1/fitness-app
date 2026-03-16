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

import { getWeeklyCompletionCount } from './queries'

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

describe('getWeeklyCompletionCount', () => {
  beforeEach(() => {
    createTables()
  })

  // 2026-03-16 is a Monday. Week = Mon Mar 16 - Sun Mar 22
  it('counts done logs in current Mon-Sun week', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-16', 'done') // Monday
    seedLog(item.id, '2026-03-17', 'done') // Tuesday
    seedLog(item.id, '2026-03-18', 'done') // Wednesday

    const count = await getWeeklyCompletionCount(item.id, '2026-03-18')
    expect(count).toBe(3)
  })

  it('excludes skipped logs', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-16', 'done')
    seedLog(item.id, '2026-03-17', 'skipped')
    seedLog(item.id, '2026-03-18', 'done')

    const count = await getWeeklyCompletionCount(item.id, '2026-03-18')
    expect(count).toBe(2)
  })

  it('returns 0 when no logs exist', async () => {
    const item = seedItem()
    const count = await getWeeklyCompletionCount(item.id, '2026-03-18')
    expect(count).toBe(0)
  })

  it('excludes logs from previous week', async () => {
    const item = seedItem()
    // Previous week (Mon Mar 9 - Sun Mar 15)
    seedLog(item.id, '2026-03-13', 'done') // Friday prev week
    seedLog(item.id, '2026-03-15', 'done') // Sunday prev week
    // Current week (Mon Mar 16 - Sun Mar 22)
    seedLog(item.id, '2026-03-16', 'done') // Monday current week

    const count = await getWeeklyCompletionCount(item.id, '2026-03-16')
    expect(count).toBe(1)
  })

  it('excludes logs from next week', async () => {
    const item = seedItem()
    seedLog(item.id, '2026-03-16', 'done') // Monday current
    seedLog(item.id, '2026-03-23', 'done') // Monday next week

    const count = await getWeeklyCompletionCount(item.id, '2026-03-22') // Sunday
    expect(count).toBe(1)
  })

  it('counts up to 7 for daily target', async () => {
    const item = seedItem()
    for (let d = 16; d <= 22; d++) {
      seedLog(item.id, `2026-03-${d}`, 'done')
    }
    const count = await getWeeklyCompletionCount(item.id, '2026-03-22')
    expect(count).toBe(7)
  })

  // When date is a Sunday, week starts at previous Monday
  it('handles Sunday as last day of week', async () => {
    const item = seedItem()
    // 2026-03-22 is a Sunday. Week = Mon Mar 16 - Sun Mar 22
    seedLog(item.id, '2026-03-16', 'done')
    seedLog(item.id, '2026-03-22', 'done')

    const count = await getWeeklyCompletionCount(item.id, '2026-03-22')
    expect(count).toBe(2)
  })

  it('only counts logs for the specified item', async () => {
    const item1 = seedItem('Body Weight')
    const item2 = seedItem('Stretch')
    seedLog(item1.id, '2026-03-16', 'done')
    seedLog(item2.id, '2026-03-16', 'done')
    seedLog(item2.id, '2026-03-17', 'done')

    const count = await getWeeklyCompletionCount(item1.id, '2026-03-18')
    expect(count).toBe(1)
  })
})
