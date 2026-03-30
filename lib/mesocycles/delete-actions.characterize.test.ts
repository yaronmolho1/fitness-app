// Characterization test — captures current behavior for safe refactoring (T208 sync hooks)
// Focuses on return shapes, revalidation timing, and absence of side effects beyond DB + cache
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

vi.mock('@/lib/google/sync', () => ({
  collectEventIdsForMesocycle: vi.fn().mockResolvedValue([]),
  deleteEventsByIds: vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0, failed: 0, errors: [] }),
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

describe('deleteMesocycle — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true } with no other fields', async () => {
      const { id } = insertMeso()
      const result = await deleteMesocycle(id)
      expect(result).toEqual({ success: true })
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error: string } for not found', async () => {
      const result = await deleteMesocycle(999)
      expect(result).toEqual({ success: false, error: 'Mesocycle not found' })
    })

    it('returns { success: false, error: string } for active mesocycle', async () => {
      const { id } = insertMeso({ status: 'active' })
      const result = await deleteMesocycle(id)
      expect(result).toEqual({
        success: false,
        error: 'Cannot delete an active mesocycle. Complete it first.',
      })
    })

    it('returns { success: false, error: string } for invalid ID', async () => {
      const result = await deleteMesocycle(-1)
      expect(result).toEqual({ success: false, error: 'Invalid mesocycle ID' })
    })

    it('returns { success: false, error: string } for non-integer ID', async () => {
      const result = await deleteMesocycle(1.5)
      expect(result).toEqual({ success: false, error: 'Invalid mesocycle ID' })
    })

    it('returns { success: false, error: string } for zero ID', async () => {
      const result = await deleteMesocycle(0)
      expect(result).toEqual({ success: false, error: 'Invalid mesocycle ID' })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath("/mesocycles") on successful delete', async () => {
      const { id } = insertMeso()
      await deleteMesocycle(id)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath for not found', async () => {
      await deleteMesocycle(999)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath for active mesocycle', async () => {
      const { id } = insertMeso({ status: 'active' })
      await deleteMesocycle(id)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath for invalid ID', async () => {
      await deleteMesocycle(-1)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('allowed statuses', () => {
    it('deletes planned mesocycle', async () => {
      const { id } = insertMeso({ status: 'planned' })
      const result = await deleteMesocycle(id)
      expect(result.success).toBe(true)
    })

    it('deletes completed mesocycle', async () => {
      const { id } = insertMeso({ status: 'completed' })
      const result = await deleteMesocycle(id)
      expect(result.success).toBe(true)
    })

    it('blocks active mesocycle', async () => {
      const { id } = insertMeso({ status: 'active' })
      const result = await deleteMesocycle(id)
      expect(result.success).toBe(false)
    })
  })

  describe('routine item promotion', () => {
    it('promotes mesocycle-scoped routine items to global before delete', async () => {
      const { id } = insertMeso()
      testDb
        .insert(schema.routine_items)
        .values({
          name: 'Stretching',
          frequency_target: 3,
          scope: 'mesocycle',
          mesocycle_id: id,
          frequency_mode: 'weekly_target',
        })
        .run()

      await deleteMesocycle(id)

      const items = testDb.select().from(schema.routine_items).all()
      expect(items).toHaveLength(1)
      expect(items[0].scope).toBe('global')
      expect(items[0].mesocycle_id).toBeNull()
    })
  })

  describe('no external side effects', () => {
    it('does not affect other mesocycles', async () => {
      const { id: id1 } = insertMeso({ name: 'Delete' })
      const { id: id2 } = insertMeso({ name: 'Keep' })
      await deleteMesocycle(id1)
      const remaining = testDb.select().from(schema.mesocycles).all()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(id2)
    })
  })
})
