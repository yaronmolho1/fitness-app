import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getTableColumns } from 'drizzle-orm'
import * as schema from './schema'
import * as relationsModule from './relations'
import type { AppDb } from '.'

let sqlite: Database.Database
let db: AppDb

// Build CREATE TABLE SQL matching the current schema including template_sections
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
    name TEXT NOT NULL, canonical_name TEXT NOT NULL,
    modality TEXT NOT NULL CHECK(modality IN ('resistance', 'running', 'mma', 'mixed')),
    notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, created_at INTEGER
  );
  CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL CHECK(modality IN ('resistance', 'running', 'mma')),
    section_name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    run_type TEXT,
    target_pace TEXT,
    hr_zone INTEGER,
    interval_count INTEGER,
    interval_rest INTEGER,
    coaching_cues TEXT,
    target_distance REAL,
    target_duration INTEGER,
    target_elevation_gain INTEGER,
    planned_duration INTEGER,
    created_at INTEGER
  );
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
    rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
    guidelines TEXT, "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0, created_at INTEGER
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
  CREATE TABLE routine_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT,
    has_weight INTEGER NOT NULL DEFAULT 0,
    has_length INTEGER NOT NULL DEFAULT 0,
    has_duration INTEGER NOT NULL DEFAULT 0,
    has_sets INTEGER NOT NULL DEFAULT 0,
    has_reps INTEGER NOT NULL DEFAULT 0,
    frequency_target INTEGER NOT NULL,
    scope TEXT NOT NULL, mesocycle_id INTEGER REFERENCES mesocycles(id),
    start_date TEXT, end_date TEXT,
    skip_on_deload INTEGER NOT NULL DEFAULT 0,
    frequency_mode TEXT NOT NULL DEFAULT 'weekly_target',
    frequency_days TEXT,
    created_at INTEGER
  );
  CREATE TABLE routine_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_item_id INTEGER NOT NULL REFERENCES routine_items(id),
    log_date TEXT NOT NULL, status TEXT NOT NULL,
    value_weight REAL, value_length REAL, value_duration REAL,
    value_sets INTEGER, value_reps INTEGER,
    created_at INTEGER
  );
  CREATE UNIQUE INDEX routine_logs_item_date_idx ON routine_logs(routine_item_id, log_date);
`

const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  INSERT INTO exercises (id, name, modality, muscle_group, equipment)
  VALUES (10, 'Bench Press', 'resistance', 'Chest', 'Barbell');
`

