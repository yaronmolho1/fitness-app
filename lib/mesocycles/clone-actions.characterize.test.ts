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

import { cloneMesocycle } from './clone-actions'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)

  testDb.run(sql`CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT, equipment TEXT, created_at INTEGER
  )`)
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
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
    rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
    guidelines TEXT, "order" INTEGER NOT NULL, is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER REFERENCES workout_templates(id),
    week_type TEXT NOT NULL DEFAULT 'normal',
    period TEXT NOT NULL DEFAULT 'morning',
    time_slot TEXT NOT NULL DEFAULT '07:00',
    duration INTEGER NOT NULL DEFAULT 90,
    cycle_length INTEGER NOT NULL DEFAULT 1,
    cycle_position INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER
  )`)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
  )
}

function seedSource() {
  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Source Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'active',
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  const tmpl = testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: meso.id,
      name: 'Push A',
      canonical_name: 'push-a',
      modality: 'resistance',
    })
    .returning({ id: schema.workout_templates.id })
    .get()

  testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      week_type: 'normal',
      period: 'morning',
      time_slot: '07:00',
      duration: 90,
    })
    .run()

  return { mesoId: meso.id, tmplId: tmpl.id }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetTables()
})

describe('cloneMesocycle — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true, id: number }', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.id).toBe('number')
        expect(result.id).toBeGreaterThan(mesoId)
        expect(Object.keys(result).sort()).toEqual(['id', 'success'])
      }
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error: string } for empty name', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: '   ',
        start_date: '2026-04-01',
      })
      expect(result).toEqual({ success: false, error: 'Name is required' })
    })

    it('returns { success: false, error: string } for invalid date', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: 'not-a-date',
      })
      expect(result).toEqual({
        success: false,
        error: 'Valid start date (YYYY-MM-DD) is required',
      })
    })

    it('returns { success: false, error: string } for non-existent source', async () => {
      const result = await cloneMesocycle({
        source_id: 999,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(result).toEqual({ success: false, error: 'Source mesocycle not found' })
    })

    it('returns { success: false, error: string } for source with no templates', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Empty',
          start_date: '2026-03-01',
          end_date: '2026-03-28',
          work_weeks: 4,
          has_deload: false,
          status: 'planned',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(result).toEqual({
        success: false,
        error: 'Cannot clone a mesocycle with no templates',
      })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath("/mesocycles") on success', async () => {
      const { mesoId } = seedSource()
      await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath on validation failure', async () => {
      await cloneMesocycle({
        source_id: 999,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('cloned mesocycle properties', () => {
    it('creates mesocycle with status "planned" regardless of source status', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('setup failed')

      const cloned = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === result.id)
      expect(cloned!.status).toBe('planned')
    })

    it('uses provided work_weeks override', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
        work_weeks: 6,
      })
      if (!result.success) throw new Error('setup failed')

      const cloned = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === result.id)
      expect(cloned!.work_weeks).toBe(6)
    })

    it('clones schedule rows with remapped template IDs', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('setup failed')

      const schedRows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(schedRows).toHaveLength(1)
      // Template ID should be different from source
      const sourceSched = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === mesoId)
      expect(schedRows[0].template_id).not.toBe(sourceSched[0].template_id)
    })
  })

  describe('no external side effects', () => {
    it('does not modify source mesocycle', async () => {
      const { mesoId } = seedSource()
      const sourceBefore = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === mesoId)

      await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      const sourceAfter = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === mesoId)
      expect(sourceAfter).toEqual(sourceBefore)
    })
  })
})
