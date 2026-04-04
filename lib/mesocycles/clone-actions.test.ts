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
