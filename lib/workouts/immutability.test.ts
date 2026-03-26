import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { saveWorkoutCore } from './save-workout'
import type { SaveWorkoutInput } from './save-workout'

// -- Test helpers --

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
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
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

// -- Immutability enforcement tests --

describe('log immutability enforcement', () => {
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

  describe('no mutation Server Actions for log tables', () => {
    it('workouts/actions.ts exports only saveWorkout (no update/delete)', async () => {
      const actionsModule = await import('./actions')
      const exportedNames = Object.keys(actionsModule)

      // Should export saveWorkout + types. No update/delete functions.
      const mutationNames = exportedNames.filter(
        (name) =>
          name.toLowerCase().includes('update') ||
          name.toLowerCase().includes('delete') ||
          name.toLowerCase().includes('edit')
      )
      expect(mutationNames).toEqual([])
    })

    it('no source file contains update/delete calls on log tables', () => {
      // Patterns: .update(tableName) or .delete(tableName) on any log table
      const MUTATION_PATTERN = /\.(update|delete)\(\s*(logged_workouts|logged_exercises|logged_sets|routine_logs)\s*\)/

      const libDir = path.resolve(__dirname, '..')
      const appDir = path.resolve(__dirname, '../../app')
      const dirs = [libDir, appDir].filter((d) => fs.existsSync(d))

      const violations: string[] = []

      for (const dir of dirs) {
        const files = collectTsFiles(dir)
        for (const file of files) {
          // Skip test files and node_modules
          if (file.includes('.test.') || file.includes('node_modules')) continue
          const content = fs.readFileSync(file, 'utf-8')
          if (MUTATION_PATTERN.test(content)) {
            violations.push(file)
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('template edit after logging does not affect snapshot', () => {
    it('snapshot is frozen at log time — template edits are invisible to existing logs', async () => {
      // 1. Save workout (creates snapshot)
      const result = await saveWorkoutCore(db, buildValidInput())
      expect(result.success).toBe(true)

      // 2. Edit the source template (change name, notes, exercise slot weight)
      sqlite.exec(`
        UPDATE workout_templates SET name = 'Push Day V2', notes = 'Updated notes' WHERE id = 1;
        UPDATE exercise_slots SET weight = 100.0, reps = '12' WHERE id = 100;
      `)

      // 3. Re-read snapshot — should reflect ORIGINAL values
      const [workout] = db.select().from(schema.logged_workouts).all()
      const snapshot = workout.template_snapshot as {
        version: number
        name: string
        notes: string | null
        slots: Array<{
          exercise_name: string
          target_weight: number | null
          target_reps: string
        }>
      }

      expect(snapshot.name).toBe('Push Day')
      expect(snapshot.notes).toBe('Focus on chest')
      expect(snapshot.slots[0].target_weight).toBe(80)
      expect(snapshot.slots[0].target_reps).toBe('8')
    })

    it('deleting template after logging does not affect logged rows', async () => {
      const result = await saveWorkoutCore(db, buildValidInput())
      expect(result.success).toBe(true)

      // Delete the source template
      sqlite.exec('DELETE FROM workout_templates WHERE id = 1')

      // logged_workouts row still exists (no FK cascade)
      const workouts = db.select().from(schema.logged_workouts).all()
      expect(workouts).toHaveLength(1)
      expect(workouts[0].canonical_name).toBe('push-day')

      // logged_exercises and logged_sets still exist
      const exercises = db.select().from(schema.logged_exercises).all()
      const sets = db.select().from(schema.logged_sets).all()
      expect(exercises).toHaveLength(2)
      expect(sets).toHaveLength(6)
    })

    it('changing canonical_name on template does not affect logged_workouts.canonical_name', async () => {
      await saveWorkoutCore(db, buildValidInput())

      sqlite.exec(`UPDATE workout_templates SET canonical_name = 'push-day-renamed' WHERE id = 1`)

      const [workout] = db.select().from(schema.logged_workouts).all()
      expect(workout.canonical_name).toBe('push-day')
    })
  })

  describe('transaction rollback on DB error', () => {
    it('no partial rows remain when transaction fails mid-way', async () => {
      // Drop logged_sets table to force an error after logged_workouts + logged_exercises inserts
      sqlite.exec('DROP TABLE logged_sets')

      const result = await saveWorkoutCore(db, buildValidInput())
      expect(result.success).toBe(false)

      // Verify full rollback — no orphaned logged_workouts or logged_exercises rows
      const workouts = sqlite.prepare('SELECT count(*) as cnt FROM logged_workouts').get() as { cnt: number }
      const exercises = sqlite.prepare('SELECT count(*) as cnt FROM logged_exercises').get() as { cnt: number }
      expect(workouts.cnt).toBe(0)
      expect(exercises.cnt).toBe(0)
    })
  })

  describe('template_snapshot shape and version', () => {
    it('snapshot contains version: 1', async () => {
      const result = await saveWorkoutCore(db, buildValidInput())
      expect(result.success).toBe(true)

      const [workout] = db.select().from(schema.logged_workouts).all()
      const snapshot = workout.template_snapshot as { version: number }
      expect(snapshot.version).toBe(2)
    })

    it('snapshot contains all exercise slot fields from the template', async () => {
      const result = await saveWorkoutCore(db, buildValidInput())
      expect(result.success).toBe(true)

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
          is_main: number
        }>
      }

      // Template-level fields
      expect(snapshot.version).toBe(2)
      expect(snapshot.name).toBe('Push Day')
      expect(snapshot.modality).toBe('resistance')
      expect(snapshot.notes).toBe('Focus on chest')
      expect(snapshot.coaching_cues).toBe('Warm up properly')

      // Slot-level: verify all fields on first slot (Bench Press — seeded with all values)
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
      expect(slot0.is_main).toBeTruthy()

      // Second slot (Overhead Press — nullable fields)
      const slot1 = snapshot.slots[1]
      expect(slot1.exercise_name).toBe('Overhead Press')
      expect(slot1.target_sets).toBe(3)
      expect(slot1.target_reps).toBe('10')
      expect(slot1.target_weight).toBeNull()
      expect(slot1.target_rpe).toBeNull()
      expect(slot1.rest_seconds).toBe(90)
      expect(slot1.guidelines).toBeNull()
      expect(slot1.sort_order).toBe(2)
      expect(slot1.is_main).toBeFalsy()
    })
  })

  describe('integration: full save and query', () => {
    it('save workout creates all rows with correct cross-references', async () => {
      const result = await saveWorkoutCore(db, buildValidInput())
      expect(result.success).toBe(true)
      if (!result.success) return

      // Verify logged_workouts
      const workouts = db.select().from(schema.logged_workouts).all()
      expect(workouts).toHaveLength(1)
      expect(workouts[0].id).toBe(result.data.workoutId)
      expect(workouts[0].template_id).toBe(1)
      expect(workouts[0].canonical_name).toBe('push-day')
      expect(workouts[0].log_date).toBe('2026-03-15')
      expect(workouts[0].rating).toBe(4)
      expect(workouts[0].notes).toBe('Good session')

      // Verify logged_exercises
      const exercises = db
        .select()
        .from(schema.logged_exercises)
        .orderBy(schema.logged_exercises.order)
        .all()
      expect(exercises).toHaveLength(2)
      expect(exercises[0].logged_workout_id).toBe(result.data.workoutId)
      expect(exercises[0].exercise_name).toBe('Bench Press')
      expect(exercises[1].exercise_name).toBe('Overhead Press')

      // Verify logged_sets
      const sets = db
        .select()
        .from(schema.logged_sets)
        .orderBy(schema.logged_sets.id)
        .all()
      expect(sets).toHaveLength(6)
      // First 3 sets belong to Bench Press
      for (let i = 0; i < 3; i++) {
        expect(sets[i].logged_exercise_id).toBe(exercises[0].id)
      }
      // Last 3 sets belong to Overhead Press
      for (let i = 3; i < 6; i++) {
        expect(sets[i].logged_exercise_id).toBe(exercises[1].id)
      }
    })
  })
})

// Recursively collect .ts/.tsx files (excluding node_modules)
function collectTsFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      results.push(...collectTsFiles(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}
