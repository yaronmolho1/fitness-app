import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getRecentSessions, getCurrentPlan } from './queries'

const mockWhere = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>()
  return {
    ...actual,
    db: {
      select: (...args: unknown[]) => mockSelect(...args),
    },
  }
})

import { getAthleteProfile } from './queries'

describe('getAthleteProfile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
  })

  it('returns null when no profile exists', async () => {
    mockWhere.mockResolvedValue([])
    const result = await getAthleteProfile()
    expect(result).toBeNull()
  })

  it('returns profile data when exists', async () => {
    const profile = {
      id: 1,
      age: 30,
      weight_kg: 85.5,
      height_cm: 180,
      gender: 'male',
      training_age_years: 5,
      primary_goal: 'hypertrophy',
      injury_history: 'left shoulder',
      created_at: new Date(),
      updated_at: new Date(),
    }
    mockWhere.mockResolvedValue([profile])
    const result = await getAthleteProfile()
    expect(result).toEqual(profile)
  })
})

let sqlite: Database.Database
let db: AppDb

const CREATE_SQL = `
  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
  );
  CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  );
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
    target_distance REAL,
    target_duration INTEGER,
    target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER,
    created_at INTEGER
  );
  CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL,
    section_name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    run_type TEXT,
    target_pace TEXT,
    hr_zone INTEGER,
    interval_count INTEGER,
    interval_rest INTEGER,
    coaching_cues TEXT,
    target_distance REAL,
    target_duration INTEGER,
    target_elevation_gain INTEGER,
    planned_duration INTEGER,
    created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    weight REAL,
    rpe REAL,
    rest_seconds INTEGER,
    duration INTEGER,
    group_id INTEGER,
    group_rest_seconds INTEGER,
    guidelines TEXT,
    "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );
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
  );
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
  );
  CREATE TABLE logged_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER,
    exercise_name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    actual_rpe REAL,
    created_at INTEGER
  );
  CREATE TABLE logged_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    actual_reps INTEGER,
    actual_weight REAL,
    created_at INTEGER
  );
`

function setupDb() {
  sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  sqlite.exec(CREATE_SQL)
}

function teardownDb() {
  sqlite?.close()
}

// Helper: insert a logged workout with exercises and sets
function insertLoggedWorkout(opts: {
  templateId?: number
  canonicalName?: string
  logDate: string
  rating?: number
  notes?: string
  snapshot?: Record<string, unknown>
  exercises?: Array<{
    exerciseId?: number
    exerciseName: string
    order: number
    actualRpe?: number
    sets: Array<{ setNumber: number; reps: number | null; weight: number | null }>
  }>
}) {
  const workoutId = sqlite
    .prepare(
      `INSERT INTO logged_workouts (template_id, canonical_name, log_date, logged_at, rating, notes, template_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      opts.templateId ?? null,
      opts.canonicalName ?? null,
      opts.logDate,
      Math.floor(Date.now() / 1000),
      opts.rating ?? null,
      opts.notes ?? null,
      JSON.stringify(opts.snapshot ?? { version: 1, name: 'Test' })
    ).lastInsertRowid as number

  for (const ex of opts.exercises ?? []) {
    const exId = sqlite
      .prepare(
        `INSERT INTO logged_exercises (logged_workout_id, exercise_id, exercise_name, "order", actual_rpe)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(workoutId, ex.exerciseId ?? null, ex.exerciseName, ex.order, ex.actualRpe ?? null)
      .lastInsertRowid as number

    for (const set of ex.sets) {
      sqlite
        .prepare(
          `INSERT INTO logged_sets (logged_exercise_id, set_number, actual_reps, actual_weight)
           VALUES (?, ?, ?, ?)`
        )
        .run(exId, set.setNumber, set.reps, set.weight)
    }
  }

  return workoutId
}

// Helper: insert exercise
function insertExercise(name: string, modality = 'resistance') {
  return sqlite
    .prepare(`INSERT INTO exercises (name, modality) VALUES (?, ?)`)
    .run(name, modality).lastInsertRowid as number
}

