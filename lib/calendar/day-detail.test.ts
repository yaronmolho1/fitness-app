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
    CREATE UNIQUE INDEX slot_week_overrides_slot_week_idx ON slot_week_overrides(exercise_slot_id, week_number);
  `)

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  return { sqlite, db }
}

describe('getDayDetail', () => {
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
    sqlite.exec('DELETE FROM exercise_slots')
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM exercises')
    sqlite.exec('DELETE FROM mesocycles')
  })

  // ============================================================================
  // Rest day
  // ============================================================================

  it('returns rest state when no mesocycle covers date', async () => {
    const results = await getDayDetail(db, '2026-03-10')
    expect(results[0].type).toBe('rest')
    expect(results[0].date).toBe('2026-03-10')
  })

  it('returns rest state when mesocycle exists but no schedule for that day', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)
    // 2026-03-03 is Tuesday, no schedule
    const results = await getDayDetail(db, '2026-03-03')
    expect(results[0].type).toBe('rest')
  })

  // ============================================================================
  // Projected resistance — slots with targets from live template
  // ============================================================================

  it('projected resistance day includes template info and exercise slots', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO exercises (id, name, modality) VALUES (2, 'Incline DB Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance', 'Focus on chest');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines, "order", is_main)
      VALUES (1, 1, 4, '6-8', 100, 8, 120, 'Pause at bottom', 1, 1);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines, "order", is_main)
      VALUES (1, 2, 3, '10-12', 30, 7, 90, 'Slow eccentric', 2, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.template.name).toBe('Push A')
    expect(result.template.modality).toBe('resistance')
    expect(result.template.notes).toBe('Focus on chest')

    expect(result.slots).toHaveLength(2)
    // First slot (ordered)
    expect(result.slots[0].exercise_name).toBe('Bench Press')
    expect(result.slots[0].sets).toBe(4)
    expect(result.slots[0].reps).toBe('6-8')
    expect(result.slots[0].weight).toBe(100)
    expect(result.slots[0].rpe).toBe(8)
    expect(result.slots[0].rest_seconds).toBe(120)
    expect(result.slots[0].guidelines).toBe('Pause at bottom')
    expect(result.slots[0].is_main).toBe(true)

    // Second slot
    expect(result.slots[1].exercise_name).toBe('Incline DB Press')
    expect(result.slots[1].is_main).toBe(false)
    expect(result.slots[1].order).toBe(2)
  })

  // ============================================================================
  // Projected running — run-specific fields
  // ============================================================================

  it('projected running day includes run-specific fields', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, run_type, target_pace, hr_zone, interval_count, interval_rest, coaching_cues)
      VALUES (1, 1, 'Tempo Run', 'tempo-run', 'running', 'tempo', '5:00', 3, null, null, 'Stay relaxed');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.template.modality).toBe('running')
    expect(result.template.run_type).toBe('tempo')
    expect(result.template.target_pace).toBe('5:00')
    expect(result.template.hr_zone).toBe(3)
    expect(result.template.coaching_cues).toBe('Stay relaxed')
  })

  // ============================================================================
  // Projected MMA — duration and occurrence
  // ============================================================================

  it('projected MMA day includes duration', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, planned_duration)
      VALUES (1, 1, 'BJJ Sparring', 'bjj-sparring', 'mma', 90);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.template.modality).toBe('mma')
    expect(result.template.planned_duration).toBe(90)
  })

  // ============================================================================
  // Completed day — reads from template_snapshot, not live template
  // ============================================================================

  it('completed day reads planned data from template_snapshot', async () => {
    const snapshot = JSON.stringify({
      version: 1,
      name: 'Push A Original',
      modality: 'resistance',
      notes: 'Snapshot notes',
      slots: [
        { exercise_name: 'Bench Press', sets: 4, reps: '6-8', weight: 100, rpe: 8, rest_seconds: 120, guidelines: null, order: 1, is_main: true },
      ],
    })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A Edited', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, rating, notes, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, 4, 'Great session', '${snapshot}');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') return

    // Should read from snapshot, not live template
    expect(result.snapshot.name).toBe('Push A Original')
    expect(result.snapshot.notes).toBe('Snapshot notes')
    expect(result.rating).toBe(4)
    expect(result.notes).toBe('Great session')
  })

  // ============================================================================
  // Completed resistance day — planned + actuals
  // ============================================================================

  it('completed resistance day includes planned targets from snapshot and logged actuals', async () => {
    const snapshot = JSON.stringify({
      version: 1,
      name: 'Push A',
      modality: 'resistance',
      notes: null,
      slots: [
        { exercise_name: 'Bench Press', sets: 3, reps: '8-10', weight: 80, rpe: 8, rest_seconds: 120, guidelines: null, order: 1, is_main: true },
      ],
    })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, rating, notes, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, 5, null, '${snapshot}');
      INSERT INTO logged_exercises (id, logged_workout_id, exercise_id, exercise_name, "order", actual_rpe)
      VALUES (1, 1, 1, 'Bench Press', 1, 8.5);
      INSERT INTO logged_sets (logged_exercise_id, set_number, actual_reps, actual_weight)
      VALUES (1, 1, 10, 82.5);
      INSERT INTO logged_sets (logged_exercise_id, set_number, actual_reps, actual_weight)
      VALUES (1, 2, 9, 82.5);
      INSERT INTO logged_sets (logged_exercise_id, set_number, actual_reps, actual_weight)
      VALUES (1, 3, 8, 82.5);
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') return

    expect(result.exercises).toHaveLength(1)
    expect(result.exercises[0].exercise_name).toBe('Bench Press')
    expect(result.exercises[0].sets).toHaveLength(3)
    expect(result.exercises[0].actual_rpe).toBe(8.5)
    expect(result.exercises[0].sets[0]).toEqual({
      set_number: 1,
      actual_reps: 10,
      actual_weight: 82.5,
    })
    expect(result.exercises[0].sets[2].actual_reps).toBe(8)
  })

  // ============================================================================
  // Edge: completed day with since-edited template shows snapshot
  // ============================================================================

  it('completed day with edited template shows snapshot data not current', async () => {
    const snapshot = JSON.stringify({
      version: 1,
      name: 'Push A v1',
      modality: 'resistance',
      notes: 'Original notes',
      slots: [
        { exercise_name: 'Bench Press', sets: 3, reps: '8', weight: 80, rpe: null, rest_seconds: null, guidelines: null, order: 1, is_main: true },
      ],
    })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, notes)
      VALUES (1, 1, 'Push A v2 EDITED', 'push-a', 'resistance', 'New notes after edit');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, '${snapshot}');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') return

    // Shows snapshot, not current template
    expect(result.snapshot.name).toBe('Push A v1')
    expect(result.snapshot.notes).toBe('Original notes')
  })

  // ============================================================================
  // Edge: projected day with deleted template
  // ============================================================================

  it('projected day with deleted template returns rest gracefully', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, null, 'normal');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results[0].type).toBe('rest')
  })

  // ============================================================================
  // Deload day shows deload template
  // ============================================================================

  it('deload day shows deload template content', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-15', 1, 1, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Light Bench', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push Normal', 'push-normal', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines, "order", is_main)
      VALUES (2, 1, 2, '10', 50, 5, 60, 'Easy', 1, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
    `)

    // 2026-03-09 is Monday in deload week
    const result = (await getDayDetail(db, '2026-03-09'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.template.name).toBe('Push Deload')
    expect(result.slots).toHaveLength(1)
    expect(result.slots[0].exercise_name).toBe('Light Bench')
    expect(result.slots[0].weight).toBe(50)
    expect(result.is_deload).toBe(true)
  })

  // ============================================================================
  // Exercise slots are in defined order
  // ============================================================================

  it('exercise slots are returned in order', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'OHP', 'resistance');
      INSERT INTO exercises (id, name, modality) VALUES (2, 'Bench Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 3, '8', 2, 0);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 2, 4, '6', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    if (result.type !== 'projected') return

    expect(result.slots[0].exercise_name).toBe('Bench Press')
    expect(result.slots[0].order).toBe(1)
    expect(result.slots[1].exercise_name).toBe('OHP')
    expect(result.slots[1].order).toBe(2)
  })

  // ============================================================================
  // Projected day includes is_deload flag
  // ============================================================================

  it('projected day includes is_deload false for normal week', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    if (result.type !== 'projected') return
    expect(result.is_deload).toBe(false)
  })

  // ============================================================================
  // T124: Quick links — mesocycle_id and mesocycle_status in results
  // ============================================================================

  it('projected result includes mesocycle_id and mesocycle_status', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return
    expect(result.mesocycle_id).toBe(1)
    expect(result.mesocycle_status).toBe('active')
  })

  it('completed result includes mesocycle_id and mesocycle_status', async () => {
    const snapshot = JSON.stringify({
      version: 1,
      name: 'Push A',
      modality: 'resistance',
    })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'completed');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, '${snapshot}');
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') return
    expect(result.mesocycle_id).toBe(1)
    expect(result.mesocycle_status).toBe('completed')
  })

  it('rest day within mesocycle includes mesocycle_id and mesocycle_status', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    // 2026-03-03 is Tuesday, no schedule entry
    const result = (await getDayDetail(db, '2026-03-03'))[0]
    expect(result.type).toBe('rest')
    if (result.type !== 'rest') return
    expect(result.mesocycle_id).toBe(1)
    expect(result.mesocycle_status).toBe('active')
  })

  it('rest day outside any mesocycle has no mesocycle_id', async () => {
    const result = (await getDayDetail(db, '2026-03-10'))[0]
    expect(result.type).toBe('rest')
    if (result.type !== 'rest') return
    expect(result.mesocycle_id).toBeUndefined()
    expect(result.mesocycle_status).toBeUndefined()
  })

  // ============================================================================
  // T144: Multi-workout — returns array, period field, multiple entries
  // ============================================================================

  it('returns an array (not single object)', async () => {
    const results = await getDayDetail(db, '2026-03-10')
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns array with single rest entry when no mesocycle', async () => {
    const results = await getDayDetail(db, '2026-03-10')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rest')
  })

  it('projected result includes period field', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('projected')
    if (results[0].type !== 'projected') return
    expect(results[0].period).toBe('morning')
  })

  it('returns multiple projected entries for same day with different periods', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, planned_duration)
      VALUES (2, 1, 'Evening Run', 'evening-run', 'running', 30);
      INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order", is_main)
      VALUES (1, 1, 4, '6-8', 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'normal', 'evening');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(2)

    // Ordered by period: morning, afternoon, evening
    expect(results[0].type).toBe('projected')
    expect(results[1].type).toBe('projected')
    if (results[0].type !== 'projected' || results[1].type !== 'projected') return

    expect(results[0].period).toBe('morning')
    expect(results[0].template.name).toBe('Push A')
    expect(results[0].slots).toHaveLength(1)

    expect(results[1].period).toBe('evening')
    expect(results[1].template.name).toBe('Evening Run')
  })

  it('returns multiple logged workouts on same date', async () => {
    const snapshot1 = JSON.stringify({ version: 1, name: 'Push A', modality: 'resistance' })
    const snapshot2 = JSON.stringify({ version: 1, name: 'Easy Run', modality: 'running' })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Easy Run', 'easy-run', 'running');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'normal', 'evening');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, '${snapshot1}');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (2, 2, 'easy-run', '2026-03-02', 1740910000, '${snapshot2}');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    // Both should be completed
    const completed = results.filter(r => r.type === 'completed')
    expect(completed).toHaveLength(2)
  })

  it('returns mix of completed and projected on same day', async () => {
    const snapshot = JSON.stringify({ version: 1, name: 'Push A', modality: 'resistance' })

    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Easy Run', 'easy-run', 'running');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'normal', 'evening');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, '${snapshot}');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(2)
    const types = results.map(r => r.type).sort()
    expect(types).toEqual(['completed', 'projected'])
  })

  it('rest within mesocycle returns single rest entry', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
    `)

    // Tuesday — no schedule
    const results = await getDayDetail(db, '2026-03-03')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('rest')
  })

  it('three workouts all periods returns all in period order', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Morning Lift', 'morning-lift', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Afternoon BJJ', 'afternoon-bjj', 'mma');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (3, 1, 'Evening Run', 'evening-run', 'running');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'normal', 'afternoon');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 3, 'normal', 'evening');
    `)

    const results = await getDayDetail(db, '2026-03-02')
    expect(results).toHaveLength(3)
    if (results[0].type !== 'projected' || results[1].type !== 'projected' || results[2].type !== 'projected') return

    expect(results[0].period).toBe('morning')
    expect(results[0].template.name).toBe('Morning Lift')
    expect(results[1].period).toBe('afternoon')
    expect(results[1].template.name).toBe('Afternoon BJJ')
    expect(results[2].period).toBe('evening')
    expect(results[2].template.name).toBe('Evening Run')
  })

  // ============================================================================
  // T153: Week override merge into getDayDetail
  // ============================================================================

  it('projected slot merges week override for current week (AC12)', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 1, 4, '6-8', 100, 8, 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO slot_week_overrides (exercise_slot_id, week_number, weight, reps, is_deload)
      VALUES (1, 2, 110, '5-7', 0);
    `)

    // 2026-03-09 is Mon, week 2
    const result = (await getDayDetail(db, '2026-03-09'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.slots[0].weight).toBe(110) // overridden
    expect(result.slots[0].reps).toBe('5-7') // overridden
    expect(result.slots[0].sets).toBe(4) // base
    expect(result.slots[0].rpe).toBe(8) // base
  })

  it('no override for current week returns base values (AC17)', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench Press', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 1, 4, '6-8', 100, 8, 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO slot_week_overrides (exercise_slot_id, week_number, weight, is_deload)
      VALUES (1, 3, 120, 0);
    `)

    // 2026-03-09 is Mon, week 2 — override is for week 3
    const result = (await getDayDetail(db, '2026-03-09'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.slots[0].weight).toBe(100) // base, not 120
    expect(result.slots[0].reps).toBe('6-8')
  })

  it('partial override only changes provided fields', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Squat', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Legs', 'legs', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 1, 5, '5', 120, 8, 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO slot_week_overrides (exercise_slot_id, week_number, rpe, is_deload)
      VALUES (1, 1, 9.5, 0);
    `)

    // 2026-03-02 is Mon, week 1
    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.slots[0].weight).toBe(120) // base
    expect(result.slots[0].sets).toBe(5) // base
    expect(result.slots[0].reps).toBe('5') // base
    expect(result.slots[0].rpe).toBe(9.5) // overridden
  })

  it('multiple slots each get their own override merged', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO exercises (id, name, modality) VALUES (1, 'Bench', 'resistance');
      INSERT INTO exercises (id, name, modality) VALUES (2, 'OHP', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push', 'push', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, "order", is_main)
      VALUES (1, 1, 1, 4, '6', 100, 1, 1);
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, "order", is_main)
      VALUES (2, 1, 2, 3, '8-10', 50, 2, 0);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO slot_week_overrides (exercise_slot_id, week_number, weight, is_deload)
      VALUES (1, 2, 110, 0);
      INSERT INTO slot_week_overrides (exercise_slot_id, week_number, sets, reps, is_deload)
      VALUES (2, 2, 4, '6-8', 0);
    `)

    // 2026-03-09 is Mon, week 2
    const result = (await getDayDetail(db, '2026-03-09'))[0]
    expect(result.type).toBe('projected')
    if (result.type !== 'projected') return

    expect(result.slots[0].weight).toBe(110) // overridden
    expect(result.slots[0].sets).toBe(4) // base
    expect(result.slots[1].weight).toBe(50) // base
    expect(result.slots[1].sets).toBe(4) // overridden
    expect(result.slots[1].reps).toBe('6-8') // overridden
  })

  it('completed workout is unaffected by overrides (reads from snapshot)', async () => {
    const snapshot = JSON.stringify({
      version: 1,
      name: 'Push A',
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
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO exercise_slots (id, template_id, exercise_id, sets, reps, weight, rpe, "order", is_main)
      VALUES (1, 1, 1, 5, '5', 120, 9, 1, 1);
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO logged_workouts (id, template_id, canonical_name, log_date, logged_at, template_snapshot)
      VALUES (1, 1, 'push-a', '2026-03-02', 1740900000, '${snapshot}');
      INSERT INTO slot_week_overrides (exercise_slot_id, week_number, weight, is_deload)
      VALUES (1, 1, 999, 0);
    `)

    const result = (await getDayDetail(db, '2026-03-02'))[0]
    expect(result.type).toBe('completed')
    if (result.type !== 'completed') return

    // Snapshot values unchanged by override
    expect(result.snapshot.slots![0].weight).toBe(80)
  })
})
