// T184 tests — getDayDetail uses getEffectiveScheduleForDay for override-aware schedule
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
      planned_duration INTEGER, estimated_duration INTEGER,
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
    CREATE TABLE slot_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      weight REAL, reps TEXT, sets INTEGER, rpe REAL,
      distance REAL, duration INTEGER, pace TEXT, planned_duration INTEGER,
      interval_count INTEGER, interval_rest INTEGER, elevation_gain INTEGER,
      is_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    );
    CREATE UNIQUE INDEX slot_week_overrides_slot_week_idx ON slot_week_overrides(exercise_slot_id, week_number);
  `)

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  return { sqlite, db }
}

describe('getDayDetail — T184: override-aware schedule resolution', () => {
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
    sqlite.exec('DELETE FROM slot_week_overrides')
    sqlite.exec('DELETE FROM logged_sets')
    sqlite.exec('DELETE FROM logged_exercises')
    sqlite.exec('DELETE FROM logged_workouts')
    sqlite.exec('DELETE FROM schedule_week_overrides')
    sqlite.exec('DELETE FROM exercise_slots')
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM exercises')
    sqlite.exec('DELETE FROM mesocycles')
  })

  it('returns overridden template when override swaps template for the week', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Base Push', 'base-push', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Override Pull', 'override-pull', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (2, 1, 3, '10', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'morning', 2, '07:00', 'move-test');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('projected')
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Override Pull')
    }
  })

  it('returns rest when override nullifies template for the period', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Squat', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Legs', 'legs', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'morning', NULL, '07:00', 'move-rest');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rest')
  })

  it('includes override-only entry when workout added to period with no base', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Morning Push', 'morning-push', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Evening Add', 'evening-add', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (2, 1, 3, '10', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'evening', 2, '19:00', 'move-add');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(2)
    if (results[0].type === 'projected' && results[1].type === 'projected') {
      expect(results[0].period).toBe('morning')
      expect(results[0].template.name).toBe('Morning Push')
      expect(results[1].period).toBe('evening')
      expect(results[1].template.name).toBe('Evening Add')
    }
  })

  it('override only affects the specific week, not other weeks', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Base Push', 'base-push', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Override Pull', 'override-pull', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (2, 1, 3, '10', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'morning', 2, '09:00', 'move-test');
    `)

    // Week 2 Monday = 2026-03-09 — should use base, not override
    const results = await getDayDetail(db, '2026-03-09')
    expect(results).toHaveLength(1)
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Base Push')
    }
  })

  it('override during deload week resolves against deload base schedule', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 1, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push Normal', 'push-normal', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (3, 1, 'Deload Override', 'deload-override', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 4, '6', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (2, 1, 2, '10', 1, 0);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (3, 1, 2, '8', 1, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 3, 0, 'morning', 3, '07:00', 'move-deload');
    `)

    // 2026-03-16 is Monday, week 3 = deload
    const results = await getDayDetail(db, '2026-03-16')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('projected')
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Deload Override')
      expect(results[0].is_deload).toBe(true)
    }
  })
})
