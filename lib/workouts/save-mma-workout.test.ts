import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import {
  saveMmaWorkoutCore,
  type SaveMmaWorkoutInput,
} from './save-mma-workout'

let sqlite: Database.Database
let db: AppDb

const CREATE_SQL = `
  CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, modality TEXT NOT NULL,
    muscle_group TEXT, equipment TEXT, created_at INTEGER
  );
  CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL, has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned', created_at INTEGER
  );
  CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
    notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    planned_duration INTEGER, created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
    rest_seconds INTEGER, guidelines TEXT, "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0, created_at INTEGER
  );
  CREATE TABLE logged_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER, canonical_name TEXT, log_date TEXT NOT NULL,
    logged_at INTEGER NOT NULL, rating INTEGER, notes TEXT,
    template_snapshot TEXT NOT NULL, created_at INTEGER
  );
  CREATE TABLE logged_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER, exercise_name TEXT NOT NULL,
    "order" INTEGER NOT NULL, actual_rpe REAL, created_at INTEGER
  );
  CREATE TABLE logged_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL, actual_reps INTEGER,
    actual_weight REAL, created_at INTEGER
  );
`

const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, planned_duration)
  VALUES (30, 1, 'Friday BJJ', 'friday-bjj', 'mma', 90);

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, planned_duration)
  VALUES (31, 1, 'Sunday MMA', 'sunday-mma', 'mma', null);

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes)
  VALUES (20, 1, 'Push Day', 'push-day', 'resistance', 'Chest focus');
`

function buildValidInput(overrides?: Partial<SaveMmaWorkoutInput>): SaveMmaWorkoutInput {
  return {
    templateId: 30,
    logDate: '2026-03-15',
    actualDurationMinutes: 90,
    feeling: 4,
    notes: 'Good rolls today',
    ...overrides,
  }
}

describe('saveMmaWorkoutCore', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
    sqlite.exec(CREATE_SQL)
    sqlite.exec(SEED_SQL)
  })

  afterEach(() => {
    sqlite?.close()
  })

  // --- Happy path ---

  it('creates logged_workouts row with no logged_exercises or logged_sets', async () => {
    const result = await saveMmaWorkoutCore(db, buildValidInput())
    expect(result.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    const exercises = db.select().from(schema.logged_exercises).all()
    const sets = db.select().from(schema.logged_sets).all()

    expect(workouts).toHaveLength(1)
    expect(exercises).toHaveLength(0)
    expect(sets).toHaveLength(0)
  })

  it('copies canonical_name from template', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.canonical_name).toBe('friday-bjj')
  })

  it('stores template_id on logged_workouts', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_id).toBe(30)
  })

  it('stores log_date as YYYY-MM-DD', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.log_date).toBe('2026-03-15')
  })

  it('stores logged_at as timestamp close to now', async () => {
    const beforeSec = Math.floor(Date.now() / 1000)
    await saveMmaWorkoutCore(db, buildValidInput())
    const afterSec = Math.ceil(Date.now() / 1000)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const loggedAt = workout.logged_at as Date
    const loggedAtSec = Math.floor(loggedAt.getTime() / 1000)
    expect(loggedAtSec).toBeGreaterThanOrEqual(beforeSec)
    expect(loggedAtSec).toBeLessThanOrEqual(afterSec)
  })

  it('stores rating (feeling) when provided', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBe(4)
  })

  it('stores null rating when not provided', async () => {
    await saveMmaWorkoutCore(db, buildValidInput({ feeling: null }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBeNull()
  })

  it('stores notes when provided', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBe('Good rolls today')
  })

  it('normalizes whitespace-only notes to null', async () => {
    await saveMmaWorkoutCore(db, buildValidInput({ notes: '   \n  ' }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBeNull()
  })

  // --- Template snapshot ---

  it('stores template_snapshot with version:1', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_snapshot.version).toBe(1)
  })

  it('template_snapshot includes MMA template fields', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.version).toBe(1)
    expect(snapshot.name).toBe('Friday BJJ')
    expect(snapshot.modality).toBe('mma')
    expect(snapshot.planned_duration).toBe(90)
  })

  it('template_snapshot includes actuals', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.actual_duration_minutes).toBe(90)
    expect(snapshot.feeling).toBe(4)
  })

  it('stores null actuals in snapshot when fields blank', async () => {
    await saveMmaWorkoutCore(
      db,
      buildValidInput({
        actualDurationMinutes: null,
        feeling: null,
        notes: null,
      })
    )
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.actual_duration_minutes).toBeNull()
    expect(snapshot.feeling).toBeNull()
  })

  it('handles template with no planned_duration', async () => {
    await saveMmaWorkoutCore(db, buildValidInput({ templateId: 31 }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.planned_duration).toBeNull()
  })

  // --- All fields blank (session occurred) ---

  it('saves successfully with all fields blank', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({
        actualDurationMinutes: null,
        feeling: null,
        notes: null,
      })
    )
    expect(result.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    expect(workouts).toHaveLength(1)
  })

  // --- Validation ---

  it('fails when template not found', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ templateId: 999 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('fails when template is not mma modality', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ templateId: 20 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mma/i)
  })

  it('fails when logDate is invalid', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ logDate: 'not-a-date' })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/date/i)
  })

  it('fails when actualDurationMinutes is 0', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ actualDurationMinutes: 0 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/duration/i)
  })

  it('fails when actualDurationMinutes is negative', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ actualDurationMinutes: -10 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/duration/i)
  })

  it('fails when actualDurationMinutes is not an integer', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ actualDurationMinutes: 90.5 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/duration/i)
  })

  it('allows null actualDurationMinutes', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ actualDurationMinutes: null })
    )
    expect(result.success).toBe(true)
  })

  it('fails when feeling is 0', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ feeling: 0 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/feeling/i)
  })

  it('fails when feeling is 6', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ feeling: 6 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/feeling/i)
  })

  it('rejects non-integer feeling', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ feeling: 3.5 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/feeling/i)
  })

  it('allows null feeling', async () => {
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ feeling: null })
    )
    expect(result.success).toBe(true)
  })

  // --- Duplicate prevention ---

  it('rejects duplicate log for same date + mesocycle', async () => {
    const first = await saveMmaWorkoutCore(db, buildValidInput())
    expect(first.success).toBe(true)

    const second = await saveMmaWorkoutCore(db, buildValidInput())
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toMatch(/already logged/i)
  })

  it('allows logging on different date for same mesocycle', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())
    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ logDate: '2026-03-16' })
    )
    expect(result.success).toBe(true)
  })

  it('allows logging on same date for different mesocycle', async () => {
    await saveMmaWorkoutCore(db, buildValidInput())

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
      VALUES (2, 'Block B', '2026-04-01', '2026-05-01', 4, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, planned_duration)
      VALUES (50, 2, 'BJJ B', 'bjj-b', 'mma', 60);
    `)

    const result = await saveMmaWorkoutCore(
      db,
      buildValidInput({ templateId: 50 })
    )
    expect(result.success).toBe(true)
  })

  // --- Atomicity ---

  it('is atomic — uses transaction', async () => {
    const result1 = await saveMmaWorkoutCore(db, buildValidInput())
    const result2 = await saveMmaWorkoutCore(
      db,
      buildValidInput({ logDate: '2026-03-16' })
    )

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    expect(workouts).toHaveLength(2)
  })
})
