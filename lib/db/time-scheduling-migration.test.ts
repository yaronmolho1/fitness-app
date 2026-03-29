import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getTableColumns } from 'drizzle-orm'
import * as schema from './schema'
import * as relationsModule from './relations'
import type { AppDb } from '.'

let sqlite: Database.Database
let db: AppDb

// Pre-migration schema (current production state)
const OLD_SCHEMA_SQL = `
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
    section_name TEXT NOT NULL, "order" INTEGER NOT NULL,
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
  CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_period_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, period);
  CREATE TABLE athlete_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    age INTEGER, weight_kg REAL, height_cm REAL, gender TEXT,
    training_age_years INTEGER, primary_goal TEXT, injury_history TEXT,
    created_at INTEGER, updated_at INTEGER
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
  CREATE TABLE slot_week_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL, weight REAL, reps TEXT, sets INTEGER,
    rpe REAL, distance REAL, duration INTEGER, pace TEXT,
    elevation_gain INTEGER, is_deload INTEGER NOT NULL DEFAULT 0, created_at INTEGER
  );
  CREATE UNIQUE INDEX slot_week_overrides_slot_week_idx ON slot_week_overrides(exercise_slot_id, week_number);
  CREATE TABLE template_week_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    section_id INTEGER REFERENCES template_sections(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL, distance REAL, duration INTEGER,
    pace TEXT, planned_duration INTEGER, interval_count INTEGER,
    interval_rest INTEGER, elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0, created_at INTEGER
  );
  CREATE UNIQUE INDEX template_week_overrides_tmpl_sec_week_idx ON template_week_overrides(template_id, section_id, week_number);
`

// Seed data for backfill testing
const SEED_SQL = `
  INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, status)
  VALUES (1, 'Block A', '2026-03-01', '2026-04-01', 4, 'active');

  -- Resistance template
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (1, 1, 'Push Day', 'push-day', 'resistance');

  -- Running template with target_duration
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, target_duration)
  VALUES (2, 1, 'Easy Run', 'easy-run', 'running', 45);

  -- Running template without target_duration
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (3, 1, 'Tempo Run', 'tempo-run', 'running');

  -- MMA template with planned_duration
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality, planned_duration)
  VALUES (4, 1, 'BJJ Class', 'bjj-class', 'mma', 120);

  -- MMA template without planned_duration
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (5, 1, 'MMA Sparring', 'mma-sparring', 'mma');

  -- Mixed template
  INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
  VALUES (6, 1, 'Mixed Session', 'mixed-session', 'mixed');

  -- weekly_schedule entries with various periods and time_slots
  -- AC1: morning, null time_slot -> 07:00
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (1, 1, 1, 1, 'normal', 'morning', NULL);

  -- AC2: afternoon, null time_slot -> 13:00
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (2, 1, 2, 2, 'normal', 'afternoon', NULL);

  -- AC3: evening, null time_slot -> 18:00
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (3, 1, 3, 3, 'normal', 'evening', NULL);

  -- AC4: already has time_slot -> preserve
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (4, 1, 4, 4, 'normal', 'morning', '06:30');

  -- AC6: resistance template -> duration 90
  -- (id=1 above, template_id=1 resistance)

  -- AC7: running with target_duration -> duration = target_duration (45)
  -- (id=2, template_id=2)

  -- AC7: running without target_duration -> duration 60
  -- (id=3, template_id=3)

  -- AC8: MMA with planned_duration -> duration = planned_duration (120)
  -- (id=4, template_id=4)

  -- MMA without planned_duration -> duration 90
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (5, 1, 5, 5, 'normal', 'morning', NULL);

  -- AC9: mixed template -> duration 90
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (6, 1, 6, 6, 'normal', 'morning', NULL);

  -- Null template_id (rest day) -> duration 60
  INSERT INTO weekly_schedule (id, mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
  VALUES (7, 1, 0, NULL, 'normal', 'morning', NULL);

  -- schedule_week_overrides entries (AC5, AC10)
  INSERT INTO schedule_week_overrides (id, mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
  VALUES (1, 1, 2, 1, 'evening', 1, NULL, 'swap');

  INSERT INTO schedule_week_overrides (id, mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
  VALUES (2, 1, 2, 2, 'afternoon', 2, '14:00', 'swap');
`

