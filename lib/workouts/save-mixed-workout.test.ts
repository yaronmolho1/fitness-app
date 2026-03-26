import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import {
  saveMixedWorkoutCore,
  type SaveMixedWorkoutInput,
} from './save-mixed-workout'

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
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, created_at INTEGER
  );
  CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL,
    section_name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
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

  INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
  INSERT INTO exercises (id, name, modality) VALUES (2, 'Squat', 'resistance');

  -- Mixed template with 2 sections: resistance + running
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes)
  VALUES (100, 1, 'Strength + Cardio', 'strength-cardio', 'mixed', 'Full session');

  INSERT INTO template_sections (id, template_id, modality, section_name, "order", run_type, target_pace, hr_zone)
  VALUES (1, 100, 'resistance', 'Main Lift', 1, null, null, null);

  INSERT INTO template_sections (id, template_id, modality, section_name, "order", run_type, target_pace, hr_zone, coaching_cues, target_distance, target_duration)
  VALUES (2, 100, 'running', 'Cooldown Run', 2, 'easy', '6:00/km', 2, 'Stay relaxed', 3.0, 20);

  INSERT INTO exercise_slots (id, template_id, exercise_id, section_id, sets, reps, weight, rpe, "order", is_main)
  VALUES (1, 100, 1, 1, 4, '8', 80, 8, 1, 1);

  INSERT INTO exercise_slots (id, template_id, exercise_id, section_id, sets, reps, weight, "order", is_main)
  VALUES (2, 100, 2, 1, 3, '10', 100, 2, 0);

  -- Mixed template with 3 sections: resistance + running + mma
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (101, 1, 'Full Session', 'full-session', 'mixed');

  INSERT INTO template_sections (id, template_id, modality, section_name, "order")
  VALUES (3, 101, 'resistance', 'Strength', 1);

  INSERT INTO template_sections (id, template_id, modality, section_name, "order", run_type, target_pace, target_distance)
  VALUES (4, 101, 'running', 'Cardio', 2, 'tempo', '5:00/km', 5.0);

  INSERT INTO template_sections (id, template_id, modality, section_name, "order", planned_duration)
  VALUES (5, 101, 'mma', 'Sparring', 3, 30);

  INSERT INTO exercise_slots (id, template_id, exercise_id, section_id, sets, reps, weight, "order", is_main)
  VALUES (3, 101, 1, 3, 3, '5', 90, 1, 1);

  -- Non-mixed template for validation test
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (20, 1, 'Push Day', 'push-day', 'resistance');
`

function buildValidInput(overrides?: Partial<SaveMixedWorkoutInput>): SaveMixedWorkoutInput {
  return {
    templateId: 100,
    logDate: '2026-03-15',
    sections: [
      {
        sectionId: 1,
        modality: 'resistance',
        exercises: [
          {
            slotId: 1,
            exerciseId: 1,
            exerciseName: 'Bench Press',
            order: 1,
            rpe: 8,
            sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }, { reps: 7, weight: 80 }, { reps: 6, weight: 80 }],
          },
          {
            slotId: 2,
            exerciseId: 2,
            exerciseName: 'Squat',
            order: 2,
            rpe: 7,
            sets: [{ reps: 10, weight: 100 }, { reps: 10, weight: 100 }, { reps: 9, weight: 100 }],
          },
        ],
      },
      {
        sectionId: 2,
        modality: 'running',
        actualDistance: 3.0,
        actualAvgPace: '6:05/km',
        actualAvgHr: 140,
      },
    ],
    rating: 4,
    notes: 'Great combo session',
    ...overrides,
  }
}

function build3SectionInput(): SaveMixedWorkoutInput {
  return {
    templateId: 101,
    logDate: '2026-03-15',
    sections: [
      {
        sectionId: 3,
        modality: 'resistance',
        exercises: [
          {
            slotId: 3,
            exerciseId: 1,
            exerciseName: 'Bench Press',
            order: 1,
            rpe: 9,
            sets: [{ reps: 5, weight: 90 }, { reps: 5, weight: 90 }, { reps: 4, weight: 90 }],
          },
        ],
      },
      {
        sectionId: 4,
        modality: 'running',
        actualDistance: 5.0,
        actualAvgPace: '5:10/km',
        actualAvgHr: 165,
      },
      {
        sectionId: 5,
        modality: 'mma',
        actualDurationMinutes: 25,
        feeling: 4,
      },
    ],
    rating: 5,
    notes: null,
  }
}

describe('saveMixedWorkoutCore', () => {
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

  it('creates a logged_workouts row', async () => {
    const result = await saveMixedWorkoutCore(db, buildValidInput())
    expect(result.success).toBe(true)

    const workouts = db.select().from(schema.logged_workouts).all()
    expect(workouts).toHaveLength(1)
  })

  it('creates logged_exercises and logged_sets for resistance sections', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())

    const exercises = db.select().from(schema.logged_exercises).all()
    const sets = db.select().from(schema.logged_sets).all()

    // 2 exercises from resistance section
    expect(exercises).toHaveLength(2)
    // 4 sets for bench + 3 sets for squat = 7
    expect(sets).toHaveLength(7)
  })

  it('does NOT create logged_exercises for running sections', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())

    const exercises = db.select().from(schema.logged_exercises).all()
    // Only resistance exercises, not running
    expect(exercises.every(e => e.exercise_name !== 'Cooldown Run')).toBe(true)
  })

  it('copies canonical_name from template', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.canonical_name).toBe('strength-cardio')
  })

  it('stores template_id on logged_workouts', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_id).toBe(100)
  })

  it('stores log_date as YYYY-MM-DD', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.log_date).toBe('2026-03-15')
  })

  it('stores logged_at as timestamp close to now', async () => {
    const beforeSec = Math.floor(Date.now() / 1000)
    await saveMixedWorkoutCore(db, buildValidInput())
    const afterSec = Math.ceil(Date.now() / 1000)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const loggedAt = workout.logged_at as Date
    const loggedAtSec = Math.floor(loggedAt.getTime() / 1000)
    expect(loggedAtSec).toBeGreaterThanOrEqual(beforeSec)
    expect(loggedAtSec).toBeLessThanOrEqual(afterSec)
  })

  it('stores rating when provided', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBe(4)
  })

  it('stores null rating when not provided', async () => {
    await saveMixedWorkoutCore(db, buildValidInput({ rating: null }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.rating).toBeNull()
  })

  it('stores notes when provided', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBe('Great combo session')
  })

  it('normalizes whitespace-only notes to null', async () => {
    await saveMixedWorkoutCore(db, buildValidInput({ notes: '   \n  ' }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.notes).toBeNull()
  })

  // --- Template snapshot v2 ---

  it('stores template_snapshot with version:2', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    expect(workout.template_snapshot.version).toBe(2)
  })

  it('template_snapshot includes modality=mixed', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.modality).toBe('mixed')
  })

  it('template_snapshot includes template name', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    expect(snapshot.name).toBe('Strength + Cardio')
  })

  it('template_snapshot includes sections array', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    expect(sections).toHaveLength(2)
  })

  it('template_snapshot resistance section includes planned slot data', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    const resistanceSection = sections[0]
    expect(resistanceSection.section_name).toBe('Main Lift')
    expect(resistanceSection.modality).toBe('resistance')
    expect(resistanceSection.slots).toBeDefined()
    const slots = resistanceSection.slots as Array<Record<string, unknown>>
    expect(slots).toHaveLength(2)
    expect(slots[0].exercise_name).toBe('Bench Press')
    expect(slots[0].target_sets).toBe(4)
    expect(slots[0].target_reps).toBe('8')
    expect(slots[0].target_weight).toBe(80)
  })

  it('template_snapshot running section includes running fields', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    const runningSection = sections[1]
    expect(runningSection.section_name).toBe('Cooldown Run')
    expect(runningSection.modality).toBe('running')
    expect(runningSection.run_type).toBe('easy')
    expect(runningSection.target_pace).toBe('6:00/km')
    expect(runningSection.hr_zone).toBe(2)
    expect(runningSection.coaching_cues).toBe('Stay relaxed')
  })

  it('template_snapshot running section includes actuals', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    const runningSection = sections[1]
    expect(runningSection.actual_distance).toBe(3.0)
    expect(runningSection.actual_avg_pace).toBe('6:05/km')
    expect(runningSection.actual_avg_hr).toBe(140)
  })

  it('template_snapshot running section includes target_distance and target_duration', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    const runningSection = sections[1]
    expect(runningSection.target_distance).toBe(3.0)
    expect(runningSection.target_duration).toBe(20)
  })

  it('template_snapshot running section includes target_distance with null target_duration', async () => {
    await saveMixedWorkoutCore(db, build3SectionInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    const runningSection = sections[1]
    expect(runningSection.target_distance).toBe(5.0)
    expect(runningSection.target_duration).toBeNull()
  })

  // --- 3-section mixed template (resistance + running + mma) ---

  it('saves all 3 modality sections correctly', async () => {
    const result = await saveMixedWorkoutCore(db, build3SectionInput())
    expect(result.success).toBe(true)

    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    expect(sections).toHaveLength(3)
    expect(sections[0].modality).toBe('resistance')
    expect(sections[1].modality).toBe('running')
    expect(sections[2].modality).toBe('mma')
  })

  it('mma section snapshot includes planned_duration and actuals', async () => {
    await saveMixedWorkoutCore(db, build3SectionInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const sections = snapshot.sections as Array<Record<string, unknown>>

    const mmaSection = sections[2]
    expect(mmaSection.section_name).toBe('Sparring')
    expect(mmaSection.planned_duration).toBe(30)
    expect(mmaSection.actual_duration_minutes).toBe(25)
    expect(mmaSection.feeling).toBe(4)
  })

  // --- Validation ---

  it('fails when template not found', async () => {
    const result = await saveMixedWorkoutCore(
      db,
      buildValidInput({ templateId: 999 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('fails when template is not mixed modality', async () => {
    const result = await saveMixedWorkoutCore(
      db,
      buildValidInput({ templateId: 20 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mixed/i)
  })

  it('fails when logDate is invalid', async () => {
    const result = await saveMixedWorkoutCore(
      db,
      buildValidInput({ logDate: 'not-a-date' })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/date/i)
  })

  it('fails when sections array is empty', async () => {
    const result = await saveMixedWorkoutCore(
      db,
      buildValidInput({ sections: [] })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/section/i)
  })

  it('fails when rating is out of range', async () => {
    const result = await saveMixedWorkoutCore(
      db,
      buildValidInput({ rating: 6 })
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/rating/i)
  })

  // --- Duplicate prevention ---

  it('rejects duplicate log for same date + mesocycle', async () => {
    const first = await saveMixedWorkoutCore(db, buildValidInput())
    expect(first.success).toBe(true)

    const second = await saveMixedWorkoutCore(db, buildValidInput())
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toMatch(/already logged/i)
  })

  it('allows logging on different date for same mesocycle', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())
    const result = await saveMixedWorkoutCore(
      db,
      buildValidInput({ logDate: '2026-03-16' })
    )
    expect(result.success).toBe(true)
  })

  // --- Atomicity ---

  it('is atomic — transaction rolls back on failure', async () => {
    // First save succeeds
    const result1 = await saveMixedWorkoutCore(db, buildValidInput())
    expect(result1.success).toBe(true)

    // Second save fails (duplicate)
    const result2 = await saveMixedWorkoutCore(db, buildValidInput())
    expect(result2.success).toBe(false)

    // Only 1 workout exists
    const workouts = db.select().from(schema.logged_workouts).all()
    expect(workouts).toHaveLength(1)
  })

  it('resistance section exercises have correct order values', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())

    const exercises = db.select().from(schema.logged_exercises).all()
    expect(exercises[0].exercise_name).toBe('Bench Press')
    expect(exercises[0].order).toBe(1)
    expect(exercises[1].exercise_name).toBe('Squat')
    expect(exercises[1].order).toBe(2)
  })

  it('logged_sets have correct set_number and values', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())

    const allSets = db.select().from(schema.logged_sets).all()

    // Bench: 4 sets, Squat: 3 sets = 7 total
    expect(allSets).toHaveLength(7)
    expect(allSets[0].set_number).toBe(1)
    expect(allSets[0].actual_reps).toBe(8)
    expect(allSets[0].actual_weight).toBe(80)
  })

  it('stores exercise RPE in logged_exercises', async () => {
    await saveMixedWorkoutCore(db, buildValidInput())

    const exercises = db.select().from(schema.logged_exercises).all()
    expect(exercises[0].actual_rpe).toBe(8)
    expect(exercises[1].actual_rpe).toBe(7)
  })

  // --- Null actuals ---

  it('saves successfully with null running actuals', async () => {
    const input = buildValidInput()
    input.sections[1] = {
      sectionId: 2,
      modality: 'running',
      actualDistance: null,
      actualAvgPace: null,
      actualAvgHr: null,
    }
    const result = await saveMixedWorkoutCore(db, input)
    expect(result.success).toBe(true)
  })

  it('saves successfully with null mma actuals', async () => {
    const input = build3SectionInput()
    input.sections[2] = {
      sectionId: 5,
      modality: 'mma',
      actualDurationMinutes: null,
      feeling: null,
    }
    const result = await saveMixedWorkoutCore(db, input)
    expect(result.success).toBe(true)
  })
})
