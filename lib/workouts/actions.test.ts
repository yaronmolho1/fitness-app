import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import type { SaveWorkoutInput } from './save-workout'
import { saveWorkoutCore } from './save-workout'

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
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER,
    created_at INTEGER
  );
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
  CREATE TABLE slot_week_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL, weight REAL, reps TEXT, sets INTEGER,
    rpe REAL, distance REAL, duration INTEGER, pace TEXT,
    planned_duration INTEGER,
    interval_count INTEGER,
    interval_rest INTEGER,
    elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0, created_at INTEGER
  );
`

const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  INSERT INTO exercises (id, name, modality, muscle_group, equipment)
  VALUES
    (10, 'Bench Press', 'resistance', 'Chest', 'Barbell'),
    (20, 'Overhead Press', 'resistance', 'Shoulders', 'Barbell');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes, coaching_cues)
  VALUES (1, 1, 'Push Day', 'push-day', 'resistance', 'Focus on chest', 'Warm up properly');

  INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines, "order", is_main)
  VALUES
    (100, 1, 10, 3, '8', 80.0, 8.0, 120, 'Pause at bottom', 1, 1),
    (101, 1, 20, 3, '10', NULL, NULL, 90, NULL, 2, 0);
`

function buildValidInput(): SaveWorkoutInput {
  return {
    templateId: 1,
    logDate: '2026-03-15',
    exercises: [
      {
        slotId: 100,
        exerciseId: 10,
        exerciseName: 'Bench Press',
        order: 1,
        rpe: 8,
        sets: [
          { reps: 8, weight: 80 },
          { reps: 8, weight: 80 },
          { reps: 7, weight: 80 },
        ],
      },
      {
        slotId: 101,
        exerciseId: 20,
        exerciseName: 'Overhead Press',
        order: 2,
        rpe: null,
        sets: [
          { reps: 10, weight: 40 },
          { reps: 10, weight: 40 },
          { reps: 9, weight: 40 },
        ],
      },
    ],
    rating: 4,
    notes: 'Good session',
  }
}

