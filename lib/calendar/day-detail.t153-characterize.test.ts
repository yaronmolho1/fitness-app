// Characterization test — captures current behavior for safe refactoring
// T153: Week override merge — pins slot value passthrough + week/deload detection
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getDayDetail } from './day-detail'

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
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
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      modality TEXT NOT NULL,
      muscle_group TEXT,
      equipment TEXT,
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
    CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position);
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      override_group TEXT NOT NULL,
      created_at INTEGER
    );
    CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx
      ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id);
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
  `)

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  return { sqlite, db }
}

describe('getDayDetail — slot value passthrough + week detection (T153 baseline)', () => {
  let sqlite: Database.Database
  let db: AppDb

  beforeAll(() => {
    const testDb = createTestDb()
    sqlite = testDb.sqlite
    db = testDb.db
  })

  afterAll(() => {
    sqlite.close()
  })

  beforeEach(() => {
    sqlite.exec('DELETE FROM logged_sets')
    sqlite.exec('DELETE FROM logged_exercises')
    sqlite.exec('DELETE FROM logged_workouts')
    sqlite.exec('DELETE FROM exercise_slots')
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM exercises')
    sqlite.exec('DELETE FROM mesocycles')
  })

  // ==========================================================================
  // Slot values are raw from exercise_slots — no transformation
  // ==========================================================================

  it('projected slot weight/sets/reps/rpe match exercise_slots table exactly', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines, "order", is_main)
      VALUES (1, 1, 4, '6-8', 102.5, 8.5, 180, 'Pause reps', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    const slot = result.slots[0]
    expect(slot.weight).toBe(102.5)
    expect(slot.sets).toBe(4)
    expect(slot.reps).toBe('6-8')
    expect(slot.rpe).toBe(8.5)
    expect(slot.rest_seconds).toBe(180)
    expect(slot.guidelines).toBe('Pause reps')
    expect(slot.is_main).toBe(true)
  })

  it('same slot values returned in week 1 and week 3 (no per-week variation)', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Squat', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Legs', 'legs', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 5, '5', 120, 8, 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // Week 1: 2026-03-02 (Mon)
    const week1 = (await getDayDetail(db, '2026-03-02'))[0]
    // Week 3: 2026-03-16 (Mon)
    const week3 = (await getDayDetail(db, '2026-03-16'))[0]

    expect(week1.type).toBe('projected')
    expect(week3.type).toBe('projected')
    if (week1.type !== 'projected' || week3.type !== 'projected') return

    expect(week1.slots[0].weight).toBe(120)
    expect(week1.slots[0].sets).toBe(5)
    expect(week1.slots[0].reps).toBe('5')
    expect(week1.slots[0].rpe).toBe(8)

    expect(week3.slots[0].weight).toBe(120)
    expect(week3.slots[0].sets).toBe(5)
    expect(week3.slots[0].reps).toBe('5')
    expect(week3.slots[0].rpe).toBe(8)
  })

  it('null-valued slot fields are preserved', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Pull Up', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Pull A', 'pull-a', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, 'AMRAP', 1, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    if (result.type !== 'projected') return

    const slot = result.slots[0]
    expect(slot.weight).toBeNull()
    expect(slot.rpe).toBeNull()
    expect(slot.rest_seconds).toBeNull()
    expect(slot.guidelines).toBeNull()
  })

  it('multiple slots each return their own values', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO exercises (id, name, modality) VALUES (2, 'OHP', 'resistance');
      INSERT INTO exercises (id, name, modality) VALUES (3, 'Lateral', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push', 'push', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 4, '6', 100, 9, 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 2, 3, '8-10', 50, 8, 2, 0);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, "order", is_main)
      VALUES (1, 3, 3, '12-15', 10, 3, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    if (result.type !== 'projected') return

    expect(result.slots).toHaveLength(3)
    expect(result.slots[0]).toMatchObject({ weight: 100, sets: 4, reps: '6', rpe: 9 })
    expect(result.slots[1]).toMatchObject({ weight: 50, sets: 3, reps: '8-10', rpe: 8 })
    expect(result.slots[2]).toMatchObject({ weight: 10, sets: 3, reps: '12-15' })
    expect(result.slots[2].rpe).toBeNull()
  })

  // ==========================================================================
  // Deload detection — getDayDetail uses its own week calculation
  // ==========================================================================

  it('is_deload is false during work weeks', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 1, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push Normal', 'push-normal', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // 2026-03-02 is Mon, week 1
    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return
    expect(result.is_deload).toBe(false)
  })

  it('is_deload is true during deload week', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 1, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Light Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push Normal', 'push-normal', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, "order", is_main)
      VALUES (2, 1, 2, '10', 50, 1, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
    `)

    // 2026-03-16 is Mon, week 3 = deload (2 work weeks + deload)
    const result = (await getDayDetail(db, '2026-03-16'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return
    expect(result.is_deload).toBe(true)
    expect(result.template.name).toBe('Push Deload')
    expect(result.slots[0].weight).toBe(50)
  })

  it('is_deload is false when has_deload is 0', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // Even on the last week
    const result = (await getDayDetail(db, '2026-03-23'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return
    expect(result.is_deload).toBe(false)
  })

  // ==========================================================================
  // Week number / day calculation uses isoDayOfWeek (Mon=0..Sun=6)
  // Different from getTodayWorkout which uses JS getDay (Sun=0..Sat=6)
  // ==========================================================================

  it('day_of_week mapping: Monday=0 in getDayDetail', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Monday Workout', 'monday-workout', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // 2026-03-02 is Monday
    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return
    expect(result.template.name).toBe('Monday Workout')
  })

  it('day_of_week mapping: Sunday=6 in getDayDetail', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Sunday Workout', 'sunday-workout', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 6, 1, 'normal');
    `)

    // 2026-03-08 is Sunday
    const result = (await getDayDetail(db, '2026-03-08'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return
    expect(result.template.name).toBe('Sunday Workout')
  })

  // ==========================================================================
  // Completed workouts are unaffected by slot values (reads from snapshot)
  // ==========================================================================

  it('completed workout reads from snapshot, not live slots', async () => {
    const snapshot = JSON.stringify({
      version: 1,
      name: 'Push A Old',
      modality: 'resistance',
      slots: [
        { exercise_name: 'Bench', sets: 3, reps: '8', weight: 80, rpe: 7, rest_seconds: null, guidelines: null, order: 1, is_main: true },
      ],
    })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A New', 'push-a', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 5, '5', 120, 9, 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, '${snapshot}');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') return

    // Snapshot values, not current template values
    expect(result.snapshot.name).toBe('Push A Old')
    expect(result.snapshot.slots![0].weight).toBe(80)
    expect(result.snapshot.slots![0].sets).toBe(3)
  })
})
