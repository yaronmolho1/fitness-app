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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { cloneMesocycle } from './clone-actions'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
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
  testDb.run(sql`CREATE TABLE slot_week_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    weight REAL,
    reps TEXT,
    sets INTEGER,
    rpe REAL,
    distance REAL,
    duration INTEGER,
    pace TEXT,
    elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER,
    UNIQUE(exercise_slot_id, week_number)
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

beforeEach(() => {
  vi.clearAllMocks()
  resetTables()
})

describe('cloneMesocycle — T224 rotation preservation', () => {
  describe('preserves cycle_length on schedule rows', () => {
    it('clone preserves cycle_length=3 from source row', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
          day_of_week: 1,
          template_id: tmpl.id,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 90,
          cycle_length: 3,
          cycle_position: 1,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed unexpectedly')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)

      expect(rows).toHaveLength(1)
      expect(rows[0].cycle_length).toBe(3)
    })
  })

  describe('preserves cycle_position on schedule rows', () => {
    it('clone preserves cycle_position=2 from source row', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
          name: 'Push B',
          canonical_name: 'push-b',
          modality: 'resistance',
        })
        .returning({ id: schema.workout_templates.id })
        .get()

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id,
          day_of_week: 2,
          template_id: tmpl.id,
          week_type: 'normal',
          period: 'morning',
          time_slot: '08:00',
          duration: 90,
          cycle_length: 3,
          cycle_position: 2,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed unexpectedly')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)

      expect(rows).toHaveLength(1)
      expect(rows[0].cycle_position).toBe(2)
    })
  })

  describe('multi-position rotation clone succeeds', () => {
    it('clones all 3 rotation positions without unique index violation', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Rotation Source',
          start_date: '2026-03-01',
          end_date: '2026-03-28',
          work_weeks: 4,
          has_deload: false,
          status: 'active',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const tmplA = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()
      const tmplB = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()
      const tmplC = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push C', canonical_name: 'push-c', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      for (const [pos, tmplId] of [[1, tmplA.id], [2, tmplB.id], [3, tmplC.id]] as [number, number][]) {
        testDb
          .insert(schema.weekly_schedule)
          .values({
            mesocycle_id: meso.id,
            day_of_week: 0,
            template_id: tmplId,
            week_type: 'normal',
            period: 'morning',
            time_slot: '07:00',
            duration: 90,
            cycle_length: 3,
            cycle_position: pos,
          })
          .run()
      }

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('clone failed')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)

      expect(rows).toHaveLength(3)
      expect(rows.map((r: { cycle_length: number }) => r.cycle_length)).toEqual([3, 3, 3])
      expect(rows.map((r: { cycle_position: number }) => r.cycle_position).sort()).toEqual([1, 2, 3])
    })
  })

  describe('template ID remapping with rotation rows', () => {
    it('each rotation position maps to the correct new template', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Rotation Source',
          start_date: '2026-03-01',
          end_date: '2026-03-28',
          work_weeks: 4,
          has_deload: false,
          status: 'active',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const tmplA = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()
      const tmplB = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      for (const [pos, tmplId] of [[1, tmplA.id], [2, tmplB.id]] as [number, number][]) {
        testDb
          .insert(schema.weekly_schedule)
          .values({
            mesocycle_id: meso.id,
            day_of_week: 0,
            template_id: tmplId,
            week_type: 'normal',
            period: 'morning',
            time_slot: '07:00',
            duration: 90,
            cycle_length: 2,
            cycle_position: pos,
          })
          .run()
      }

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedRows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
        .sort((a: { cycle_position: number }, b: { cycle_position: number }) => a.cycle_position - b.cycle_position)

      // Template IDs should be different from source but distinct from each other
      expect(clonedRows[0].template_id).not.toBe(tmplA.id)
      expect(clonedRows[1].template_id).not.toBe(tmplB.id)
      expect(clonedRows[0].template_id).not.toBe(clonedRows[1].template_id)
    })
  })

  describe('mixed rotating and non-rotating entries', () => {
    it('rotating entries preserve cycle fields, non-rotating keep defaults', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Mixed Source',
          start_date: '2026-03-01',
          end_date: '2026-03-28',
          work_weeks: 4,
          has_deload: false,
          status: 'active',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const tmplA = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()
      const tmplB = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()
      const tmplRun = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Easy Run', canonical_name: 'easy-run', modality: 'running' })
        .returning({ id: schema.workout_templates.id })
        .get()

      // Rotating Monday slot
      for (const [pos, tmplId] of [[1, tmplA.id], [2, tmplB.id]] as [number, number][]) {
        testDb
          .insert(schema.weekly_schedule)
          .values({
            mesocycle_id: meso.id,
            day_of_week: 0,
            template_id: tmplId,
            week_type: 'normal',
            period: 'morning',
            time_slot: '07:00',
            duration: 90,
            cycle_length: 2,
            cycle_position: pos,
          })
          .run()
      }

      // Non-rotating Tuesday slot
      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id,
          day_of_week: 1,
          template_id: tmplRun.id,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 60,
          cycle_length: 1,
          cycle_position: 1,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)

      expect(rows).toHaveLength(3)

      const rotatingRows = rows
        .filter((r: { day_of_week: number }) => r.day_of_week === 0)
        .sort((a: { cycle_position: number }, b: { cycle_position: number }) => a.cycle_position - b.cycle_position)
      expect(rotatingRows).toHaveLength(2)
      expect(rotatingRows[0].cycle_length).toBe(2)
      expect(rotatingRows[0].cycle_position).toBe(1)
      expect(rotatingRows[1].cycle_length).toBe(2)
      expect(rotatingRows[1].cycle_position).toBe(2)

      const nonRotating = rows.filter((r: { day_of_week: number }) => r.day_of_week === 1)
      expect(nonRotating).toHaveLength(1)
      expect(nonRotating[0].cycle_length).toBe(1)
      expect(nonRotating[0].cycle_position).toBe(1)
    })
  })
})

// Helper: get cloned slots for a clone result
function getClonedSlots(cloneId: number) {
  const clonedTmpls = testDb
    .select()
    .from(schema.workout_templates)
    .all()
    .filter((t: { mesocycle_id: number }) => t.mesocycle_id === cloneId)

  const allSlots: (typeof schema.exercise_slots.$inferSelect)[] = []
  for (const t of clonedTmpls) {
    const slots = testDb
      .select()
      .from(schema.exercise_slots)
      .all()
      .filter((s: { template_id: number }) => s.template_id === t.id)
    allSlots.push(...slots)
  }
  return allSlots
}

describe('cloneMesocycle — T222 slot value inheritance', () => {
  describe('last-week override merged into cloned slot base', () => {
    it('cloned slot has merged values from last-week override', async () => {
      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'Bench Press', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
        .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      const slot = testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: exercise.id,
          sets: 3, reps: '10', weight: 100, rpe: 8, order: 1,
        })
        .returning({ id: schema.exercise_slots.id })
        .get()

      // Override at week 4 (last work week)
      testDb.run(sql`INSERT INTO slot_week_overrides
        (exercise_slot_id, week_number, weight, reps, sets, rpe)
        VALUES (${slot.id}, 4, 110, '8', 4, 9)`)

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedSlots = getClonedSlots(result.id)
      expect(clonedSlots).toHaveLength(1)
      expect(clonedSlots[0].weight).toBe(110)
      expect(clonedSlots[0].sets).toBe(4)
      expect(clonedSlots[0].reps).toBe('8')
      expect(clonedSlots[0].rpe).toBe(9)
    })
  })

  describe('no override at last week — base values preserved', () => {
    it('cloned slot values equal source base when no overrides exist', async () => {
      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'OHP', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
        .values({ mesocycle_id: meso.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: exercise.id,
          sets: 5, reps: '5', weight: 80, rpe: 7, order: 1,
        })
        .run()

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedSlots = getClonedSlots(result.id)
      expect(clonedSlots).toHaveLength(1)
      expect(clonedSlots[0].weight).toBe(80)
      expect(clonedSlots[0].sets).toBe(5)
      expect(clonedSlots[0].reps).toBe('5')
      expect(clonedSlots[0].rpe).toBe(7)
    })

    it('mid-meso override ignored — only last work_week matters', async () => {
      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'Squat', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
        .values({ mesocycle_id: meso.id, name: 'Leg A', canonical_name: 'leg-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      const slot = testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: exercise.id,
          sets: 4, reps: '6', weight: 140, rpe: 8, order: 1,
        })
        .returning({ id: schema.exercise_slots.id })
        .get()

      // Override at week 2 only — not last week (4)
      testDb.run(sql`INSERT INTO slot_week_overrides
        (exercise_slot_id, week_number, weight, reps, sets, rpe)
        VALUES (${slot.id}, 2, 150, '5', 5, 9)`)

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 1, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedSlots = getClonedSlots(result.id)
      expect(clonedSlots[0].weight).toBe(140)
      expect(clonedSlots[0].sets).toBe(4)
      expect(clonedSlots[0].reps).toBe('6')
      expect(clonedSlots[0].rpe).toBe(8)
    })
  })

  describe('partial override — only overridden fields change', () => {
    it('null override fields fall back to base values', async () => {
      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'Row', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
        .values({ mesocycle_id: meso.id, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      const slot = testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: exercise.id,
          sets: 3, reps: '10', weight: 60, rpe: 7, order: 1,
        })
        .returning({ id: schema.exercise_slots.id })
        .get()

      // Override at week 4 — only weight, rest null
      testDb.run(sql`INSERT INTO slot_week_overrides
        (exercise_slot_id, week_number, weight)
        VALUES (${slot.id}, 4, 80)`)

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedSlots = getClonedSlots(result.id)
      expect(clonedSlots[0].weight).toBe(80)
      expect(clonedSlots[0].sets).toBe(3)
      expect(clonedSlots[0].reps).toBe('10')
      expect(clonedSlots[0].rpe).toBe(7)
    })
  })

  describe('no slot_week_overrides created in new meso', () => {
    it('override row count unchanged after clone', async () => {
      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'Deadlift', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
        .values({ mesocycle_id: meso.id, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      const slot = testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: exercise.id,
          sets: 3, reps: '10', weight: 100, rpe: 8, order: 1,
        })
        .returning({ id: schema.exercise_slots.id })
        .get()

      testDb.run(sql`INSERT INTO slot_week_overrides
        (exercise_slot_id, week_number, weight, sets) VALUES (${slot.id}, 4, 120, 4)`)

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      const overridesBefore = testDb.all(sql`SELECT * FROM slot_week_overrides`)

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const overridesAfter = testDb.all(sql`SELECT * FROM slot_week_overrides`)
      expect(overridesAfter).toHaveLength(overridesBefore.length)

      // No overrides on cloned slots
      const clonedSlots = getClonedSlots(result.id)
      for (const s of clonedSlots) {
        const overrides = testDb.all(
          sql`SELECT * FROM slot_week_overrides WHERE exercise_slot_id = ${s.id}`
        )
        expect(overrides).toHaveLength(0)
      }
    })
  })

  describe('multiple slots — mixed override states', () => {
    it('slots with overrides get merged, slots without keep base', async () => {
      const bench = testDb
        .insert(schema.exercises)
        .values({ name: 'Bench', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()
      const fly = testDb
        .insert(schema.exercises)
        .values({ name: 'Cable Fly', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
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
        .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      // Slot 1: has override at last week
      const slot1 = testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: bench.id,
          sets: 3, reps: '10', weight: 100, rpe: 8, order: 1,
        })
        .returning({ id: schema.exercise_slots.id })
        .get()

      testDb.run(sql`INSERT INTO slot_week_overrides
        (exercise_slot_id, week_number, weight, sets) VALUES (${slot1.id}, 4, 110, 4)`)

      // Slot 2: no override
      testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: fly.id,
          sets: 3, reps: '12', weight: 15, rpe: 7, order: 2,
        })
        .run()

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedSlots = getClonedSlots(result.id)
      expect(clonedSlots).toHaveLength(2)

      const sorted = clonedSlots.sort(
        (a: { order: number }, b: { order: number }) => a.order - b.order
      )

      // Slot 1: merged — weight 110, sets 4, reps/rpe from base
      expect(sorted[0].weight).toBe(110)
      expect(sorted[0].sets).toBe(4)
      expect(sorted[0].reps).toBe('10')
      expect(sorted[0].rpe).toBe(8)

      // Slot 2: no override — base preserved
      expect(sorted[1].weight).toBe(15)
      expect(sorted[1].sets).toBe(3)
      expect(sorted[1].reps).toBe('12')
      expect(sorted[1].rpe).toBe(7)
    })
  })

  describe('override source is always source.work_weeks', () => {
    it('uses source work_weeks even when clone overrides work_weeks', async () => {
      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'Bench 2', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source',
          start_date: '2026-03-01',
          end_date: '2026-04-25',
          work_weeks: 8,
          has_deload: false,
          status: 'active',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const tmpl = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      const slot = testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id, exercise_id: exercise.id,
          sets: 3, reps: '10', weight: 60, rpe: 7, order: 1,
        })
        .returning({ id: schema.exercise_slots.id })
        .get()

      // Override at week 8 (source's work_weeks)
      testDb.run(sql`INSERT INTO slot_week_overrides
        (exercise_slot_id, week_number, weight) VALUES (${slot.id}, 8, 90)`)

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00', duration: 90,
        })
        .run()

      // Clone with work_weeks=12 — should still read from week 8
      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-05-01',
        work_weeks: 12,
      })
      if (!result.success) throw new Error('clone failed')

      const clonedSlots = getClonedSlots(result.id)
      expect(clonedSlots[0].weight).toBe(90)
    })
  })
})