// Read the migration SQL file and strip drizzle statement breakpoints
function getMigrationSQL(): string {
  const migrationPath = resolve(__dirname, 'migrations/0017_mixed_shatterstar.sql')
  const raw = readFileSync(migrationPath, 'utf-8')
  return raw.replace(/--> statement-breakpoint/g, '')
}

function runMigration(database: Database.Database) {
  const sql = getMigrationSQL()
  database.exec(sql)
}

describe('T197: Time scheduling migration (3-phase)', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
    sqlite.exec(OLD_SCHEMA_SQL)
    sqlite.exec(SEED_SQL)
  })

  afterEach(() => {
    sqlite?.close()
  })

  describe('Phase 1: New columns and tables', () => {
    it('AC17: workout_templates gains estimated_duration column', () => {
      runMigration(sqlite)
      const cols = sqlite
        .prepare("PRAGMA table_info('workout_templates')")
        .all() as Array<{ name: string; type: string; notnull: number }>
      const colMap = new Map(cols.map((c) => [c.name, c]))
      expect(colMap.has('estimated_duration')).toBe(true)
      expect(colMap.get('estimated_duration')!.type).toBe('INTEGER')
      expect(colMap.get('estimated_duration')!.notnull).toBe(0)
    })

    it('AC18: athlete_profile gains timezone column with default UTC', () => {
      runMigration(sqlite)
      const cols = sqlite
        .prepare("PRAGMA table_info('athlete_profile')")
        .all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>
      const colMap = new Map(cols.map((c) => [c.name, c]))
      expect(colMap.has('timezone')).toBe(true)
      expect(colMap.get('timezone')!.type).toBe('TEXT')
      expect(colMap.get('timezone')!.dflt_value).toBe("'UTC'")
    })

    it('AC15: google_credentials table is created', () => {
      runMigration(sqlite)
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='google_credentials'")
        .all()
      expect(tables).toHaveLength(1)
    })

    it('AC16: google_calendar_events table is created with foreign keys and unique index', () => {
      runMigration(sqlite)
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='google_calendar_events'")
        .all()
      expect(tables).toHaveLength(1)

      // Verify unique index exists
      const indexes = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='google_calendar_events'")
        .all() as Array<{ name: string }>
      expect(indexes.length).toBeGreaterThan(0)
    })
  })

  describe('Phase 2: Backfill time_slot', () => {
    it('AC1: morning period with null time_slot -> 07:00', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT time_slot FROM weekly_schedule WHERE id = 1').get() as { time_slot: string }
      expect(row.time_slot).toBe('07:00')
    })

    it('AC2: afternoon period with null time_slot -> 13:00', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT time_slot FROM weekly_schedule WHERE id = 2').get() as { time_slot: string }
      expect(row.time_slot).toBe('13:00')
    })

    it('AC3: evening period with null time_slot -> 18:00', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT time_slot FROM weekly_schedule WHERE id = 3').get() as { time_slot: string }
      expect(row.time_slot).toBe('18:00')
    })

    it('AC4: existing time_slot is preserved', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT time_slot FROM weekly_schedule WHERE id = 4').get() as { time_slot: string }
      expect(row.time_slot).toBe('06:30')
    })

    it('AC5: schedule_week_overrides gets same backfill rules', () => {
      runMigration(sqlite)
      // id=1: evening, null time_slot -> 18:00
      const row1 = sqlite.prepare('SELECT time_slot FROM schedule_week_overrides WHERE id = 1').get() as { time_slot: string }
      expect(row1.time_slot).toBe('18:00')

      // id=2: afternoon, existing time_slot '14:00' -> preserved
      const row2 = sqlite.prepare('SELECT time_slot FROM schedule_week_overrides WHERE id = 2').get() as { time_slot: string }
      expect(row2.time_slot).toBe('14:00')
    })
  })

  describe('Phase 2: Backfill duration', () => {
    it('AC6: resistance template -> duration 90', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 1').get() as { duration: number }
      expect(row.duration).toBe(90)
    })

    it('AC7: running template with target_duration -> uses target_duration', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 2').get() as { duration: number }
      expect(row.duration).toBe(45)
    })

    it('AC7: running template without target_duration -> 60', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 3').get() as { duration: number }
      expect(row.duration).toBe(60)
    })

    it('AC8: MMA template with planned_duration -> uses planned_duration', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 4').get() as { duration: number }
      expect(row.duration).toBe(120)
    })

    it('AC8: MMA template without planned_duration -> 90', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 5').get() as { duration: number }
      expect(row.duration).toBe(90)
    })

    it('AC9: mixed template -> duration 90', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 6').get() as { duration: number }
      expect(row.duration).toBe(90)
    })

    it('null template_id (rest day) -> duration 60', () => {
      runMigration(sqlite)
      const row = sqlite.prepare('SELECT duration FROM weekly_schedule WHERE id = 7').get() as { duration: number }
      expect(row.duration).toBe(60)
    })

    it('AC10: schedule_week_overrides gets same duration backfill', () => {
      runMigration(sqlite)
      // id=1: resistance template -> 90
      const row1 = sqlite.prepare('SELECT duration FROM schedule_week_overrides WHERE id = 1').get() as { duration: number }
      expect(row1.duration).toBe(90)

      // id=2: running template with target_duration=45 -> 45
      const row2 = sqlite.prepare('SELECT duration FROM schedule_week_overrides WHERE id = 2').get() as { duration: number }
      expect(row2.duration).toBe(45)
    })
  })

  describe('Phase 3: Constraint enforcement', () => {
    it('AC11: time_slot is NOT NULL on weekly_schedule after migration', () => {
      runMigration(sqlite)
      const cols = sqlite
        .prepare("PRAGMA table_info('weekly_schedule')")
        .all() as Array<{ name: string; notnull: number }>
      const timeSlotCol = cols.find((c) => c.name === 'time_slot')
      expect(timeSlotCol).toBeDefined()
      expect(timeSlotCol!.notnull).toBe(1)
    })

    it('AC11: time_slot is NOT NULL on schedule_week_overrides after migration', () => {
      runMigration(sqlite)
      const cols = sqlite
        .prepare("PRAGMA table_info('schedule_week_overrides')")
        .all() as Array<{ name: string; notnull: number }>
      const timeSlotCol = cols.find((c) => c.name === 'time_slot')
      expect(timeSlotCol).toBeDefined()
      expect(timeSlotCol!.notnull).toBe(1)
    })

    it('AC12: duration is NOT NULL on weekly_schedule after migration', () => {
      runMigration(sqlite)
      const cols = sqlite
        .prepare("PRAGMA table_info('weekly_schedule')")
        .all() as Array<{ name: string; notnull: number }>
      const durationCol = cols.find((c) => c.name === 'duration')
      expect(durationCol).toBeDefined()
      expect(durationCol!.notnull).toBe(1)
    })

    it('AC12: duration is NOT NULL on schedule_week_overrides after migration', () => {
      runMigration(sqlite)
      const cols = sqlite
        .prepare("PRAGMA table_info('schedule_week_overrides')")
        .all() as Array<{ name: string; notnull: number }>
      const durationCol = cols.find((c) => c.name === 'duration')
      expect(durationCol).toBeDefined()
      expect(durationCol!.notnull).toBe(1)
    })

    it('AC13: new unique index on weekly_schedule (mesocycle_id, day_of_week, week_type, time_slot, template_id)', () => {
      runMigration(sqlite)
      const indexes = sqlite
        .prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='weekly_schedule' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ sql: string }>

      // Old index should be gone
      const oldIdx = indexes.find((i) => i.sql && i.sql.includes('period'))
      expect(oldIdx).toBeUndefined()

      // New index should exist with the 5 columns
      const newIdx = indexes.find((i) => i.sql && i.sql.includes('time_slot') && i.sql.includes('template_id'))
      expect(newIdx).toBeDefined()
    })

    it('AC14: new unique index on schedule_week_overrides (mesocycle_id, week_number, day_of_week, time_slot, template_id)', () => {
      runMigration(sqlite)
      const indexes = sqlite
        .prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='schedule_week_overrides' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ sql: string }>

      // Old index should be gone
      const oldIdx = indexes.find((i) => i.sql && i.sql.includes('period'))
      expect(oldIdx).toBeUndefined()

      // New index should exist
      const newIdx = indexes.find((i) => i.sql && i.sql.includes('time_slot') && i.sql.includes('template_id'))
      expect(newIdx).toBeDefined()
    })
  })

  describe('Migration integrity', () => {
    it('AC19: row count preserved after migration', () => {
      const beforeWS = (sqlite.prepare('SELECT COUNT(*) as cnt FROM weekly_schedule').get() as { cnt: number }).cnt
      const beforeSWO = (sqlite.prepare('SELECT COUNT(*) as cnt FROM schedule_week_overrides').get() as { cnt: number }).cnt

      runMigration(sqlite)

      const afterWS = (sqlite.prepare('SELECT COUNT(*) as cnt FROM weekly_schedule').get() as { cnt: number }).cnt
      const afterSWO = (sqlite.prepare('SELECT COUNT(*) as cnt FROM schedule_week_overrides').get() as { cnt: number }).cnt

      expect(afterWS).toBe(beforeWS)
      expect(afterSWO).toBe(beforeSWO)
    })

    it('AC20: no null time_slot or duration after migration', () => {
      runMigration(sqlite)

      const nullTimeSlotWS = (sqlite.prepare('SELECT COUNT(*) as cnt FROM weekly_schedule WHERE time_slot IS NULL').get() as { cnt: number }).cnt
      const nullDurationWS = (sqlite.prepare('SELECT COUNT(*) as cnt FROM weekly_schedule WHERE duration IS NULL').get() as { cnt: number }).cnt
      const nullTimeSlotSWO = (sqlite.prepare('SELECT COUNT(*) as cnt FROM schedule_week_overrides WHERE time_slot IS NULL').get() as { cnt: number }).cnt
      const nullDurationSWO = (sqlite.prepare('SELECT COUNT(*) as cnt FROM schedule_week_overrides WHERE duration IS NULL').get() as { cnt: number }).cnt

      expect(nullTimeSlotWS).toBe(0)
      expect(nullDurationWS).toBe(0)
      expect(nullTimeSlotSWO).toBe(0)
      expect(nullDurationSWO).toBe(0)
    })

    it('empty database: migration succeeds with no data', () => {
      const emptySqlite = new Database(':memory:')
      emptySqlite.pragma('foreign_keys = ON')
      emptySqlite.exec(OLD_SCHEMA_SQL)
      // No seed data
      expect(() => {
        emptySqlite.exec(getMigrationSQL() || 'SELECT 1')
      }).not.toThrow()
      emptySqlite.close()
    })
  })

  describe('Drizzle schema exports for T197', () => {
    it('weekly_schedule has duration column', () => {
      const cols = getTableColumns(schema.weekly_schedule)
      expect(cols).toHaveProperty('duration')
      expect(cols.duration.columnType).toBe('SQLiteInteger')
    })

    it('weekly_schedule.time_slot is NOT NULL in schema', () => {
      const cols = getTableColumns(schema.weekly_schedule)
      expect(cols.time_slot.notNull).toBe(true)
    })

    it('weekly_schedule.duration is NOT NULL in schema', () => {
      const cols = getTableColumns(schema.weekly_schedule)
      expect(cols.duration.notNull).toBe(true)
    })

    it('schedule_week_overrides has duration column', () => {
      const cols = getTableColumns(schema.schedule_week_overrides)
      expect(cols).toHaveProperty('duration')
      expect(cols.duration.columnType).toBe('SQLiteInteger')
    })

    it('schedule_week_overrides.time_slot is NOT NULL in schema', () => {
      const cols = getTableColumns(schema.schedule_week_overrides)
      expect(cols.time_slot.notNull).toBe(true)
    })

    it('schedule_week_overrides.duration is NOT NULL in schema', () => {
      const cols = getTableColumns(schema.schedule_week_overrides)
      expect(cols.duration.notNull).toBe(true)
    })

    it('workout_templates has estimated_duration column', () => {
      const cols = getTableColumns(schema.workout_templates)
      expect(cols).toHaveProperty('estimated_duration')
      expect(cols.estimated_duration.columnType).toBe('SQLiteInteger')
      expect(cols.estimated_duration.notNull).toBe(false)
    })

    it('athlete_profile has timezone column', () => {
      const cols = getTableColumns(schema.athlete_profile)
      expect(cols).toHaveProperty('timezone')
    })

    it('google_credentials table is exported', () => {
      expect(schema.google_credentials).toBeDefined()
    })

    it('google_calendar_events table is exported', () => {
      expect(schema.google_calendar_events).toBeDefined()
    })
  })
})
