// T200: Tests for time-first calendar projection — duration field, time_slot key, time_slot sorting
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getCalendarProjection } from './queries'

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
    CREATE TABLE weekly_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      week_type TEXT NOT NULL DEFAULT 'normal',
      period TEXT NOT NULL DEFAULT 'morning',
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      created_at INTEGER
    );
    CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_template_idx
      ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id);
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
  `)

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  return { sqlite, db }
}

describe('getCalendarProjection — T200 time-first model', () => {
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
    sqlite.exec('DELETE FROM schedule_week_overrides')
    sqlite.exec('DELETE FROM logged_workouts')
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
  })

  // ── duration field in CalendarDay ───────────────────────────────────
  describe('duration field', () => {
    it('includes duration from schedule entry', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks) VALUES (1, 'A', '2026-03-02', '2026-03-29', 4);
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, duration)
        VALUES (1, 0, 1, 'normal', 'morning', '08:00', 60);
      `)

      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.duration).toBe(60)
    })

    it('rest day has null duration', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days[0].duration).toBeNull()
    })

    it('includes duration from override entry', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks) VALUES (1, 'A', '2026-03-02', '2026-03-29', 4);
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, duration)
        VALUES (1, 0, 1, 'normal', 'morning', '08:00', 60);
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 0, 'morning', 1, '08:00', 45, 'grp-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Mar 2 = Mon, week 1 — override applies
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.duration).toBe(45)
    })
  })

  // ── time_slot-based override lookup key ─────────────────────────────
  describe('time_slot-based override lookup', () => {
    it('override key uses time_slot not period', async () => {
      // Override at same time_slot replaces base; override at different time_slot adds entry
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks) VALUES (1, 'A', '2026-03-02', '2026-03-29', 4);
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (2, 1, 'Run', 'run', 'running');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, duration)
        VALUES (1, 0, 1, 'normal', 'morning', '08:00', 60);
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 0, 'evening', 2, '18:00', 30, 'grp-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Mar 2 = Mon, week 1. Base 08:00 + override adds 18:00 (different time_slot)
      const mar2 = result.days.filter((d) => d.date === '2026-03-02')
      expect(mar2).toHaveLength(2)
      expect(mar2[0].time_slot).toBe('08:00')
      expect(mar2[0].template_name).toBe('Push')
      expect(mar2[1].time_slot).toBe('18:00')
      expect(mar2[1].template_name).toBe('Run')
    })
  })

  // ── time_slot ascending sort ────────────────────────────────────────
  describe('sort by time_slot ascending', () => {
    it('sorts multi-session days by time_slot not period', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks) VALUES (1, 'A', '2026-03-02', '2026-03-29', 4);
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (1, 1, 'A', 'a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (2, 1, 'B', 'b', 'running');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (3, 1, 'C', 'c', 'mma');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 3, 'normal', 'evening', '18:00');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 2, 'normal', 'afternoon', '14:00');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      const entries = result.days.filter((d) => d.date === '2026-03-02')
      expect(entries).toHaveLength(3)
      expect(entries[0].time_slot).toBe('07:00')
      expect(entries[0].template_name).toBe('A')
      expect(entries[1].time_slot).toBe('14:00')
      expect(entries[1].template_name).toBe('B')
      expect(entries[2].time_slot).toBe('18:00')
      expect(entries[2].template_name).toBe('C')
    })

    it('afternoon at 06:00 sorts before morning at 09:00 (time_slot wins)', async () => {
      // Unusual: period says afternoon but time_slot is early. Time_slot should win for sort.
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks) VALUES (1, 'A', '2026-03-02', '2026-03-29', 4);
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (1, 1, 'Early', 'early', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality) VALUES (2, 1, 'Late', 'late', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 2, 'normal', 'morning', '09:00');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 1, 'normal', 'afternoon', '06:00');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      const entries = result.days.filter((d) => d.date === '2026-03-02')
      expect(entries).toHaveLength(2)
      // 06:00 sorts before 09:00 regardless of period label
      expect(entries[0].time_slot).toBe('06:00')
      expect(entries[0].template_name).toBe('Early')
      expect(entries[1].time_slot).toBe('09:00')
      expect(entries[1].template_name).toBe('Late')
    })
  })
})
