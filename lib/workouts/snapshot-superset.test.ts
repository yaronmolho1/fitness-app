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
    target_distance REAL, target_duration INTEGER,
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
    rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
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
`

const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  INSERT INTO exercises (id, name, modality, muscle_group, equipment)
  VALUES
    (10, 'Bench Press', 'resistance', 'Chest', 'Barbell'),
    (20, 'Cable Fly', 'resistance', 'Chest', 'Cable'),
    (30, 'Lateral Raise', 'resistance', 'Shoulders', 'Dumbbell');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes, coaching_cues)
  VALUES (1, 1, 'Push Day', 'push-day', 'resistance', 'Focus on chest', 'Warm up');

  INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, group_id, group_rest_seconds, guidelines, "order", is_main)
  VALUES
    (100, 1, 10, 3, '8', 80.0, 8.0, 30, 1, 90, 'Pause at bottom', 1, 1),
    (101, 1, 20, 3, '12', 15.0, NULL, 30, 1, 90, NULL, 2, 0),
    (102, 1, 30, 3, '15', 10.0, NULL, 60, NULL, NULL, NULL, 3, 0);
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
        sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }, { reps: 7, weight: 80 }],
      },
      {
        slotId: 101,
        exerciseId: 20,
        exerciseName: 'Cable Fly',
        order: 2,
        rpe: null,
        sets: [{ reps: 12, weight: 15 }, { reps: 12, weight: 15 }, { reps: 10, weight: 15 }],
      },
      {
        slotId: 102,
        exerciseId: 30,
        exerciseName: 'Lateral Raise',
        order: 3,
        rpe: null,
        sets: [{ reps: 15, weight: 10 }, { reps: 15, weight: 10 }, { reps: 12, weight: 10 }],
      },
    ],
    rating: 4,
    notes: null,
  }
}

describe('AC14 — template_snapshot includes group fields', () => {
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

  it('snapshot slots include group_id and group_rest_seconds for grouped slots', async () => {
    await saveWorkoutCore(db, buildInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as {
      version: number
      slots: Array<{
        exercise_name: string
        group_id: number | null
        group_rest_seconds: number | null
        [key: string]: unknown
      }>
    }

    // Slot 1 (Bench Press) — grouped
    expect(snapshot.slots[0].group_id).toBe(1)
    expect(snapshot.slots[0].group_rest_seconds).toBe(90)

    // Slot 2 (Cable Fly) — grouped
    expect(snapshot.slots[1].group_id).toBe(1)
    expect(snapshot.slots[1].group_rest_seconds).toBe(90)

    // Slot 3 (Lateral Raise) — ungrouped
    expect(snapshot.slots[2].group_id).toBeNull()
    expect(snapshot.slots[2].group_rest_seconds).toBeNull()
  })
})
