// Characterization test — captures current behavior for safe refactoring
// Updated for T114: getTodayWorkout now returns TodayResult[]
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

// === Table creation (mirrors queries.test.ts) ===

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
    target_distance REAL, target_duration INTEGER,
      planned_duration INTEGER,
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
      rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
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
      time_slot TEXT,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_period_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, period)`
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

// === Seed helpers ===

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

function seedSchedule(
  mesoId: number,
  day: number,
  templateId: number,
  weekType = 'normal'
) {
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
      template_snapshot: {
        version: 1,
        name: canonicalName,
        modality: 'resistance',
      },
      created_at: new Date(),
    })
    .returning({ id: schema.logged_workouts.id })
    .get()
}

function seedLoggedExercise(
  loggedWorkoutId: number,
  exerciseName: string,
  order: number,
  overrides: Partial<{ actual_rpe: number }> = {}
) {
  return testDb
    .insert(schema.logged_exercises)
    .values({
      logged_workout_id: loggedWorkoutId,
      exercise_name: exerciseName,
      order,
      actual_rpe: overrides.actual_rpe ?? null,
      created_at: new Date(),
    })
    .returning({ id: schema.logged_exercises.id })
    .get()
}

function seedLoggedSet(
  loggedExerciseId: number,
  setNumber: number,
  overrides: Partial<{ actual_reps: number; actual_weight: number }> = {}
) {
  return testDb
    .insert(schema.logged_sets)
    .values({
      logged_exercise_id: loggedExerciseId,
      set_number: setNumber,
      actual_reps: overrides.actual_reps ?? null,
      actual_weight: overrides.actual_weight ?? null,
      created_at: new Date(),
    })
    .returning({ id: schema.logged_sets.id })
    .get()
}

// ============================================================================
// isDeloadWeek — edge cases not covered in queries.test.ts
// ============================================================================

describe('isDeloadWeek — edge cases (characterize)', () => {
  it('returns true on exact deload boundary day', () => {
    expect(isDeloadWeek('2026-03-01', 2, true, '2026-03-15')).toBe(true)
  })

  it('returns false one day before deload boundary', () => {
    expect(isDeloadWeek('2026-03-01', 2, true, '2026-03-14')).toBe(false)
  })

  it('handles date before mesocycle start', () => {
    expect(isDeloadWeek('2026-03-15', 4, true, '2026-03-01')).toBe(false)
  })

  it('handles same-day start (diffDays=0) with 0 work weeks', () => {
    expect(isDeloadWeek('2026-03-01', 0, true, '2026-03-01')).toBe(true)
  })
})

// ============================================================================
// getTodayWorkout — characterize uncovered paths
// NOTE: getTodayWorkout now returns TodayResult[] (T114 multi-session)
// All assertions access results[0] for single-session scenarios
// ============================================================================

describe('getTodayWorkout — already_logged exercises+sets (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('already_logged includes logged exercises array', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const log = seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')
    seedLoggedExercise(log.id, 'Bench Press', 1, { actual_rpe: 8 })
    seedLoggedExercise(log.id, 'OHP', 2, { actual_rpe: 7 })

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('already_logged')
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.exercises).toHaveLength(2)
      expect(result.loggedWorkout.exercises[0].exercise_name).toBe(
        'Bench Press'
      )
      expect(result.loggedWorkout.exercises[0].actual_rpe).toBe(8)
      expect(result.loggedWorkout.exercises[1].exercise_name).toBe('OHP')
      expect(result.loggedWorkout.exercises[1].order).toBe(2)
    }
  })

  it('already_logged exercises are ordered by order field', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const log = seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')
    seedLoggedExercise(log.id, 'OHP', 2)
    seedLoggedExercise(log.id, 'Bench Press', 1)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.exercises[0].order).toBe(1)
      expect(result.loggedWorkout.exercises[0].exercise_name).toBe(
        'Bench Press'
      )
      expect(result.loggedWorkout.exercises[1].order).toBe(2)
    }
  })

  it('already_logged exercises include nested sets', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const log = seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')
    const ex = seedLoggedExercise(log.id, 'Bench Press', 1)
    seedLoggedSet(ex.id, 1, { actual_reps: 8, actual_weight: 80 })
    seedLoggedSet(ex.id, 2, { actual_reps: 7, actual_weight: 80 })
    seedLoggedSet(ex.id, 3, { actual_reps: 6, actual_weight: 80 })

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'already_logged') {
      const exercise = result.loggedWorkout.exercises[0]
      expect(exercise.sets).toHaveLength(3)
      expect(exercise.sets[0]).toEqual({
        set_number: 1,
        actual_reps: 8,
        actual_weight: 80,
      })
      expect(exercise.sets[1].set_number).toBe(2)
      expect(exercise.sets[2].actual_reps).toBe(6)
    }
  })

  it('already_logged sets are ordered by set_number', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const log = seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')
    const ex = seedLoggedExercise(log.id, 'Bench Press', 1)
    seedLoggedSet(ex.id, 3, { actual_reps: 6, actual_weight: 80 })
    seedLoggedSet(ex.id, 1, { actual_reps: 8, actual_weight: 80 })
    seedLoggedSet(ex.id, 2, { actual_reps: 7, actual_weight: 80 })

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'already_logged') {
      const sets = result.loggedWorkout.exercises[0].sets
      expect(sets[0].set_number).toBe(1)
      expect(sets[1].set_number).toBe(2)
      expect(sets[2].set_number).toBe(3)
    }
  })

  it('already_logged with no exercises returns empty array', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.exercises).toEqual([])
    }
  })

  it('already_logged exercise with no sets returns empty sets array', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const log = seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')
    seedLoggedExercise(log.id, 'Bench Press', 1)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.exercises[0].sets).toEqual([])
    }
  })

  it('already_logged sets with null reps/weight are preserved', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const log = seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')
    const ex = seedLoggedExercise(log.id, 'Bench Press', 1)
    seedLoggedSet(ex.id, 1)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'already_logged') {
      expect(result.loggedWorkout.exercises[0].sets[0].actual_reps).toBeNull()
      expect(
        result.loggedWorkout.exercises[0].sets[0].actual_weight
      ).toBeNull()
    }
  })
})

describe('getTodayWorkout — running/mma template fields (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('workout includes running-specific template fields', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Easy Run', {
      modality: 'running',
      run_type: 'easy',
      target_pace: '5:30',
      hr_zone: 2,
      coaching_cues: 'Keep it easy',
    })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.modality).toBe('running')
      expect(result.template.run_type).toBe('easy')
      expect(result.template.target_pace).toBe('5:30')
      expect(result.template.hr_zone).toBe(2)
      expect(result.template.coaching_cues).toBe('Keep it easy')
      expect(result.template.interval_count).toBeNull()
      expect(result.template.interval_rest).toBeNull()
    }
  })

  it('workout includes interval running fields', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Intervals', {
      modality: 'running',
      run_type: 'interval',
      interval_count: 6,
      interval_rest: 90,
    })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.template.interval_count).toBe(6)
      expect(result.template.interval_rest).toBe(90)
    }
  })

  it('workout includes mma-specific planned_duration', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'BJJ Class', {
      modality: 'mma',
      planned_duration: 90,
    })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.template.modality).toBe('mma')
      expect(result.template.planned_duration).toBe(90)
    }
  })

  it('resistance template has null for all modality-specific fields', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.template.run_type).toBeNull()
      expect(result.template.target_pace).toBeNull()
      expect(result.template.hr_zone).toBeNull()
      expect(result.template.interval_count).toBeNull()
      expect(result.template.interval_rest).toBeNull()
      expect(result.template.coaching_cues).toBeNull()
      expect(result.template.planned_duration).toBeNull()
    }
  })

  it('template notes are included when present', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A', { notes: 'Focus on mind-muscle connection' })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.template.notes).toBe('Focus on mind-muscle connection')
    }
  })
})

describe('getTodayWorkout — mesocycle info shape (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('week_type is "normal" during work weeks', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id, 'normal')

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.mesocycle.week_type).toBe('normal')
    }
  })

  it('week_type is "deload" during deload week', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmpl = seedTemplate(meso.id, 'Push Deload')
    seedSchedule(meso.id, 2, tmpl.id, 'deload')

    const results = await getTodayWorkout('2026-03-31')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.mesocycle.week_type).toBe('deload')
    }
  })

  it('mesocycle info has start_date and end_date', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.mesocycle.start_date).toBe('2026-03-01')
      expect(result.mesocycle.end_date).toBe('2026-03-28')
    }
  })

  it('rest_day also includes full mesocycle info', async () => {
    seedMesocycle({
      name: 'Block B',
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
    })

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('rest_day')
    if (result.type === 'rest_day') {
      expect(result.mesocycle.name).toBe('Block B')
      expect(result.mesocycle.start_date).toBe('2026-03-01')
      expect(result.mesocycle.end_date).toBe('2026-03-28')
    }
  })
})

describe('getTodayWorkout — template-not-found fallback (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns rest_day when schedule points to non-existent template', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })

    testDb.run(sql`PRAGMA foreign_keys = OFF`)
    testDb.run(sql`
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (${meso.id}, 2, 9999, 'normal', 'morning')
    `)
    testDb.run(sql`PRAGMA foreign_keys = ON`)

    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('rest_day')
  })

  it('returns rest_day when schedule has null template_id', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })

    testDb.run(sql`
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (${meso.id}, 2, NULL, 'normal', 'morning')
    `)

    const results = await getTodayWorkout('2026-03-10')
    expect(results[0].type).toBe('rest_day')
  })
})

describe('getTodayWorkout — day-of-week mapping (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('Sunday (day 0) is correctly identified', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Sunday Workout')
    seedSchedule(meso.id, 0, tmpl.id)

    const results = await getTodayWorkout('2026-03-08')
    const result = results[0]
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.name).toBe('Sunday Workout')
    }
  })

  it('Saturday (day 6) is correctly identified', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Saturday Workout')
    seedSchedule(meso.id, 6, tmpl.id)

    const results = await getTodayWorkout('2026-03-07')
    const result = results[0]
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.name).toBe('Saturday Workout')
    }
  })
})

describe('getTodayWorkout — result type structure (characterize)', () => {
  beforeEach(() => {
    createTables()
  })

  it('no_active_mesocycle has exactly type and date', async () => {
    const results = await getTodayWorkout('2026-03-10')
    expect(results[0]).toEqual({
      type: 'no_active_mesocycle',
      date: '2026-03-10',
    })
  })

  it('workout result has expected keys including period and time_slot', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(Object.keys(result).sort()).toEqual(
        ['date', 'mesocycle', 'period', 'slots', 'template', 'time_slot', 'type'].sort()
      )
    }
  })

  it('rest_day result has type, date, mesocycle, routines keys', async () => {
    seedMesocycle({ status: 'active', start_date: '2026-03-01' })

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('rest_day')
    if (result.type === 'rest_day') {
      expect(Object.keys(result).sort()).toEqual(
        ['date', 'mesocycle', 'routines', 'type'].sort()
      )
    }
  })

  it('already_logged result has expected keys including period and time_slot', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 2, tmpl.id)
    seedLoggedWorkout(tmpl.id, '2026-03-10', 'push-a')

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('already_logged')
    if (result.type === 'already_logged') {
      expect(Object.keys(result).sort()).toEqual(
        ['date', 'loggedWorkout', 'mesocycle', 'period', 'time_slot', 'type'].sort()
      )
    }
  })
})
