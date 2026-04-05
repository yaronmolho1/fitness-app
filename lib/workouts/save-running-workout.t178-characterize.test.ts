// Characterization test — captures current behavior for safe refactoring
// Focus: snapshot shape, type surface, and absence of elevation-gain fields before T178
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import {
  saveRunningWorkoutCore,
  type SaveRunningWorkoutInput,
  type IntervalRepData,
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
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER, display_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER
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
`

const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, target_pace, hr_zone, coaching_cues, target_distance, target_duration, target_elevation_gain)
  VALUES (10, 1, 'Tuesday Tempo', 'tuesday-tempo', 'running', 'tempo', '5:30/km', 3, 'Stay relaxed', 8.0, 45, 150);

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, target_pace, hr_zone, interval_count, interval_rest, coaching_cues, target_distance, target_duration)
  VALUES (11, 1, 'Thursday Intervals', 'thursday-intervals', 'running', 'interval', '4:00/km', 4, 6, 90, 'Hard effort on reps', 6.0, null);

  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, coaching_cues)
  VALUES (12, 1, 'Sunday Long', 'sunday-long', 'running', 'long', null);
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

describe('T178 characterization: snapshot shape before elevation-gain', () => {
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

  // --- Exact snapshot key set ---

  it('snapshot has exactly these top-level keys (no elevation fields)', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    const keys = Object.keys(snapshot).sort()
    expect(keys).toEqual([
      'actual_avg_hr',
      'actual_avg_pace',
      'actual_distance',
      'actual_elevation_gain',
      'coaching_cues',
      'hr_zone',
      'interval_count',
      'interval_data',
      'interval_rest',
      'modality',
      'name',
      'notes',
      'run_type',
      'target_distance',
      'target_duration',
      'target_elevation_gain',
      'target_pace',
      'version',
    ])
  })

  it('snapshot contains target_elevation_gain from template', async () => {
    // Template 10 has target_elevation_gain=150 in DB — now included in snapshot (T178)
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.target_elevation_gain).toBe(150)
  })

  it('snapshot contains actual_elevation_gain (null when not provided)', async () => {
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot).toHaveProperty('actual_elevation_gain')
    expect(snapshot.actual_elevation_gain).toBeNull()
  })

  // --- IntervalRepData shape ---

  it('interval_data items have exactly 5 keys (including elevation)', async () => {
    const intervalData: IntervalRepData[] = [
      { rep_number: 1, interval_pace: '4:55/km', interval_avg_hr: 170, interval_notes: null, interval_elevation_gain: null },
    ]
    await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const reps = snapshot.interval_data as Array<Record<string, unknown>>

    expect(Object.keys(reps[0]).sort()).toEqual([
      'interval_avg_hr',
      'interval_elevation_gain',
      'interval_notes',
      'interval_pace',
      'rep_number',
    ])
  })

  it('interval_data items contain interval_elevation_gain (T178)', async () => {
    const intervalData: IntervalRepData[] = [
      { rep_number: 1, interval_pace: null, interval_avg_hr: null, interval_notes: null, interval_elevation_gain: null },
    ]
    await saveRunningWorkoutCore(
      db,
      buildValidInput({ templateId: 11, intervalData })
    )
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>
    const reps = snapshot.interval_data as Array<Record<string, unknown>>

    expect(reps[0]).toHaveProperty('interval_elevation_gain')
    expect(reps[0].interval_elevation_gain).toBeNull()
  })

  // --- SaveRunningWorkoutInput shape ---

  it('SaveRunningWorkoutInput does not require actualElevationGain', async () => {
    // This input has no elevation field — should succeed as-is
    const input: SaveRunningWorkoutInput = {
      templateId: 10,
      logDate: '2026-03-20',
      actualDistance: 5.0,
      actualAvgPace: '6:00/km',
      actualAvgHr: 140,
      rating: 3,
      notes: null,
    }
    const result = await saveRunningWorkoutCore(db, input)
    expect(result.success).toBe(true)
  })

  // --- Validation boundaries (no elevation validation exists) ---

  it('validation rejects negative elevation gain (T178)', async () => {
    const input: SaveRunningWorkoutInput = {
      ...buildValidInput({ logDate: '2026-03-21' }),
      actualElevationGain: -999,
    }
    const result = await saveRunningWorkoutCore(db, input)
    expect(result.success).toBe(false)
  })

  // --- Snapshot values from template with elevation in DB ---

  it('template with target_elevation_gain=150 includes it in snapshot (T178)', async () => {
    // Template 10 seeded with target_elevation_gain=150
    await saveRunningWorkoutCore(db, buildValidInput())
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot.target_elevation_gain).toBe(150)
    // Verify other template fields are still captured
    expect(snapshot.target_distance).toBe(8.0)
    expect(snapshot.target_duration).toBe(45)
  })

  it('template with null target_elevation_gain includes null in snapshot (T178)', async () => {
    // Template 11 has no target_elevation_gain set (null)
    await saveRunningWorkoutCore(db, buildValidInput({ templateId: 11 }))
    const [workout] = db.select().from(schema.logged_workouts).all()
    const snapshot = workout.template_snapshot as Record<string, unknown>

    expect(snapshot).toHaveProperty('target_elevation_gain')
    expect(snapshot.target_elevation_gain).toBeNull()
  })

  // --- IntervalRepData type surface (compile-time + runtime) ---

  it('IntervalRepData has exactly rep_number, interval_pace, interval_avg_hr, interval_notes, interval_elevation_gain', () => {
    // Runtime check: creating a valid IntervalRepData
    const rep: IntervalRepData = {
      rep_number: 1,
      interval_pace: '5:00/km',
      interval_avg_hr: 160,
      interval_notes: 'good',
      interval_elevation_gain: null,
    }
    expect(Object.keys(rep).sort()).toEqual([
      'interval_avg_hr',
      'interval_elevation_gain',
      'interval_notes',
      'interval_pace',
      'rep_number',
    ])
  })
})
