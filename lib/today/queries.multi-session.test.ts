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

import { getTodayWorkout } from './queries'

// Table creation (same schema as characterization tests)
function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS routine_logs`)
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_sets`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_exercises`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS schedule_week_overrides`)
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
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER, estimated_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      section_id INTEGER,
      sets INTEGER NOT NULL,
      reps TEXT NOT NULL,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
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
      actual_rpe REAL,
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
      frequency_mode TEXT NOT NULL DEFAULT 'weekly_target',
      frequency_days TEXT,
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

// Seed helpers
function seedMesocycle(
  overrides: Partial<{
    name: string
    start_date: string
    end_date: string
    work_weeks: number
    has_deload: boolean
    status: string
  }> = {}
) {
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

function seedTemplate(
  mesocycleId: number,
  name = 'Push A',
  overrides: Partial<{
    modality: string
    notes: string
    run_type: string
    target_pace: string
    hr_zone: number
    interval_count: number
    interval_rest: number
    coaching_cues: string
    planned_duration: number
  }> = {}
) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: overrides.modality ?? 'resistance',
      notes: overrides.notes ?? null,
      run_type: overrides.run_type ?? null,
      target_pace: overrides.target_pace ?? null,
      hr_zone: overrides.hr_zone ?? null,
      interval_count: overrides.interval_count ?? null,
      interval_rest: overrides.interval_rest ?? null,
      coaching_cues: overrides.coaching_cues ?? null,
      planned_duration: overrides.planned_duration ?? null,
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedSlot(
  templateId: number,
  exerciseId: number,
  order: number,
  overrides: Partial<{
    sets: number
    reps: string
    weight: number
    rpe: number
    rest_seconds: number
    guidelines: string
    is_main: boolean
  }> = {}
) {
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

function seedSchedule(
  mesoId: number,
  day: number,
  templateId: number,
  weekType = 'normal',
  period = 'morning',
  timeSlot?: string
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      period,
      time_slot: timeSlot ?? (period === 'morning' ? '07:00' : period === 'afternoon' ? '13:00' : '18:00'),
      created_at: new Date(),
    })
    .returning()
    .get()
}

// ============================================================================
// T114: Multi-session support
// ============================================================================

describe('getTodayWorkout — returns array (T114)', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns an array', async () => {
    const result = await getTodayWorkout('2026-03-10')
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns array of 1 for no_active_mesocycle', async () => {
    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('no_active_mesocycle')
  })

  it('returns array of 1 for single-session day', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id) // Tuesday

    const result = await getTodayWorkout('2026-03-10') // Tuesday
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('workout')
  })

  it('returns array of 1 for rest day', async () => {
    seedMesocycle({ status: 'active', start_date: '2026-03-01' })

    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('rest_day')
  })
})

describe('getTodayWorkout — period and time_slot in response (T114)', () => {
  beforeEach(() => {
    createTables()
  })

  it('workout result includes period field', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal', 'morning')

    const result = await getTodayWorkout('2026-03-10')
    expect(result[0].type).toBe('workout')
    if (result[0].type === 'workout') {
      expect(result[0].period).toBe('morning')
    }
  })

  it('workout result includes time_slot field', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal', 'morning', '06:30')

    const result = await getTodayWorkout('2026-03-10')
    expect(result[0].type).toBe('workout')
    if (result[0].type === 'workout') {
      expect(result[0].time_slot).toBe('06:30')
    }
  })

  it('workout result has default time_slot derived from period when not explicitly set', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal', 'evening')

    const result = await getTodayWorkout('2026-03-10')
    if (result[0].type === 'workout') {
      expect(result[0].time_slot).toBe('18:00')
    }
  })
})