// Helper: insert mesocycle
function insertMeso(overrides: {
  name?: string
  start_date?: string
  end_date?: string
  work_weeks?: number
  has_deload?: number
  status?: string
} = {}) {
  return sqlite
    .prepare(
      `INSERT INTO mesocycles (name, start_date, end_date, work_weeks, has_deload, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      overrides.name ?? 'Test Meso',
      overrides.start_date ?? '2026-03-01',
      overrides.end_date ?? '2026-03-28',
      overrides.work_weeks ?? 4,
      overrides.has_deload ?? 0,
      overrides.status ?? 'planned'
    ).lastInsertRowid as number
}

// Helper: insert template
function insertTemplate(
  mesocycleId: number,
  overrides: { name?: string; canonical_name?: string; modality?: string } = {}
) {
  return sqlite
    .prepare(
      `INSERT INTO workout_templates (mesocycle_id, name, canonical_name, modality)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      mesocycleId,
      overrides.name ?? 'Push A',
      overrides.canonical_name ?? 'push-a',
      overrides.modality ?? 'resistance'
    ).lastInsertRowid as number
}

// Helper: insert exercise slot
function insertSlot(
  templateId: number,
  exerciseId: number,
  overrides: { sets?: number; reps?: string; weight?: number; rpe?: number; order?: number } = {}
) {
  return sqlite
    .prepare(
      `INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, "order")
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      templateId,
      exerciseId,
      overrides.sets ?? 3,
      overrides.reps ?? '8-12',
      overrides.weight ?? null,
      overrides.rpe ?? null,
      overrides.order ?? 1
    ).lastInsertRowid as number
}

// Helper: insert schedule entry
function insertSchedule(
  mesocycleId: number,
  dayOfWeek: number,
  templateId: number,
  overrides: { week_type?: string; period?: string; time_slot?: string } = {}
) {
  const period = overrides.period ?? 'morning'
  const timeSlot = overrides.time_slot ?? (
    period === 'morning' ? '07:00' : period === 'afternoon' ? '13:00' : '18:00'
  )
  return sqlite
    .prepare(
      `INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, duration)
       VALUES (?, ?, ?, ?, ?, ?, 90)`
    )
    .run(
      mesocycleId,
      dayOfWeek,
      templateId,
      overrides.week_type ?? 'normal',
      period,
      timeSlot
    ).lastInsertRowid as number
}

describe('getRecentSessions', () => {
  beforeEach(() => setupDb())
  afterEach(() => teardownDb())

  it('returns empty array when no workouts exist', async () => {
    const result = await getRecentSessions(db, 4)
    expect(result).toEqual([])
  })

  it('returns workouts from last N weeks in chronological order', async () => {
    const now = new Date()
    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(now.getDate() - 7)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(now.getDate() - 14)
    const fiveWeeksAgo = new Date(now)
    fiveWeeksAgo.setDate(now.getDate() - 35)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    insertLoggedWorkout({
      logDate: fmt(twoWeeksAgo),
      canonicalName: 'push-a',
      exercises: [
        { exerciseName: 'Bench Press', order: 1, sets: [{ setNumber: 1, reps: 8, weight: 80 }] },
      ],
    })

    insertLoggedWorkout({
      logDate: fmt(oneWeekAgo),
      canonicalName: 'pull-a',
      exercises: [
        { exerciseName: 'Deadlift', order: 1, sets: [{ setNumber: 1, reps: 5, weight: 140 }] },
      ],
    })

    insertLoggedWorkout({
      logDate: fmt(fiveWeeksAgo),
      canonicalName: 'legs-a',
      exercises: [
        { exerciseName: 'Squat', order: 1, sets: [{ setNumber: 1, reps: 5, weight: 100 }] },
      ],
    })

    const result = await getRecentSessions(db, 4)

    expect(result).toHaveLength(2)
    expect(result[0].logDate).toBe(fmt(twoWeeksAgo))
    expect(result[1].logDate).toBe(fmt(oneWeekAgo))
  })

  it('each workout includes exercises with exercise names', async () => {
    const now = new Date()
    const recent = new Date(now)
    recent.setDate(now.getDate() - 3)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    insertLoggedWorkout({
      logDate: fmt(recent),
      canonicalName: 'push-a',
      exercises: [
        { exerciseName: 'Bench Press', order: 1, sets: [{ setNumber: 1, reps: 8, weight: 80 }] },
        { exerciseName: 'OHP', order: 2, actualRpe: 8.5, sets: [{ setNumber: 1, reps: 10, weight: 40 }] },
      ],
    })

    const result = await getRecentSessions(db, 4)
    expect(result).toHaveLength(1)
    expect(result[0].exercises).toHaveLength(2)
    expect(result[0].exercises[0].exerciseName).toBe('Bench Press')
    expect(result[0].exercises[1].exerciseName).toBe('OHP')
    expect(result[0].exercises[1].actualRpe).toBe(8.5)
  })

  it('each exercise includes logged sets', async () => {
    const now = new Date()
    const recent = new Date(now)
    recent.setDate(now.getDate() - 2)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    insertLoggedWorkout({
      logDate: fmt(recent),
      exercises: [
        {
          exerciseName: 'Bench Press',
          order: 1,
          sets: [
            { setNumber: 1, reps: 8, weight: 80 },
            { setNumber: 2, reps: 7, weight: 80 },
            { setNumber: 3, reps: 6, weight: 80 },
          ],
        },
      ],
    })

    const result = await getRecentSessions(db, 4)
    expect(result[0].exercises[0].sets).toHaveLength(3)
    expect(result[0].exercises[0].sets[0].setNumber).toBe(1)
    expect(result[0].exercises[0].sets[0].actualReps).toBe(8)
    expect(result[0].exercises[0].sets[0].actualWeight).toBe(80)
    expect(result[0].exercises[0].sets[2].actualReps).toBe(6)
  })

  it('includes workout rating, notes, and template snapshot', async () => {
    const now = new Date()
    const recent = new Date(now)
    recent.setDate(now.getDate() - 1)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const snapshot = { version: 1, name: 'Push A', modality: 'resistance' }
    insertLoggedWorkout({
      logDate: fmt(recent),
      rating: 4,
      notes: 'Felt strong',
      canonicalName: 'push-a',
      snapshot,
      exercises: [
        { exerciseName: 'Bench Press', order: 1, sets: [{ setNumber: 1, reps: 8, weight: 80 }] },
      ],
    })

    const result = await getRecentSessions(db, 4)
    expect(result[0].rating).toBe(4)
    expect(result[0].notes).toBe('Felt strong')
    expect(result[0].canonicalName).toBe('push-a')
    expect(result[0].templateSnapshot).toEqual(snapshot)
  })

  it('respects the weeks parameter', async () => {
    const now = new Date()
    const sixteenDaysAgo = new Date(now)
    sixteenDaysAgo.setDate(now.getDate() - 16)
    const tenDaysAgo = new Date(now)
    tenDaysAgo.setDate(now.getDate() - 10)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    insertLoggedWorkout({
      logDate: fmt(sixteenDaysAgo),
      exercises: [
        { exerciseName: 'Bench Press', order: 1, sets: [{ setNumber: 1, reps: 8, weight: 80 }] },
      ],
    })

    insertLoggedWorkout({
      logDate: fmt(tenDaysAgo),
      exercises: [
        { exerciseName: 'Squat', order: 1, sets: [{ setNumber: 1, reps: 5, weight: 100 }] },
      ],
    })

    const result1 = await getRecentSessions(db, 1)
    expect(result1).toHaveLength(0)

    const result2 = await getRecentSessions(db, 2)
    expect(result2).toHaveLength(1)
    expect(result2[0].exercises[0].exerciseName).toBe('Squat')

    const result4 = await getRecentSessions(db, 4)
    expect(result4).toHaveLength(2)
  })

  it('exercises ordered by their order field', async () => {
    const now = new Date()
    const recent = new Date(now)
    recent.setDate(now.getDate() - 1)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    insertLoggedWorkout({
      logDate: fmt(recent),
      exercises: [
        { exerciseName: 'OHP', order: 2, sets: [{ setNumber: 1, reps: 10, weight: 40 }] },
        { exerciseName: 'Bench Press', order: 1, sets: [{ setNumber: 1, reps: 8, weight: 80 }] },
      ],
    })

    const result = await getRecentSessions(db, 4)
    expect(result[0].exercises[0].exerciseName).toBe('Bench Press')
    expect(result[0].exercises[1].exerciseName).toBe('OHP')
  })

  it('sets ordered by set_number', async () => {
    const now = new Date()
    const recent = new Date(now)
    recent.setDate(now.getDate() - 1)
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    insertLoggedWorkout({
      logDate: fmt(recent),
      exercises: [
        {
          exerciseName: 'Bench Press',
          order: 1,
          sets: [
            { setNumber: 3, reps: 6, weight: 80 },
            { setNumber: 1, reps: 8, weight: 80 },
            { setNumber: 2, reps: 7, weight: 80 },
          ],
        },
      ],
    })

    const result = await getRecentSessions(db, 4)
    expect(result[0].exercises[0].sets[0].setNumber).toBe(1)
    expect(result[0].exercises[0].sets[1].setNumber).toBe(2)
    expect(result[0].exercises[0].sets[2].setNumber).toBe(3)
  })
})

describe('getCurrentPlan', () => {
  beforeEach(() => setupDb())
  afterEach(() => teardownDb())

  it('returns null when no active mesocycle exists', async () => {
    const result = await getCurrentPlan(db)
    expect(result).toBeNull()
  })

  it('returns null when only planned/completed mesocycles exist', async () => {
    insertMeso({ status: 'planned' })
    insertMeso({ status: 'completed' })

    const result = await getCurrentPlan(db)
    expect(result).toBeNull()
  })

  it('returns the active mesocycle with its name, dates, and status', async () => {
    insertMeso({
      name: 'Hypertrophy Block',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      status: 'active',
    })

    const result = await getCurrentPlan(db)
    expect(result).not.toBeNull()
    expect(result!.mesocycle).toMatchObject({
      name: 'Hypertrophy Block',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      status: 'active',
    })
  })

  it('includes templates with their exercise slots and exercises', async () => {
    const mesoId = insertMeso({ status: 'active' })
    const tplId = insertTemplate(mesoId, { name: 'Push A', canonical_name: 'push-a' })
    const exId = insertExercise('Bench Press')
    insertSlot(tplId, exId, { sets: 4, reps: '6-8', weight: 80, rpe: 8 })

    const result = await getCurrentPlan(db)
    expect(result!.templates).toHaveLength(1)
    expect(result!.templates[0].name).toBe('Push A')
    expect(result!.templates[0].exercise_slots).toHaveLength(1)
    expect(result!.templates[0].exercise_slots[0]).toMatchObject({
      sets: 4,
      reps: '6-8',
      weight: 80,
      rpe: 8,
    })
    expect(result!.templates[0].exercise_slots[0].exercise_name).toBe('Bench Press')
  })

  it('includes the weekly schedule', async () => {
    const mesoId = insertMeso({ status: 'active' })
    const tplId = insertTemplate(mesoId, { name: 'Push A' })
    insertSchedule(mesoId, 1, tplId, { period: 'morning' })
    insertSchedule(mesoId, 3, tplId, { period: 'evening' })

    const result = await getCurrentPlan(db)
    expect(result!.schedule).toHaveLength(2)
    expect(result!.schedule[0]).toMatchObject({ day_of_week: 1, period: 'morning' })
    expect(result!.schedule[1]).toMatchObject({ day_of_week: 3, period: 'evening' })
  })

  it('includes schedule template name', async () => {
    const mesoId = insertMeso({ status: 'active' })
    const tplId = insertTemplate(mesoId, { name: 'Leg Day' })
    insertSchedule(mesoId, 2, tplId)

    const result = await getCurrentPlan(db)
    expect(result!.schedule[0].template_name).toBe('Leg Day')
  })

  it('handles multiple templates with multiple exercises', async () => {
    const mesoId = insertMeso({ status: 'active' })
    const tpl1 = insertTemplate(mesoId, { name: 'Push A', canonical_name: 'push-a' })
    const tpl2 = insertTemplate(mesoId, { name: 'Pull A', canonical_name: 'pull-a' })
    const ex1 = insertExercise('Bench Press')
    const ex2 = insertExercise('Overhead Press')
    const ex3 = insertExercise('Barbell Row')
    insertSlot(tpl1, ex1, { order: 1 })
    insertSlot(tpl1, ex2, { order: 2 })
    insertSlot(tpl2, ex3, { order: 1 })

    const result = await getCurrentPlan(db)
    expect(result!.templates).toHaveLength(2)

    const push = result!.templates.find((t) => t.name === 'Push A')
    const pull = result!.templates.find((t) => t.name === 'Pull A')
    expect(push!.exercise_slots).toHaveLength(2)
    expect(pull!.exercise_slots).toHaveLength(1)
  })

  it('returns templates even when they have no exercise slots', async () => {
    const mesoId = insertMeso({ status: 'active' })
    insertTemplate(mesoId, { name: 'Easy Run', canonical_name: 'easy-run', modality: 'running' })

    const result = await getCurrentPlan(db)
    expect(result!.templates).toHaveLength(1)
    expect(result!.templates[0].name).toBe('Easy Run')
    expect(result!.templates[0].exercise_slots).toHaveLength(0)
  })

  it('returns empty schedule when no schedule entries exist', async () => {
    const mesoId = insertMeso({ status: 'active' })
    insertTemplate(mesoId)

    const result = await getCurrentPlan(db)
    expect(result!.schedule).toHaveLength(0)
  })

  it('picks the first active mesocycle when multiple active exist', async () => {
    insertMeso({ name: 'First Active', status: 'active' })
    insertMeso({ name: 'Second Active', status: 'active' })

    const result = await getCurrentPlan(db)
    expect(result).not.toBeNull()
    expect(result!.mesocycle.name).toBe('First Active')
  })
})
