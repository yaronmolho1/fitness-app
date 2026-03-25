import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getRecentSessions } from './queries'

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
    target_distance REAL, target_duration INTEGER,
    planned_duration INTEGER,
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

describe('getRecentSessions', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
    sqlite.exec(CREATE_SQL)
  })

  afterEach(() => {
    sqlite?.close()
  })

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
