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

import { getTodayWorkout, isDeloadWeek } from './queries'

// Helpers

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)
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
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      modality TEXT NOT NULL,
      muscle_group TEXT,
      equipment TEXT,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      modality TEXT NOT NULL,
      notes TEXT,
      run_type TEXT,
      target_pace TEXT,
      hr_zone INTEGER,
      interval_count INTEGER,
      interval_rest INTEGER,
      coaching_cues TEXT,
      planned_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      sets INTEGER NOT NULL,
      reps TEXT NOT NULL,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER,
      guidelines TEXT,
      "order" INTEGER NOT NULL,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE weekly_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      week_type TEXT NOT NULL DEFAULT 'normal',
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type)`
  )
}

function seedMesocycle(overrides: Partial<{
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

function seedExercise(name: string, modality = 'resistance') {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality, created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
}

function seedTemplate(mesocycleId: number, name = 'Push A', modality = 'resistance') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality,
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedSlot(templateId: number, exerciseId: number, order: number, overrides: Partial<{
  sets: number
  reps: string
  weight: number
  rpe: number
  rest_seconds: number
  guidelines: string
  is_main: boolean
}> = {}) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      sets: overrides.sets ?? 3,
      reps: overrides.reps ?? '8-12',
      weight: overrides.weight ?? null,
      rpe: overrides.rpe ?? null,
      rest_seconds: overrides.rest_seconds ?? null,
      guidelines: overrides.guidelines ?? null,
      order,
      is_main: overrides.is_main ?? false,
      created_at: new Date(),
    })
    .returning({ id: schema.exercise_slots.id })
    .get()
}

function seedSchedule(mesoId: number, day: number, templateId: number, weekType = 'normal') {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      created_at: new Date(),
    })
    .returning()
    .get()
}

// ============================================================================
// isDeloadWeek — pure function tests
// ============================================================================

describe('isDeloadWeek', () => {
  it('returns false when has_deload is false', () => {
    expect(isDeloadWeek('2026-03-01', 4, false, '2026-03-25')).toBe(false)
  })

  it('returns false when in a normal week (not last)', () => {
    // 4 work weeks + deload (5 total), today is week 1
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-03')).toBe(false)
  })

  it('returns true when in the last week and has_deload is true', () => {
    // 4 work weeks + 1 deload = 5 total weeks
    // start: 2026-03-01 (Sunday), last week starts 2026-03-29 (Sunday)
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-29')).toBe(true)
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-04-04')).toBe(true)
  })

  it('returns false on the last day of work weeks (day before deload starts)', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-28')).toBe(false)
  })

  it('handles single work week with deload', () => {
    // 1 work week + deload = 2 total weeks
    expect(isDeloadWeek('2026-03-01', 1, true, '2026-03-08')).toBe(true)
    expect(isDeloadWeek('2026-03-01', 1, true, '2026-03-05')).toBe(false)
  })
})

// ============================================================================
// getTodayWorkout — integration with in-memory DB
// ============================================================================

describe('getTodayWorkout', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns no_active_mesocycle when no mesocycle is active', async () => {
    seedMesocycle({ status: 'planned' })

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('no_active_mesocycle')
    expect(result.date).toBe('2026-03-10')
  })

  it('returns no_active_mesocycle when DB is empty', async () => {
    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('no_active_mesocycle')
  })

  it('returns rest_day when no schedule entry for today', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id) // Monday only

    // 2026-03-10 is a Tuesday (day 2)
    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('rest_day')
    expect(result.date).toBe('2026-03-10')
  })

  it('returns workout with template when schedule entry exists', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id) // Tuesday

    // 2026-03-10 is Tuesday
    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('workout')
    expect(result.date).toBe('2026-03-10')
    if (result.type === 'workout') {
      expect(result.template.name).toBe('Push A')
      expect(result.template.modality).toBe('resistance')
    }
  })

  it('includes exercise slots with exercise details', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline DB Press')
    seedSlot(tmpl.id, ex1.id, 1, { sets: 4, reps: '6-8', weight: 100, rpe: 8, is_main: true })
    seedSlot(tmpl.id, ex2.id, 2, { sets: 3, reps: '10-12', rest_seconds: 90, guidelines: 'Slow eccentric' })
    seedSchedule(meso.id, 2, tmpl.id)

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.slots).toHaveLength(2)

      const slot1 = result.slots[0]
      expect(slot1.exercise_name).toBe('Bench Press')
      expect(slot1.sets).toBe(4)
      expect(slot1.reps).toBe('6-8')
      expect(slot1.weight).toBe(100)
      expect(slot1.rpe).toBe(8)
      expect(slot1.is_main).toBe(true)

      const slot2 = result.slots[1]
      expect(slot2.exercise_name).toBe('Incline DB Press')
      expect(slot2.rest_seconds).toBe(90)
      expect(slot2.guidelines).toBe('Slow eccentric')
      expect(slot2.is_main).toBe(false)
    }
  })

  it('slots are ordered by their order field', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('OHP')
    seedSlot(tmpl.id, ex2.id, 2)
    seedSlot(tmpl.id, ex1.id, 1)
    seedSchedule(meso.id, 2, tmpl.id)

    const result = await getTodayWorkout('2026-03-10')
    if (result.type === 'workout') {
      expect(result.slots[0].exercise_name).toBe('Bench Press')
      expect(result.slots[1].exercise_name).toBe('OHP')
    }
  })

  it('selects normal variant during non-deload week', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmplNormal = seedTemplate(meso.id, 'Push Normal')
    const tmplDeload = seedTemplate(meso.id, 'Push Deload')
    seedSchedule(meso.id, 2, tmplNormal.id, 'normal')
    seedSchedule(meso.id, 2, tmplDeload.id, 'deload')

    // 2026-03-10 is Tuesday, week 2 (not deload)
    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.name).toBe('Push Normal')
    }
  })

  it('selects deload variant during deload week', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmplNormal = seedTemplate(meso.id, 'Push Normal')
    const tmplDeload = seedTemplate(meso.id, 'Push Deload')
    seedSchedule(meso.id, 2, tmplNormal.id, 'normal')
    seedSchedule(meso.id, 2, tmplDeload.id, 'deload')

    // 2026-03-31 is Tuesday in deload week
    const result = await getTodayWorkout('2026-03-31')
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.name).toBe('Push Deload')
    }
  })

  it('uses normal variant when has_deload is false even in last week', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id, 'normal')

    // 2026-03-24 is Tuesday in week 4
    const result = await getTodayWorkout('2026-03-24')
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.name).toBe('Push A')
    }
  })

  it('includes mesocycle info in the response', async () => {
    const meso = seedMesocycle({
      name: 'Hypertrophy Block',
      status: 'active',
      start_date: '2026-03-01',
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const result = await getTodayWorkout('2026-03-10')
    if (result.type === 'workout' || result.type === 'rest_day') {
      expect(result.mesocycle.name).toBe('Hypertrophy Block')
      expect(result.mesocycle.id).toBe(meso.id)
    }
  })
})