describe('getTodayWorkout — multiple sessions per day (T114)', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns multiple workout results when multiple sessions scheduled', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const pushA = seedTemplate(meso.id, 'Push A')
    const easyRun = seedTemplate(meso.id, 'Easy Run', { modality: 'running' })

    // Two sessions on Tuesday
    seedSchedule(meso.id, 1, pushA.id, 'normal', 'morning', '06:30')
    seedSchedule(meso.id, 1, easyRun.id, 'normal', 'evening', '18:00')

    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('workout')
    expect(result[1].type).toBe('workout')
  })

  it('sessions are ordered by period (morning → afternoon → evening)', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl1 = seedTemplate(meso.id, 'Evening Lift')
    const tmpl2 = seedTemplate(meso.id, 'Morning Run', { modality: 'running' })

    // Insert evening first, morning second
    seedSchedule(meso.id, 1, tmpl1.id, 'normal', 'evening')
    seedSchedule(meso.id, 1, tmpl2.id, 'normal', 'morning')

    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(2)
    if (result[0].type === 'workout' && result[1].type === 'workout') {
      expect(result[0].period).toBe('morning')
      expect(result[1].period).toBe('evening')
    }
  })

  it('each session has its own template and slots', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const pushA = seedTemplate(meso.id, 'Push A')
    const pullA = seedTemplate(meso.id, 'Pull A')
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Barbell Row')

    seedSlot(pushA.id, ex1.id, 1, { is_main: true })
    seedSlot(pullA.id, ex2.id, 1, { is_main: true })

    seedSchedule(meso.id, 1, pushA.id, 'normal', 'morning')
    seedSchedule(meso.id, 1, pullA.id, 'normal', 'evening')

    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(2)
    if (result[0].type === 'workout' && result[1].type === 'workout') {
      expect(result[0].template.name).toBe('Push A')
      expect(result[0].slots).toHaveLength(1)
      expect(result[0].slots[0].exercise_name).toBe('Bench Press')
      expect(result[1].template.name).toBe('Pull A')
      expect(result[1].slots).toHaveLength(1)
      expect(result[1].slots[0].exercise_name).toBe('Barbell Row')
    }
  })

  it('three sessions on same day', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Morning Lift')
    const t2 = seedTemplate(meso.id, 'Afternoon Run', { modality: 'running' })
    const t3 = seedTemplate(meso.id, 'Evening BJJ', { modality: 'mma' })

    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning', '06:30')
    seedSchedule(meso.id, 1, t2.id, 'normal', 'afternoon', '13:00')
    seedSchedule(meso.id, 1, t3.id, 'normal', 'evening', '19:00')

    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(3)
    if (
      result[0].type === 'workout' &&
      result[1].type === 'workout' &&
      result[2].type === 'workout'
    ) {
      expect(result[0].period).toBe('morning')
      expect(result[0].time_slot).toBe('06:30')
      expect(result[1].period).toBe('afternoon')
      expect(result[1].time_slot).toBe('13:00')
      expect(result[2].period).toBe('evening')
      expect(result[2].time_slot).toBe('19:00')
    }
  })

  it('mix of logged and unlogged sessions', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const t1 = seedTemplate(meso.id, 'Morning Lift')
    const t2 = seedTemplate(meso.id, 'Evening Run', { modality: 'running' })

    seedSchedule(meso.id, 1, t1.id, 'normal', 'morning')
    seedSchedule(meso.id, 1, t2.id, 'normal', 'evening')

    // Log only the morning session
    testDb
      .insert(schema.logged_workouts)
      .values({
        template_id: t1.id,
        canonical_name: 'morning-lift',
        log_date: '2026-03-10',
        logged_at: new Date(),
        template_snapshot: { version: 1, name: 'Morning Lift', modality: 'resistance' },
        created_at: new Date(),
      })
      .run()

    const result = await getTodayWorkout('2026-03-10')
    expect(result).toHaveLength(2)
    // Morning should be already_logged, evening should be workout
    expect(result[0].type).toBe('already_logged')
    expect(result[1].type).toBe('workout')
  })
})
