// Characterization test — captures current behavior for safe refactoring
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
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
    planned_duration INTEGER, estimated_duration INTEGER, display_order INTEGER NOT NULL DEFAULT 0,
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
    week_number INTEGER NOT NULL,
    weight REAL,
    reps TEXT,
    sets INTEGER,
    rpe REAL,
    distance REAL,
    duration INTEGER,
    pace TEXT,
    planned_duration INTEGER,
    interval_count INTEGER,
    interval_rest INTEGER,
    elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
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

  INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, group_id, group_rest_seconds, guidelines, "order", is_main)
  VALUES
    (100, 1, 10, 3, '8', 80.0, 8.0, 120, 1, 60, 'Pause at bottom', 1, 1),
    (101, 1, 20, 3, '10', NULL, NULL, 90, 1, 60, NULL, 2, 0);
`

function buildInput(): SaveWorkoutInput {
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

describe('T155 characterize: saveWorkoutCore snapshot shape', () => {
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

  it('snapshot has version:2 at top level (post-T155)', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as Record<string, unknown>
    expect(snap.version).toBe(2)
  })

  it('snapshot top-level keys include week_number_in_meso (post-T155)', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as Record<string, unknown>
    expect(Object.keys(snap).sort()).toEqual(
      ['coaching_cues', 'modality', 'name', 'notes', 'slots', 'version', 'week_number_in_meso']
    )
  })

  it('snapshot contains week_number_in_meso (post-T155)', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as Record<string, unknown>
    expect(snap.week_number_in_meso).toBe(3)
  })

  it('snapshot slot keys are exactly the expected set', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as { slots: Record<string, unknown>[] }
    const slotKeys = Object.keys(snap.slots[0]).sort()
    expect(slotKeys).toEqual([
      'exercise_name',
      'group_id',
      'group_rest_seconds',
      'guidelines',
      'is_main',
      'rest_seconds',
      'sort_order',
      'target_reps',
      'target_rpe',
      'target_sets',
      'target_weight',
    ])
  })

  it('snapshot slots are sorted by order ascending', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as {
      slots: Array<{ sort_order: number; exercise_name: string }>
    }
    expect(snap.slots[0].sort_order).toBe(1)
    expect(snap.slots[0].exercise_name).toBe('Bench Press')
    expect(snap.slots[1].sort_order).toBe(2)
    expect(snap.slots[1].exercise_name).toBe('Overhead Press')
  })

  it('snapshot preserves group_id and group_rest_seconds from slots', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as {
      slots: Array<{ group_id: number | null; group_rest_seconds: number | null }>
    }
    // Both slots have group_id=1, group_rest_seconds=60 in seed
    expect(snap.slots[0].group_id).toBe(1)
    expect(snap.slots[0].group_rest_seconds).toBe(60)
    expect(snap.slots[1].group_id).toBe(1)
    expect(snap.slots[1].group_rest_seconds).toBe(60)
  })

  // Post-T155: snapshot captures base slot values when no overrides exist
  it('snapshot captures base slot values when no overrides exist', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snap = workout.template_snapshot as unknown as {
      slots: Array<{ target_weight: number | null; target_reps: string; target_sets: number }>
    }
    expect(snap.slots[0].target_weight).toBe(80)
    expect(snap.slots[0].target_reps).toBe('8')
    expect(snap.slots[0].target_sets).toBe(3)
  })

  // saveWorkoutCore computes weekNumber internally from mesocycle start_date
  it('saveWorkoutCore signature accepts SaveWorkoutInput without weekNumber', async () => {
    const input = buildInput()
    expect(input).not.toHaveProperty('weekNumber')
    expect(input).not.toHaveProperty('week_number')
    const result = await saveWorkoutCore(db, input)
    expect(result.success).toBe(true)
  })
})
