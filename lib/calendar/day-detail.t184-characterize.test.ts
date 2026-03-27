// Characterization test — T184: captures current schedule resolution behavior
// before replacing direct weekly_schedule query with getEffectiveScheduleForDay()
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
    CREATE TABLE weekly_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      week_type TEXT NOT NULL DEFAULT 'normal',
      period TEXT NOT NULL DEFAULT 'morning',
      time_slot TEXT,
      created_at INTEGER
    );
    CREATE UNIQUE INDEX weekly_schedule_meso_day_type_period_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, period);
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT,
      override_group TEXT NOT NULL,
      created_at INTEGER
    );
    CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_period_idx
      ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, period);
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

describe('getDayDetail — schedule resolution baseline (T184 characterize)', () => {
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

  it('resolves projected workout from weekly_schedule for matching day + week_type', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 4, '6-8', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // 2026-03-02 is Monday (dow=0)
    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('projected')
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Push A')
      expect(results[0].is_deload).toBe(false)
    }
  })

  it('returns rest when no schedule entry for day_of_week', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // 2026-03-03 is Tuesday (dow=1), no schedule for Tuesday
    const results = await getDayDetail(db, '2026-03-03')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rest')
  })

  it('uses normal week_type during work weeks', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-04-05', 4, 1, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Squat', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Legs Normal', 'legs-normal', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Legs Deload', 'legs-deload', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 5, '5', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (2, 1, 2, '10', 1, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
    `)

    // Week 1 Monday — normal
    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Legs Normal')
      expect(results[0].is_deload).toBe(false)
    }
  })

  it('uses deload week_type during deload week', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 1, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push Normal', 'push-normal', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 4, '6', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (2, 1, 2, '10', 1, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
    `)

    // 2026-03-16 is Monday, week 3 (deload)
    const results = await getDayDetail(db, '2026-03-16')
    expect(results).toHaveLength(1)
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Push Deload')
      expect(results[0].is_deload).toBe(true)
    }
  })

  it('returns multiple sessions for same day with different periods', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Morning Push', 'morning-push', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Evening Run', 'evening-run', 'running');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'normal', 'evening');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(2)
    // Sorted: morning first, evening second
    if (results[0].type === 'projected' && results[1].type === 'projected') {
      expect(results[0].period).toBe('morning')
      expect(results[0].template.name).toBe('Morning Push')
      expect(results[1].period).toBe('evening')
      expect(results[1].template.name).toBe('Evening Run')
    }
  })

  it('schedule_week_overrides are ignored by current code', async () => {
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
      -- Override swaps to template 2 for week 1
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'morning', 2, '09:00', 'move-test');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    // Current code returns BASE template, ignoring override
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Base Push')
    }
  })

  it('schedule_week_overrides null template_id does not cause rest in current code', async () => {
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
      -- Override with NULL template_id (rest override)
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'morning', NULL, NULL, 'move-rest');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    // Current code still returns the base workout
    expect(results[0].type).toBe('projected')
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Legs')
    }
  })

  it('override-only entry (no base for period) does not appear in current code', async () => {
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
      -- Override adds workout to evening (no base evening entry)
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'evening', 2, '19:00', 'move-add');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    // Current code only returns morning (base schedule), evening override is invisible
    expect(results).toHaveLength(1)
    if (results[0].type === 'projected') {
      expect(results[0].template.name).toBe('Morning Push')
      expect(results[0].period).toBe('morning')
    }
  })

  it('picks first mesocycle covering date (not filtered by status)', async () => {
    // getDayDetail does NOT filter by status — it picks any mesocycle covering the date
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Completed Block', '2026-03-02', '2026-03-29', 4, 0, 'completed');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('projected')
    if (results[0].type === 'projected') {
      expect(results[0].mesocycle_status).toBe('completed')
    }
  })

  it('rest result includes mesocycle_id and mesocycle_status when meso covers date', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
    `)

    // No schedule → rest day
    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rest')
    if (results[0].type === 'rest') {
      expect(results[0].mesocycle_id).toBe(1)
      expect(results[0].mesocycle_status).toBe('active')
    }
  })
})
