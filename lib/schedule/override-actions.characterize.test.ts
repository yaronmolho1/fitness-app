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

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { moveWorkout, undoScheduleMove, resetWeekSchedule } from './override-actions'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS schedule_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`
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
  `)
  testDb.run(sql`
    CREATE TABLE workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
      notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
      interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
      target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER, estimated_duration INTEGER, display_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE weekly_schedule (
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
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
  )
  testDb.run(sql`
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      override_group TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id)`
  )
  testDb.run(sql`
    CREATE TABLE logged_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      canonical_name TEXT,
      log_date TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      rating INTEGER, notes TEXT,
      template_snapshot TEXT NOT NULL,
      created_at INTEGER
    )
  `)
}

function seedMesocycle(
  overrides: Partial<{
    name: string; status: string; has_deload: number; work_weeks: number; start_date: string
  }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-02',
      end_date: '2026-03-29',
      work_weeks: 4,
      has_deload: 0,
      status: 'active',
      ...overrides,
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(mesocycleId: number, name = 'Push A') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedSchedule(
  mesocycleId: number,
  dayOfWeek: number,
  templateId: number,
  timeSlot = '07:00',
  duration = 90
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesocycleId,
      day_of_week: dayOfWeek,
      template_id: templateId,
      week_type: 'normal',
      period: 'morning',
      time_slot: timeSlot,
      duration,
      created_at: new Date(),
    })
    .returning()
    .get()
}

beforeEach(() => {
  vi.clearAllMocks()
  createTables()
})

describe('moveWorkout — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true, override_group: string }', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.override_group).toBe('string')
        expect(result.override_group).toMatch(/^move-/)
        // No other keys
        expect(Object.keys(result).sort()).toEqual(['override_group', 'success'])
      }
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error: string }', async () => {
      const result = await moveWorkout({
        mesocycle_id: 999,
        week_number: 1,
        schedule_id: 1,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(typeof result.error).toBe('string')
        expect(Object.keys(result).sort()).toEqual(['error', 'success'])
      }
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath("/mesocycles", "layout") on success', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath on failure', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath on validation failure', async () => {
      await moveWorkout({
        mesocycle_id: 1,
        week_number: 1,
        schedule_id: 1,
        target_day: 7, // invalid
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('no external side effects', () => {
    it('only creates schedule_week_overrides rows (no other tables modified)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      const mesosBefore = testDb.select().from(schema.mesocycles).all()
      const tmplsBefore = testDb.select().from(schema.workout_templates).all()
      const schedBefore = testDb.select().from(schema.weekly_schedule).all()

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(testDb.select().from(schema.mesocycles).all()).toEqual(mesosBefore)
      expect(testDb.select().from(schema.workout_templates).all()).toEqual(tmplsBefore)
      expect(testDb.select().from(schema.weekly_schedule).all()).toEqual(schedBefore)
    })
  })

  describe('cross-week move (target_week_offset)', () => {
    it('defaults target_week_offset to 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      const overrides = testDb.select().from(schema.schedule_week_overrides).all()
      // Both source and target in same week
      expect(overrides.every((o: { week_number: number }) => o.week_number === 2)).toBe(true)
    })

    it('target_week_offset=1 places target in next week', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
        target_week_offset: 1,
      })

      expect(result.success).toBe(true)
      const overrides = testDb.select().from(schema.schedule_week_overrides).all()
      const sourceOvr = overrides.find(
        (o: { template_id: number | null }) => o.template_id === null
      )
      const targetOvr = overrides.find(
        (o: { template_id: number | null }) => o.template_id !== null
      )
      expect(sourceOvr!.week_number).toBe(2)
      expect(targetOvr!.week_number).toBe(3)
    })
  })
})

describe('undoScheduleMove — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true, deleted: number }', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      const moveResult = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })
      if (!moveResult.success) throw new Error('setup failed')
      vi.clearAllMocks()

      const result = await undoScheduleMove(moveResult.override_group, meso.id)
      expect(result).toEqual({ success: true, deleted: 2 })
    })

    it('returns { success: true, deleted: 0 } for non-matching group', async () => {
      const meso = seedMesocycle()
      const result = await undoScheduleMove('nonexistent-group', meso.id)
      expect(result).toEqual({ success: true, deleted: 0 })
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error } for missing params', async () => {
      const result = await undoScheduleMove('', 1)
      expect(result).toEqual({ success: false, error: 'Missing override_group or mesocycle_id' })
    })

    it('returns { success: false, error } for mesocycleId=0', async () => {
      const result = await undoScheduleMove('some-group', 0)
      expect(result).toEqual({ success: false, error: 'Missing override_group or mesocycle_id' })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath inside transaction on success', async () => {
      const meso = seedMesocycle()
      await undoScheduleMove('any-group', meso.id)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath on early validation failure', async () => {
      await undoScheduleMove('', 0)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath when mesocycle is completed', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      await undoScheduleMove('some-group', meso.id)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })
})

describe('resetWeekSchedule — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true, deleted: number }', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const entry = seedSchedule(meso.id, 1, tmpl.id)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })
      vi.clearAllMocks()

      const result = await resetWeekSchedule(meso.id, 1)
      expect(result).toEqual({ success: true, deleted: 2 })
    })

    it('returns { success: true, deleted: 0 } when no overrides exist', async () => {
      const meso = seedMesocycle()
      const result = await resetWeekSchedule(meso.id, 1)
      expect(result).toEqual({ success: true, deleted: 0 })
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error } for missing params', async () => {
      const result = await resetWeekSchedule(0, 1)
      expect(result).toEqual({ success: false, error: 'Missing mesocycle_id or week_number' })
    })

    it('returns { success: false, error } for weekNumber=0', async () => {
      const result = await resetWeekSchedule(1, 0)
      expect(result).toEqual({ success: false, error: 'Missing mesocycle_id or week_number' })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath inside transaction on success', async () => {
      const meso = seedMesocycle()
      await resetWeekSchedule(meso.id, 1)
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath on early validation failure', async () => {
      await resetWeekSchedule(0, 0)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath when mesocycle is completed', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      await resetWeekSchedule(meso.id, 1)
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })
})