describe('saveWorkoutCore', () => {
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

  it('creates logged_workouts + logged_exercises + logged_sets', async () => {
    const result = await saveWorkoutCore(db, buildValidInput())
    expect(result.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    const exercises = db.select().from(schema.logged_exercises).all()
    const sets = db.select().from(schema.logged_sets).all()

    expect(workouts).toHaveLength(1)
    expect(exercises).toHaveLength(2)
    expect(sets).toHaveLength(6)
  })

  it('stores template_snapshot with version:2', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_snapshot.version).toBe(2)
  })

  it('template_snapshot includes all exercise slot fields', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as {
      version: number
      name: string
      modality: string
      notes: string | null
      coaching_cues: string | null
      slots: Array<{
        exercise_name: string
        target_sets: number
        target_reps: string
        target_weight: number | null
        target_rpe: number | null
        rest_seconds: number | null
        guidelines: string | null
        sort_order: number
        is_main: boolean
      }>
    }

    expect(snapshot.name).toBe('Push Day')
    expect(snapshot.modality).toBe('resistance')
    expect(snapshot.notes).toBe('Focus on chest')
    expect(snapshot.coaching_cues).toBe('Warm up properly')
    expect(snapshot.slots).toHaveLength(2)

    const slot0 = snapshot.slots[0]
    expect(slot0.exercise_name).toBe('Bench Press')
    expect(slot0.target_sets).toBe(3)
    expect(slot0.target_reps).toBe('8')
    expect(slot0.target_weight).toBe(80)
    expect(slot0.target_rpe).toBe(8)
    expect(slot0.rest_seconds).toBe(120)
    expect(slot0.guidelines).toBe('Pause at bottom')
    expect(slot0.sort_order).toBe(1)
    expect(slot0.is_main).toBe(true)

    const slot1 = snapshot.slots[1]
    expect(slot1.exercise_name).toBe('Overhead Press')
    expect(slot1.target_weight).toBeNull()
    expect(slot1.target_rpe).toBeNull()
    expect(slot1.guidelines).toBeNull()
    expect(slot1.is_main).toBe(false)
  })

  it('copies canonical_name from template', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.canonical_name).toBe('push-day')
  })

  it('stores template_id on logged_workouts', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_id).toBe(1)
  })

  it('stores log_date as YYYY-MM-DD', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.log_date).toBe('2026-03-15')
  })

  it('stores logged_at as a timestamp close to now', async () => {
    // integer({ mode: 'timestamp' }) stores seconds, so round to seconds
    const beforeSec = Math.floor(Date.now() / 1000)
    await saveWorkoutCore(db, buildValidInput())
    const afterSec = Math.ceil(Date.now() / 1000)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const loggedAt = workout.logged_at as Date
    const loggedAtSec = Math.floor(loggedAt.getTime() / 1000)
    expect(loggedAtSec).toBeGreaterThanOrEqual(beforeSec)
    expect(loggedAtSec).toBeLessThanOrEqual(afterSec)
  })

  it('stores rating when provided', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBe(4)
  })

  it('stores null rating when not provided', async () => {
    const input = buildValidInput()
    input.rating = null
    await saveWorkoutCore(db, input)
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBeNull()
  })

  it('stores notes when provided', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBe('Good session')
  })

  it('normalizes whitespace-only notes to null', async () => {
    const input = buildValidInput()
    input.notes = '   \n  '
    await saveWorkoutCore(db, input)
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBeNull()
  })

  it('stores null notes when not provided', async () => {
    const input = buildValidInput()
    input.notes = null
    await saveWorkoutCore(db, input)
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBeNull()
  })

  it('stores exercise_name, exercise_id, and order on logged_exercises', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const exercises = db
      .select()
      .from(schema.logged_exercises)
      .orderBy(schema.logged_exercises.order)
      .all()

    expect(exercises[0].exercise_name).toBe('Bench Press')
    expect(exercises[0].exercise_id).toBe(10)
    expect(exercises[0].order).toBe(1)

    expect(exercises[1].exercise_name).toBe('Overhead Press')
    expect(exercises[1].exercise_id).toBe(20)
    expect(exercises[1].order).toBe(2)
  })

  it('stores actual_reps, actual_weight on logged_sets', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()

    expect(sets[0].actual_reps).toBe(8)
    expect(sets[0].actual_weight).toBe(80)
    expect(sets[0].set_number).toBe(1)
  })

  it('stores actual_rpe on logged_exercises', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const exercises = db
      .select()
      .from(schema.logged_exercises)
      .orderBy(schema.logged_exercises.order)
      .all()

    expect(exercises[0].actual_rpe).toBe(8)
    expect(exercises[1].actual_rpe).toBeNull()
  })

  it('stores null actual_weight when slot has no planned weight', async () => {
    // Slot 101 (OHP) has weight=NULL, so null input stays null after fallback
    const input = buildValidInput()
    input.exercises[1].sets[0] = { reps: 10, weight: null }
    await saveWorkoutCore(db, input)
    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()

    // OHP sets start at index 3
    expect(sets[3].actual_weight).toBeNull()
  })

  it('logged_exercises reference correct logged_workout_id', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const exercises = db.select().from(schema.logged_exercises).all()

    for (const ex of exercises) {
      expect(ex.logged_workout_id).toBe(workout.id)
    }
  })

  it('logged_sets reference correct logged_exercise_id', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const exercises = db
      .select()
      .from(schema.logged_exercises)
      .orderBy(schema.logged_exercises.order)
      .all()
    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()

    for (let i = 0; i < 3; i++) {
      expect(sets[i].logged_exercise_id).toBe(exercises[0].id)
    }
    for (let i = 3; i < 6; i++) {
      expect(sets[i].logged_exercise_id).toBe(exercises[1].id)
    }
  })

  it('set_number is sequential per exercise starting at 1', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const exercises = db
      .select()
      .from(schema.logged_exercises)
      .orderBy(schema.logged_exercises.order)
      .all()

    for (const ex of exercises) {
      const exSets = db
        .select()
        .from(schema.logged_sets)
        .where(sql`logged_exercise_id = ${ex.id}`)
        .orderBy(schema.logged_sets.set_number)
        .all()

      exSets.forEach((s, i) => {
        expect(s.set_number).toBe(i + 1)
      })
    }
  })

  // --- Validation errors ---

  it('fails when template not found', async () => {
    const input = buildValidInput()
    input.templateId = 999
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('fails when logDate is invalid', async () => {
    const input = buildValidInput()
    input.logDate = 'not-a-date'
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/date/i)
  })

  it('fails when exercises array is empty', async () => {
    const input = buildValidInput()
    input.exercises = []
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/exercise/i)
  })

  it('fails when a set has reps = 0', async () => {
    const input = buildValidInput()
    input.exercises[0].sets[0].reps = 0
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/reps/i)
  })

  it('fails when a set has negative reps', async () => {
    const input = buildValidInput()
    input.exercises[0].sets[0].reps = -1
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/reps/i)
  })

  it('fails when actual_weight is negative', async () => {
    const input = buildValidInput()
    input.exercises[0].sets[0].weight = -5
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/weight/i)
  })

  it('allows actual_weight of 0 (bodyweight)', async () => {
    const input = buildValidInput()
    input.exercises[0].sets[0].weight = 0
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)
  })

  it('fails when actual_rpe is out of 1-10 range', async () => {
    const input = buildValidInput()
    input.exercises[0].rpe = 11
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/rpe/i)

    const input0 = buildValidInput()
    input0.exercises[0].rpe = 0
    const result0 = await saveWorkoutCore(db, input0)
    expect(result0.success).toBe(false)
    if (!result0.success) expect(result0.error).toMatch(/rpe/i)
  })

  it('validates rating range 1-5', async () => {
    const input6 = buildValidInput()
    input6.rating = 6
    expect((await saveWorkoutCore(db, input6)).success).toBe(false)

    const input0 = buildValidInput()
    input0.rating = 0
    expect((await saveWorkoutCore(db, input0)).success).toBe(false)
  })

  // --- Duplicate prevention ---

  it('rejects duplicate log for same date + mesocycle', async () => {
    const input = buildValidInput()
    const first = await saveWorkoutCore(db, input)
    expect(first.success).toBe(true)

    const second = await saveWorkoutCore(db, input)
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toMatch(/already logged/i)
  })

  it('allows logging on different date for same mesocycle', async () => {
    await saveWorkoutCore(db, buildValidInput())
    const input2 = buildValidInput()
    input2.logDate = '2026-03-16'
    const result = await saveWorkoutCore(db, input2)
    expect(result.success).toBe(true)
  })

  it('allows logging on same date for different mesocycle', async () => {
    await saveWorkoutCore(db, buildValidInput())

    // Create second mesocycle + template
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
      VALUES (2, 'Block B', '2026-04-01', '2026-05-01', 4, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 2, 'Pull Day', 'pull-day', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (200, 2, 10, 3, '8', 1, 1);
    `)

    const input2 = buildValidInput()
    input2.templateId = 2
    const result = await saveWorkoutCore(db, input2)
    expect(result.success).toBe(true)
  })

  // --- Empty input fallback ---

  it('set 1 falls back to planned weight/reps when null', async () => {
    // Slot 100: weight=80, reps='8'
    const input = buildValidInput()
    input.exercises[0].sets = [
      { reps: null, weight: null },
      { reps: 8, weight: 80 },
      { reps: 7, weight: 80 },
    ]
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)

    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()
    // Set 1 should fall back to planned: weight=80, reps=8
    expect(sets[0].actual_weight).toBe(80)
    expect(sets[0].actual_reps).toBe(8)
  })

  it('set 2+ falls back to previous set values when null', async () => {
    const input = buildValidInput()
    input.exercises[0].sets = [
      { reps: 10, weight: 85 },
      { reps: null, weight: null },
      { reps: null, weight: null },
    ]
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)

    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()
    // Set 2 and 3 should fall back to set 1: weight=85, reps=10
    expect(sets[1].actual_weight).toBe(85)
    expect(sets[1].actual_reps).toBe(10)
    expect(sets[2].actual_weight).toBe(85)
    expect(sets[2].actual_reps).toBe(10)
  })

  it('set 2 falls back to planned when set 1 was also null', async () => {
    // Both set 1 and 2 null — set 1 falls back to planned, set 2 falls back to resolved set 1
    const input = buildValidInput()
    input.exercises[0].sets = [
      { reps: null, weight: null },
      { reps: null, weight: null },
      { reps: 7, weight: 80 },
    ]
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)

    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()
    // Set 1 → planned (80, 8). Set 2 → set 1 resolved (80, 8).
    expect(sets[0].actual_weight).toBe(80)
    expect(sets[0].actual_reps).toBe(8)
    expect(sets[1].actual_weight).toBe(80)
    expect(sets[1].actual_reps).toBe(8)
  })

  it('partial null: only weight null falls back, reps kept', async () => {
    const input = buildValidInput()
    input.exercises[0].sets = [
      { reps: 6, weight: null },
      { reps: 8, weight: 80 },
      { reps: 7, weight: 80 },
    ]
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)

    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()
    // Set 1: reps=6 (explicit), weight=80 (planned fallback)
    expect(sets[0].actual_reps).toBe(6)
    expect(sets[0].actual_weight).toBe(80)
  })

  it('slot with no planned weight: null weight stays null on fallback', async () => {
    // Slot 101 (Overhead Press) has weight=NULL in template
    const input = buildValidInput()
    input.exercises[1].sets = [
      { reps: null, weight: null },
      { reps: 10, weight: 40 },
      { reps: 9, weight: 40 },
    ]
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)

    const sets = db.select().from(schema.logged_sets).orderBy(schema.logged_sets.id).all()
    // Exercise 2 sets start at index 3. Set 1 falls back to planned: weight=null, reps=10
    expect(sets[3].actual_weight).toBeNull()
    expect(sets[3].actual_reps).toBe(10)
  })

  // --- Transaction rollback ---

  it('rolls back on DB error — no partial rows', async () => {
    const brokenSqlite = new Database(':memory:')
    brokenSqlite.pragma('foreign_keys = ON')
    const brokenDb = drizzle(brokenSqlite, { schema: { ...schema, ...relationsModule } }) as AppDb

    // Create all tables EXCEPT logged_sets to force mid-transaction failure
    brokenSqlite.exec(`
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
        mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id),
        name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
        notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
        interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
        planned_duration INTEGER, created_at INTEGER
      );
      CREATE TABLE exercise_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES workout_templates(id),
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER,
        sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
        rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER, guidelines TEXT, "order" INTEGER NOT NULL,
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
        logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id),
        exercise_id INTEGER, exercise_name TEXT NOT NULL,
        "order" INTEGER NOT NULL, actual_rpe REAL, created_at INTEGER
      );
    `)

    brokenSqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
      VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (10, 'Bench Press', 'resistance'), (20, 'Overhead Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push Day', 'push-day', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (100, 1, 10, 3, '8', 1, 1), (101, 1, 20, 3, '10', 2, 0);
    `)

    const result = await saveWorkoutCore(brokenDb, buildValidInput())
    expect(result.success).toBe(false)

    // Verify rollback: no partial rows
    const workouts = brokenDb.select().from(schema.logged_workouts).all()
    const exercises = brokenDb.select().from(schema.logged_exercises).all()
    expect(workouts).toHaveLength(0)
    expect(exercises).toHaveLength(0)

    brokenSqlite.close()
  })
})
