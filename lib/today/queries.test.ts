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
  testDb.run(sql`DROP TABLE IF EXISTS routine_logs`)
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_sets`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_exercises`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
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
  testDb.run(sql`
    CREATE TABLE logged_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      canonical_name TEXT,
      log_date TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      rating INTEGER,
      notes TEXT,
      template_snapshot TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE logged_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER,
      exercise_name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE logged_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      actual_reps INTEGER,
      actual_weight REAL,
      actual_rpe REAL,
      created_at INTEGER
    )
  `)
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
      frequency_target INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'global',
      mesocycle_id INTEGER REFERENCES mesocycles(id),
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

function seedLoggedWorkout(
  templateId: number,
  logDate: string,
  canonicalName: string,
  overrides: Partial<{ rating: number; notes: string }> = {}
) {
  return testDb
    .insert(schema.logged_workouts)
    .values({
      template_id: templateId,
      canonical_name: canonicalName,
      log_date: logDate,
      logged_at: new Date(),
      rating: overrides.rating ?? null,
      notes: overrides.notes ?? null,
      template_snapshot: { version: 1, name: canonicalName, modality: 'resistance' },
      created_at: new Date(),
    })
    .returning({ id: schema.logged_workouts.id })
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

function seedRoutineItem(overrides: Partial<{
  name: string
  category: string
  scope: string
  mesocycle_id: number
  start_date: string
  end_date: string
  skip_on_deload: boolean
  has_weight: boolean
  has_duration: boolean
}> = {}) {
  return testDb
    .insert(schema.routine_items)
    .values({
      name: overrides.name ?? 'Test Routine',
      category: overrides.category ?? null,
      has_weight: overrides.has_weight ?? false,
      has_length: false,
      has_duration: overrides.has_duration ?? true,
      has_sets: false,
      has_reps: false,
      frequency_target: 1,
      scope: overrides.scope ?? 'global',
      mesocycle_id: overrides.mesocycle_id ?? null,
      start_date: overrides.start_date ?? null,
      end_date: overrides.end_date ?? null,
      skip_on_deload: overrides.skip_on_deload ?? false,
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedRoutineLog(
  routineItemId: number,
  logDate: string,
  status: 'done' | 'skipped',
  values: Partial<{ value_weight: number; value_duration: number }> = {}
) {
  return testDb
    .insert(schema.routine_logs)
    .values({
      routine_item_id: routineItemId,
      log_date: logDate,
      status,
      value_weight: values.value_weight ?? null,
      value_length: null,
      value_duration: values.value_duration ?? null,
      value_sets: null,
      value_reps: null,
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

  // ==========================================================================
  // T058: Already-logged detection
  // ==========================================================================

  it('returns already_logged when workout logged for today + active mesocycle', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id) // Tuesday

    // Log a workout for this template on 2026-03-10 (Tuesday)
    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('already_logged')
  })

  it('returns workout when no log exists for today', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('workout')
  })

  it('detection uses calendar date not timestamp (midnight boundary)', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id) // Tuesday

    // Logged yesterday (2026-03-09) at 23:59 — should NOT match today (2026-03-10)
    seedLoggedWorkout(tmpl.id, '2026-03-09', 'push-a')

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('workout')
  })

  it('log for different mesocycle does not trigger already_logged', async () => {
    const oldMeso = seedMesocycle({ status: 'completed', start_date: '2026-02-01', name: 'Old Block' })
    const oldTmpl = seedTemplate(oldMeso.id, 'Old Push')

    const activeMeso = seedMesocycle({ status: 'active', start_date: '2026-03-01', name: 'New Block' })
    const activeTmpl = seedTemplate(activeMeso.id, 'Push A')
    seedSchedule(activeMeso.id, 2, activeTmpl.id)

    // Logged workout for the OLD mesocycle's template on today's date
    seedLoggedWorkout(oldTmpl.id, '2026-03-10', 'old-push')

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('workout')
  })

  it('already_logged response includes logged workout id and date', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('already_logged')
    if (result.type === 'already_logged') {
      expect(result.date).toBe('2026-03-10')
      expect(result.mesocycle.id).toBe(meso.id)
      expect(result.loggedWorkout.id).toBeGreaterThan(0)
      expect(result.loggedWorkout.log_date).toBe('2026-03-10')
      expect(result.loggedWorkout.canonical_name).toBe('push-a')
    }
  })

  it('already_logged includes rating and notes when present', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a', { rating: 4, notes: 'Great session' })

    const result = await getTodayWorkout('2026-03-10')
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.rating).toBe(4)
      expect(result.loggedWorkout.notes).toBe('Great session')
    }
  })

  it('already_logged includes template_snapshot', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    const result = await getTodayWorkout('2026-03-10')
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.template_snapshot).toBeDefined()
      expect(result.loggedWorkout.template_snapshot.version).toBe(1)
    }
  })

  it('rest day not affected by already_logged check', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id) // Monday only

    // Even if a log exists for a template on this date, rest day is rest day
    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    // 2026-03-10 is Tuesday — no schedule = rest day
    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('rest_day')
  })

  // ==========================================================================
  // T063: Rest day includes active routines
  // ==========================================================================

  it('rest_day includes active routine items for today', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id) // Monday only

    // Seed a global routine item
    seedRoutineItem({ name: 'Body Weight', scope: 'global' })

    // 2026-03-10 is Tuesday — rest day
    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('rest_day')
    if (result.type === 'rest_day') {
      expect(result.routines).toBeDefined()
      expect(result.routines.items).toHaveLength(1)
      expect(result.routines.items[0].name).toBe('Body Weight')
      expect(result.routines.logs).toHaveLength(0)
    }
  })

  it('rest_day filters out inactive routine items', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01', end_date: '2026-03-28' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id)

    // Global routine — active
    seedRoutineItem({ name: 'Body Weight', scope: 'global' })
    // Date range routine outside range — inactive
    seedRoutineItem({ name: 'Old Routine', scope: 'date_range', start_date: '2025-01-01', end_date: '2025-12-31' })

    const result = await getTodayWorkout('2026-03-10')
    if (result.type === 'rest_day') {
      expect(result.routines.items).toHaveLength(1)
      expect(result.routines.items[0].name).toBe('Body Weight')
    }
  })

  it('rest_day includes routine logs for the date', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id)

    const item = seedRoutineItem({ name: 'Body Weight', scope: 'global', has_weight: true })
    seedRoutineLog(item.id, '2026-03-10', 'done', { value_weight: 72.5 })

    const result = await getTodayWorkout('2026-03-10')
    if (result.type === 'rest_day') {
      expect(result.routines.logs).toHaveLength(1)
      expect(result.routines.logs[0].status).toBe('done')
      expect(result.routines.logs[0].value_weight).toBe(72.5)
    }
  })

  it('rest_day with no active routines returns empty arrays', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id)

    const result = await getTodayWorkout('2026-03-10')
    expect(result.type).toBe('rest_day')
    if (result.type === 'rest_day') {
      expect(result.routines.items).toHaveLength(0)
      expect(result.routines.logs).toHaveLength(0)
    }
  })

  it('rest_day skips skip_on_deload routines during deload week', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal') // Monday normal only

    seedRoutineItem({ name: 'Heavy Mobility', scope: 'global', skip_on_deload: true })
    seedRoutineItem({ name: 'Body Weight', scope: 'global', skip_on_deload: false })

    // 2026-03-31 is Tuesday in deload week — no deload schedule = rest day
    const result = await getTodayWorkout('2026-03-31')
    expect(result.type).toBe('rest_day')
    if (result.type === 'rest_day') {
      expect(result.routines.items).toHaveLength(1)
      expect(result.routines.items[0].name).toBe('Body Weight')
    }
  })
})