describe('T096: template_sections schema', () => {
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

  describe('template_sections table exists with correct columns', () => {
    it('has all required columns', () => {
      const cols = sqlite
        .prepare("PRAGMA table_info('template_sections')")
        .all() as Array<{ name: string; type: string; notnull: number }>

      const colMap = new Map(cols.map((c) => [c.name, c]))

      // Required columns
      expect(colMap.has('id')).toBe(true)
      expect(colMap.has('template_id')).toBe(true)
      expect(colMap.has('modality')).toBe(true)
      expect(colMap.has('section_name')).toBe(true)
      expect(colMap.has('order')).toBe(true)
      expect(colMap.has('created_at')).toBe(true)

      // Running fields
      expect(colMap.has('run_type')).toBe(true)
      expect(colMap.has('target_pace')).toBe(true)
      expect(colMap.has('hr_zone')).toBe(true)
      expect(colMap.has('interval_count')).toBe(true)
      expect(colMap.has('interval_rest')).toBe(true)
      expect(colMap.has('coaching_cues')).toBe(true)

      // MMA field
      expect(colMap.has('planned_duration')).toBe(true)

      // NOT NULL constraints
      expect(colMap.get('template_id')!.notnull).toBe(1)
      expect(colMap.get('modality')!.notnull).toBe(1)
      expect(colMap.get('section_name')!.notnull).toBe(1)
      expect(colMap.get('order')!.notnull).toBe(1)
    })

    it('can insert and read via Drizzle ORM', () => {
      // Create a mixed template
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      const result = db
        .insert(schema.template_sections)
        .values({
          template_id: 1,
          modality: 'resistance',
          section_name: 'Strength Block',
          order: 1,
          created_at: new Date(),
        })
        .returning()
        .get()

      expect(result.id).toBe(1)
      expect(result.template_id).toBe(1)
      expect(result.modality).toBe('resistance')
      expect(result.section_name).toBe('Strength Block')
      expect(result.order).toBe(1)
    })

    it('stores running-specific fields on running sections', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      const result = db
        .insert(schema.template_sections)
        .values({
          template_id: 1,
          modality: 'running',
          section_name: 'Cooldown Run',
          order: 2,
          run_type: 'easy',
          target_pace: '6:00',
          hr_zone: 2,
          interval_count: null,
          interval_rest: null,
          coaching_cues: 'Easy pace, nose breathing',
        })
        .returning()
        .get()

      expect(result.run_type).toBe('easy')
      expect(result.target_pace).toBe('6:00')
      expect(result.hr_zone).toBe(2)
      expect(result.coaching_cues).toBe('Easy pace, nose breathing')
    })

    it('stores MMA-specific planned_duration on mma sections', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      const result = db
        .insert(schema.template_sections)
        .values({
          template_id: 1,
          modality: 'mma',
          section_name: 'BJJ Sparring',
          order: 3,
          planned_duration: 30,
        })
        .returning()
        .get()

      expect(result.planned_duration).toBe(30)
    })
  })

  describe('foreign keys', () => {
    it('template_sections.template_id references workout_templates with CASCADE delete', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      db.insert(schema.template_sections)
        .values({
          template_id: 1,
          modality: 'resistance',
          section_name: 'Strength',
          order: 1,
        })
        .run()

      // Verify section exists
      const before = db.select().from(schema.template_sections).all()
      expect(before).toHaveLength(1)

      // Delete template — section should cascade
      sqlite.exec('DELETE FROM workout_templates WHERE id = 1')

      const after = db.select().from(schema.template_sections).all()
      expect(after).toHaveLength(0)
    })

    it('template_sections rejects invalid template_id', () => {
      expect(() => {
        db.insert(schema.template_sections)
          .values({
            template_id: 999,
            modality: 'resistance',
            section_name: 'Bad Ref',
            order: 1,
          })
          .run()
      }).toThrow()
    })

    it('exercise_slots.section_id references template_sections', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      const section = db
        .insert(schema.template_sections)
        .values({
          template_id: 1,
          modality: 'resistance',
          section_name: 'Strength',
          order: 1,
        })
        .returning()
        .get()

      const slot = db
        .insert(schema.exercise_slots)
        .values({
          template_id: 1,
          exercise_id: 10,
          section_id: section.id,
          sets: 3,
          reps: '8',
          order: 1,
        })
        .returning()
        .get()

      expect(slot.section_id).toBe(section.id)
    })

    it('exercise_slots rejects invalid section_id', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      expect(() => {
        db.insert(schema.exercise_slots)
          .values({
            template_id: 1,
            exercise_id: 10,
            section_id: 999,
            sets: 3,
            reps: '8',
            order: 1,
          })
          .run()
      }).toThrow()
    })
  })

  describe('workout_templates.modality accepts mixed', () => {
    it('can create a template with modality=mixed', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mixed Session', 'mixed-session', 'mixed');
      `)

      const result = db
        .select()
        .from(schema.workout_templates)
        .all()

      expect(result).toHaveLength(1)
      expect(result[0].modality).toBe('mixed')
    })
  })

  describe('backward compatibility', () => {
    it('exercise_slots without section_id still work (null)', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push Day', 'push-day', 'resistance');
      `)

      const slot = db
        .insert(schema.exercise_slots)
        .values({
          template_id: 1,
          exercise_id: 10,
          sets: 3,
          reps: '8',
          order: 1,
        })
        .returning()
        .get()

      expect(slot.section_id).toBeNull()
    })

    it('existing single-modality templates are unaffected', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push Day', 'push-day', 'resistance');

        INSERT INTO exercise_slots (template_id, exercise_id, sets, reps, "order")
        VALUES (1, 10, 3, '8', 1);
      `)

      const templates = db.select().from(schema.workout_templates).all()
      const slots = db.select().from(schema.exercise_slots).all()

      expect(templates).toHaveLength(1)
      expect(templates[0].modality).toBe('resistance')
      expect(slots).toHaveLength(1)
      expect(slots[0].section_id).toBeNull()
    })
  })

  describe('Drizzle schema exports', () => {
    it('template_sections is exported from schema', () => {
      expect(schema.template_sections).toBeDefined()
    })

    it('exercise_slots has section_id column', () => {
      expect(schema.exercise_slots.section_id).toBeDefined()
    })
  })
})

describe('T126: distance/duration + superset schema', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
    sqlite.exec(CREATE_SQL)
    sqlite.exec(SEED_SQL)

    // Shared setup: template + section for reuse
    sqlite.exec(`
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Morning Run', 'morning-run', 'running');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Day', 'push-day', 'resistance');
    `)
  })

  afterEach(() => {
    sqlite?.close()
  })

  describe('workout_templates: target_distance and target_duration columns', () => {
    it('columns exist with correct types', () => {
      const cols = sqlite
        .prepare("PRAGMA table_info('workout_templates')")
        .all() as Array<{ name: string; type: string; notnull: number }>
      const colMap = new Map(cols.map((c) => [c.name, c]))

      expect(colMap.has('target_distance')).toBe(true)
      expect(colMap.get('target_distance')!.type).toBe('REAL')
      expect(colMap.get('target_distance')!.notnull).toBe(0)

      expect(colMap.has('target_duration')).toBe(true)
      expect(colMap.get('target_duration')!.type).toBe('INTEGER')
      expect(colMap.get('target_duration')!.notnull).toBe(0)
    })

    it('stores target_distance via Drizzle ORM', () => {
      const result = db
        .insert(schema.workout_templates)
        .values({
          mesocycle_id: 1,
          name: 'Long Run',
          canonical_name: 'long-run',
          modality: 'running',
          run_type: 'long',
          target_distance: 10.5,
        })
        .returning()
        .get()

      expect(result.target_distance).toBe(10.5)
      expect(result.target_duration).toBeNull()
    })

    it('stores target_duration via Drizzle ORM', () => {
      const result = db
        .insert(schema.workout_templates)
        .values({
          mesocycle_id: 1,
          name: 'Tempo Run',
          canonical_name: 'tempo-run',
          modality: 'running',
          run_type: 'tempo',
          target_duration: 30,
        })
        .returning()
        .get()

      expect(result.target_duration).toBe(30)
      expect(result.target_distance).toBeNull()
    })

    it('stores both fields together', () => {
      const result = db
        .insert(schema.workout_templates)
        .values({
          mesocycle_id: 1,
          name: 'Race',
          canonical_name: 'race',
          modality: 'running',
          run_type: 'race',
          target_distance: 5.0,
          target_duration: 25,
        })
        .returning()
        .get()

      expect(result.target_distance).toBe(5.0)
      expect(result.target_duration).toBe(25)
    })

    it('defaults to null when omitted', () => {
      const result = db
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t) => t.id === 1)!

      expect(result.target_distance).toBeNull()
      expect(result.target_duration).toBeNull()
    })
  })

  describe('template_sections: target_distance and target_duration columns', () => {
    it('columns exist with correct types', () => {
      const cols = sqlite
        .prepare("PRAGMA table_info('template_sections')")
        .all() as Array<{ name: string; type: string; notnull: number }>
      const colMap = new Map(cols.map((c) => [c.name, c]))

      expect(colMap.has('target_distance')).toBe(true)
      expect(colMap.get('target_distance')!.type).toBe('REAL')
      expect(colMap.get('target_distance')!.notnull).toBe(0)

      expect(colMap.has('target_duration')).toBe(true)
      expect(colMap.get('target_duration')!.type).toBe('INTEGER')
      expect(colMap.get('target_duration')!.notnull).toBe(0)
    })

    it('stores distance/duration on running section', () => {
      sqlite.exec(`
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'Mixed', 'mixed', 'mixed');
      `)

      const result = db
        .insert(schema.template_sections)
        .values({
          template_id: 3,
          modality: 'running',
          section_name: 'Warmup Run',
          order: 1,
          run_type: 'easy',
          target_distance: 2.0,
          target_duration: 15,
        })
        .returning()
        .get()

      expect(result.target_distance).toBe(2.0)
      expect(result.target_duration).toBe(15)
    })
  })

  describe('exercise_slots: group_id and group_rest_seconds columns', () => {
    it('columns exist with correct types', () => {
      const cols = sqlite
        .prepare("PRAGMA table_info('exercise_slots')")
        .all() as Array<{ name: string; type: string; notnull: number }>
      const colMap = new Map(cols.map((c) => [c.name, c]))

      expect(colMap.has('group_id')).toBe(true)
      expect(colMap.get('group_id')!.type).toBe('INTEGER')
      expect(colMap.get('group_id')!.notnull).toBe(0)

      expect(colMap.has('group_rest_seconds')).toBe(true)
      expect(colMap.get('group_rest_seconds')!.type).toBe('INTEGER')
      expect(colMap.get('group_rest_seconds')!.notnull).toBe(0)
    })

    it('stores superset group via Drizzle ORM', () => {
      const slot1 = db
        .insert(schema.exercise_slots)
        .values({
          template_id: 2,
          exercise_id: 10,
          sets: 3,
          reps: '10',
          order: 1,
          group_id: 1,
          group_rest_seconds: 90,
        })
        .returning()
        .get()

      expect(slot1.group_id).toBe(1)
      expect(slot1.group_rest_seconds).toBe(90)
    })

    it('defaults to null when omitted (backward compat)', () => {
      const slot = db
        .insert(schema.exercise_slots)
        .values({
          template_id: 2,
          exercise_id: 10,
          sets: 3,
          reps: '8',
          order: 1,
        })
        .returning()
        .get()

      expect(slot.group_id).toBeNull()
      expect(slot.group_rest_seconds).toBeNull()
    })

    it('group_rest_seconds=0 is valid', () => {
      const slot = db
        .insert(schema.exercise_slots)
        .values({
          template_id: 2,
          exercise_id: 10,
          sets: 3,
          reps: '8',
          order: 1,
          group_id: 1,
          group_rest_seconds: 0,
        })
        .returning()
        .get()

      expect(slot.group_rest_seconds).toBe(0)
    })
  })

  describe('Drizzle schema exports for T126', () => {
    it('workout_templates has target_distance column', () => {
      expect(schema.workout_templates.target_distance).toBeDefined()
    })

    it('workout_templates has target_duration column', () => {
      expect(schema.workout_templates.target_duration).toBeDefined()
    })

    it('template_sections has target_distance column', () => {
      expect(schema.template_sections.target_distance).toBeDefined()
    })

    it('template_sections has target_duration column', () => {
      expect(schema.template_sections.target_duration).toBeDefined()
    })

    it('exercise_slots has group_id column', () => {
      expect(schema.exercise_slots.group_id).toBeDefined()
    })

    it('exercise_slots has group_rest_seconds column', () => {
      expect(schema.exercise_slots.group_rest_seconds).toBeDefined()
    })
  })

  describe('Drizzle schema exports for T177', () => {
    it('workout_templates has target_elevation_gain integer column', () => {
      const cols = getTableColumns(schema.workout_templates)
      expect(cols).toHaveProperty('target_elevation_gain')
      expect(cols.target_elevation_gain.columnType).toBe('SQLiteInteger')
      expect(cols.target_elevation_gain.notNull).toBe(false)
    })

    it('template_sections has target_elevation_gain integer column', () => {
      const cols = getTableColumns(schema.template_sections)
      expect(cols).toHaveProperty('target_elevation_gain')
      expect(cols.target_elevation_gain.columnType).toBe('SQLiteInteger')
      expect(cols.target_elevation_gain.notNull).toBe(false)
    })

    it('slot_week_overrides has elevation_gain integer column', () => {
      const cols = getTableColumns(schema.slot_week_overrides)
      expect(cols).toHaveProperty('elevation_gain')
      expect(cols.elevation_gain.columnType).toBe('SQLiteInteger')
      expect(cols.elevation_gain.notNull).toBe(false)
    })

    it('template_week_overrides has elevation_gain integer column', () => {
      const cols = getTableColumns(schema.template_week_overrides)
      expect(cols).toHaveProperty('elevation_gain')
      expect(cols.elevation_gain.columnType).toBe('SQLiteInteger')
      expect(cols.elevation_gain.notNull).toBe(false)
    })
  })
})
