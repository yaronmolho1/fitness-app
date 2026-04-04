// T208: Verify sync hook in delete-actions (batch delete events)
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

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

const mockCollectEventIds = vi.fn().mockResolvedValue([])
const mockDeleteEventsByIds = vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0, failed: 0, errors: [] })
vi.mock('@/lib/google/sync', () => ({
  collectEventIdsForMesocycle: (...args: unknown[]) => mockCollectEventIds(...args),
  deleteEventsByIds: (...args: unknown[]) => mockDeleteEventsByIds(...args),
}))

import { deleteMesocycle } from './delete-actions'

function createAllTables() {
  testDb.run(sql`CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
    notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL, section_name TEXT NOT NULL, "order" INTEGER NOT NULL,
    run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL,
    section_id INTEGER, sets INTEGER NOT NULL, reps TEXT NOT NULL,
    weight REAL, rpe REAL, rest_seconds INTEGER, duration INTEGER,
    group_id INTEGER, group_rest_seconds INTEGER, guidelines TEXT,
    "order" INTEGER NOT NULL, is_main INTEGER NOT NULL DEFAULT 0, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER, week_type TEXT NOT NULL DEFAULT 'normal',
    period TEXT NOT NULL DEFAULT 'morning',
    time_slot TEXT NOT NULL DEFAULT '07:00',
    duration INTEGER NOT NULL DEFAULT 90,
    cycle_length INTEGER NOT NULL DEFAULT 1,
    cycle_position INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE routine_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT,
    has_weight INTEGER NOT NULL DEFAULT 0,
    has_length INTEGER NOT NULL DEFAULT 0,
    has_duration INTEGER NOT NULL DEFAULT 0,
    has_sets INTEGER NOT NULL DEFAULT 0,
    has_reps INTEGER NOT NULL DEFAULT 0,
    frequency_target INTEGER NOT NULL,
    scope TEXT NOT NULL,
    mesocycle_id INTEGER REFERENCES mesocycles(id),
    start_date TEXT, end_date TEXT,
    skip_on_deload INTEGER NOT NULL DEFAULT 0,
    frequency_mode TEXT NOT NULL DEFAULT 'weekly_target',
    frequency_days TEXT, created_at INTEGER
  )`)
}

function dropAllTables() {
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
}

function insertMeso(
  overrides: Partial<{ name: string; status: string }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'planned',
      ...overrides,
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

beforeEach(() => {
  vi.clearAllMocks()
  dropAllTables()
  createAllTables()
})

describe('deleteMesocycle — sync hooks (T208)', () => {
  it('AC17: calls deleteEventsByIds after successful delete', async () => {
    mockCollectEventIds.mockResolvedValueOnce(['gcal-1', 'gcal-2'])
    const { id } = insertMeso()
    const result = await deleteMesocycle(id)
    expect(result).toEqual({ success: true })
    expect(mockCollectEventIds).toHaveBeenCalledWith(id)
    expect(mockDeleteEventsByIds).toHaveBeenCalledWith(['gcal-1', 'gcal-2'])
  })

  it('AC19: sync failure does not affect delete result', async () => {
    mockDeleteEventsByIds.mockRejectedValueOnce(new Error('API failed'))
    const { id } = insertMeso()
    const result = await deleteMesocycle(id)
    expect(result).toEqual({ success: true })
  })

  it('does NOT call deleteEventsByIds when delete fails (active)', async () => {
    const { id } = insertMeso({ status: 'active' })
    await deleteMesocycle(id)
    expect(mockDeleteEventsByIds).not.toHaveBeenCalled()
  })

  it('does NOT call deleteEventsByIds when meso not found', async () => {
    await deleteMesocycle(999)
    expect(mockDeleteEventsByIds).not.toHaveBeenCalled()
  })

  it('does NOT call deleteEventsByIds on invalid ID', async () => {
    await deleteMesocycle(-1)
    expect(mockDeleteEventsByIds).not.toHaveBeenCalled()
  })
})
