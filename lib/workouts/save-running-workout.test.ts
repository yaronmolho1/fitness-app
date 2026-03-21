import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import {
  saveRunningWorkoutCore,
  type SaveRunningWorkoutInput,
} from './save-running-workout'

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
    target_distance REAL, target_duration INTEGER,
    planned_duration INTEGER, created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER,
    sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
    rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER, guidelines TEXT, "order" INTEGER NOT NULL,
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

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, target_pace, hr_zone, coaching_cues)
  VALUES (10, 1, 'Tuesday Tempo', 'tuesday-tempo', 'running', 'tempo', '5:30/km', 3, 'Stay relaxed');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, target_pace, hr_zone, interval_count, interval_rest, coaching_cues)
  VALUES (11, 1, 'Thursday Intervals', 'thursday-intervals', 'running', 'interval', '4:00/km', 4, 6, 90, 'Hard effort on reps');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, coaching_cues)
  VALUES (12, 1, 'Sunday Long', 'sunday-long', 'running', 'long', null);

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes)
  VALUES (20, 1, 'Push Day', 'push-day', 'resistance', 'Chest focus');
`

function buildValidInput(overrides?: Partial<SaveRunningWorkoutInput>): SaveRunningWorkoutInput {
  return {
    templateId: 10,
    logDate: '2026-03-15',
    actualDistance: 8.5,
    actualAvgPace: '5:32/km',
    actualAvgHr: 155,
    rating: 4,
    notes: 'Felt strong today',
    ...overrides,
  }
}

describe('saveRunningWorkoutCore', () => {
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
    const result = await saveRunningWorkoutCore(db, buildValidInput())
    expect(result.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    const exercises = db.select().from(schema.logged_exercises).all()
    const sets = db.select().from(schema.logged_sets).all()

    expect(workouts).toHaveLength(1)
    expect(exercises).toHaveLength(0)
    expect(sets).toHaveLength(0)
  })

  it('copies canonical_name from template', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.canonical_name).toBe('tuesday-tempo')
  })

  it('stores template_id on logged_workouts', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_id).toBe(10)
  })

  it('stores log_date as YYYY-MM-DD', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.log_date).toBe('2026-03-15')
  })

  it('stores logged_at as timestamp close to now', async () => {
    const beforeSec = Math.floor(Date.now() / 1000)
    await saveRunningWorkoutCore(db, buildValidInput())
    const afterSec = Math.ceil(Date.now() / 1000)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const loggedAt = workout.logged_at as Date
    const loggedAtSec = Math.floor(loggedAt.getTime() / 1000)
    expect(loggedAtSec).toBeGreaterThanOrEqual(beforeSec)
    expect(loggedAtSec).toBeLessThanOrEqual(afterSec)
  })

  it('stores rating when provided', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBe(4)
  })

  it('stores null rating when not provided', async () => {
    await saveRunningWorkoutCore(db, buildValidInput({ rating: null }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBeNull()
  })

  it('stores notes when provided', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBe('Felt strong today')
  })

  it('normalizes whitespace-only notes to null', async () => {
    await saveRunningWorkoutCore(db, buildValidInput({ notes: '   \n  ' }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBeNull()
  })

  // --- Template snapshot ---

  it('stores template_snapshot with version:1', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_snapshot.version).toBe(1)
  })

  it('template_snapshot includes all running template fields', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.version).toBe(1)
    expect(snapshot.name).toBe('Tuesday Tempo')
    expect(snapshot.modality).toBe('running')
    expect(snapshot.run_type).toBe('tempo')
    expect(snapshot.target_pace).toBe('5:30/km')
    expect(snapshot.hr_zone).toBe(3)
    expect(snapshot.coaching_cues).toBe('Stay relaxed')
    expect(snapshot.interval_count).toBeNull()
    expect(snapshot.interval_rest).toBeNull()
  })

  it('template_snapshot includes interval fields for interval run', async () => {
    await saveRunningWorkoutCore(db, buildValidInput({ templateId: 11 }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.run_type).toBe('interval')
    expect(snapshot.interval_count).toBe(6)
    expect(snapshot.interval_rest).toBe(90)
  })

  // --- Running actuals in snapshot ---

  it('stores actual_distance in template_snapshot', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.actual_distance).toBe(8.5)
  })

  it('stores actual_avg_pace in template_snapshot', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.actual_avg_pace).toBe('5:32/km')
  })

  it('stores actual_avg_hr in template_snapshot', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.actual_avg_hr).toBe(155)
  })

  it('stores null actuals when all fields blank', async () => {
    await saveRunningWorkoutCore(
      db,
      buildValidInput({
        actualDistance: null,
        actualAvgPace: null,
        actualAvgHr: null,
      })
    )
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.actual_distance).toBeNull()
    expect(snapshot.actual_avg_pace).toBeNull()
    expect(snapshot.actual_avg_hr).toBeNull()
  })

  it('saves successfully with all actuals blank (just noting the run happened)', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({
        actualDistance: null,
        actualAvgPace: null,
        actualAvgHr: null,
        rating: null,
        notes: null,
      })
    )
    expect(result.success).toBe(true)
  })

  // --- Validation ---

  it('fails when template not found', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 999 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('fails when template is not a running modality', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 20 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/running/i)
  })

  it('fails when logDate is invalid', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ logDate: 'not-a-date' })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/date/i)
  })

  it('fails when actual_distance is negative', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualDistance: -1 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/distance/i)
  })

  it('allows actual_distance of 0', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualDistance: 0 })
    )
    expect(result.success).toBe(true)
  })

  it('fails when actual_avg_hr is 0', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualAvgHr: 0 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/hr/i)
  })

  it('fails when actual_avg_hr is negative', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualAvgHr: -10 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/hr/i)
  })

  it('fails when actual_avg_hr is not an integer', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualAvgHr: 155.5 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/hr/i)
  })

  it('allows null actual_avg_hr', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualAvgHr: null })
    )
    expect(result.success).toBe(true)
  })

  it('stores arbitrary actual_avg_pace text as-is', async () => {
    await saveRunningWorkoutCore(
      db,
      buildValidInput({ actualAvgPace: 'about 6 min/km maybe' })
    )
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.actual_avg_pace).toBe('about 6 min/km maybe')
  })

  it('validates rating range 1-5', async () => {
    const result6 = await saveRunningWorkoutCore(
      db,
      buildValidInput({ rating: 6 })
    )
    expect(result6.success).toBe(false)

    const result0 = await saveRunningWorkoutCore(
      db,
      buildValidInput({ rating: 0 })
    )
    expect(result0.success).toBe(false)
  })

  it('rejects non-integer rating', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ rating: 3.5 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/integer/i)
  })

  // --- Duplicate prevention ---

  it('rejects duplicate log for same date + mesocycle', async () => {
    const first = await saveRunningWorkoutCore(db, buildValidInput())
    expect(first.success).toBe(true)

    const second = await saveRunningWorkoutCore(db, buildValidInput())
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toMatch(/already logged/i)
  })

  it('allows logging on different date for same mesocycle', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ logDate: '2026-03-16' })
    )
    expect(result.success).toBe(true)
  })

  it('allows logging on same date for different mesocycle', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
      VALUES (2, 'Block B', '2026-04-01', '2026-05-01', 4, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type)
      VALUES (50, 2, 'Easy Run B', 'easy-run-b', 'running', 'easy');
    `)

    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 50 })
    )
    expect(result.success).toBe(true)
  })

  // --- Atomicity ---

  it('is atomic — uses transaction', async () => {
    // Save two workouts — both should succeed independently
    const result1 = await saveRunningWorkoutCore(db, buildValidInput())
    const result2 = await saveRunningWorkoutCore(
      db,
      buildValidInput({ logDate: '2026-03-16' })
    )

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    expect(workouts).toHaveLength(2)
  })

  // --- Template with missing optional fields ---

  it('handles template with no target_pace or hr_zone', async () => {
    await saveRunningWorkoutCore(db, buildValidInput({ templateId: 12 }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.target_pace).toBeNull()
    expect(snapshot.hr_zone).toBeNull()
    expect(snapshot.coaching_cues).toBeNull()
  })

  // --- Interval data ---

  it('stores interval_data as JSON array in template_snapshot for interval run', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: '4:55/km', interval_avg_hr: 170, interval_notes: null },
      { rep_number: 2, interval_pace: '4:50/km', interval_avg_hr: 175, interval_notes: 'legs heavy' },
      { rep_number: 3, interval_pace: null, interval_avg_hr: null, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.interval_data).toEqual(intervalData)
  })

  it('stores interval_data as null when not provided for interval run', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11 })
    )
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.interval_data).toBeNull()
  })

  it('stores interval_data as null for non-interval run types', async () => {
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 10 })
    )
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.interval_data).toBeNull()
  })

  it('ignores intervalData input for non-interval run types', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: '5:00/km', interval_avg_hr: 150, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 10, intervalData })
    )
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.interval_data).toBeNull()
  })

  it('validates interval_avg_hr must be positive integer when provided', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: null, interval_avg_hr: 0, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/hr/i)
  })

  it('validates interval_avg_hr rejects negative values', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: null, interval_avg_hr: -5, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/hr/i)
  })

  it('validates interval_avg_hr rejects non-integer values', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: null, interval_avg_hr: 170.5, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/hr/i)
  })

  it('allows null interval_avg_hr in interval data', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: '4:55/km', interval_avg_hr: null, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(true)
  })

  it('saves successfully with all interval fields blank', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: null, interval_avg_hr: null, interval_notes: null },
      { rep_number: 2, interval_pace: null, interval_avg_hr: null, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.interval_data).toEqual(intervalData)
  })

  it('stores interval_pace as-is (free text)', async () => {
    const intervalData = [
      { rep_number: 1, interval_pace: 'about 5 min flat', interval_avg_hr: null, interval_notes: null },
    ]
    const result = await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const data = snapshot.interval_data as Array<Record<string, unknown>>
    expect(data[0].interval_pace).toBe('about 5 min flat')
  })
})
