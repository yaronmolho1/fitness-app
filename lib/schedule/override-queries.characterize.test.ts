// Characterization test — captures current behavior for safe refactoring
// T200: getEffectiveScheduleForDay edge cases not covered by override-queries.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getEffectiveScheduleForDay } from './override-queries'

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

describe('getEffectiveScheduleForDay — characterization', () => {
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
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
  })

  // ── Return type shape ───────────────────────────────────────────────
  describe('return type shape', () => {
    it('each entry has all EffectiveScheduleEntry fields', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 1, 'normal', 'morning', '08:00');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        template_id: 1,
        period: 'morning',
        time_slot: '08:00',
        duration: 90,
        is_override: false,
        override_group: null,
      })
    })

    it('override entry has all fields including override_group', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
        VALUES (1, 1, 0, 'morning', 1, 'grp-123');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result[0].is_override).toBe(true)
      expect(result[0].override_group).toBe('grp-123')
    })
  })

  // ── Base schedule with null template_id ─────────────────────────────
  describe('base schedule with null template_id', () => {
    it('passes through null template_id from base schedule', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, NULL, 'normal', 'morning');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result).toHaveLength(1)
      expect(result[0].template_id).toBeNull()
      expect(result[0].is_override).toBe(false)
    })
  })

  // ── Multiple overrides on same day, different periods ───────────────
  describe('multiple override-only entries (no base)', () => {
    it('adds entries for all override periods when base is empty', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Run', 'run', 'running');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
        VALUES (1, 1, 0, 'morning', 1, 'grp-1');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group, time_slot)
        VALUES (1, 1, 0, 'evening', 2, 'grp-1', '18:00');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result).toHaveLength(2)
      expect(result[0].period).toBe('morning')
      expect(result[0].template_id).toBe(1)
      expect(result[0].is_override).toBe(true)
      expect(result[1].period).toBe('evening')
      expect(result[1].template_id).toBe(2)
      expect(result[1].is_override).toBe(true)
    })
  })

  // ── Override replaces base + adds new period simultaneously ─────────
  describe('mixed base and override-only entries', () => {
    it('base morning overridden + override adds afternoon (no base afternoon)', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'Run', 'run', 'running');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        -- Override replaces morning
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
        VALUES (1, 2, 0, 'morning', 2, 'grp-x');
        -- Override adds afternoon (no base afternoon)
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group, time_slot)
        VALUES (1, 2, 0, 'afternoon', 3, 'grp-x', '14:00');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 2, 0, 'normal')
      expect(result).toHaveLength(2)
      // Sorted: morning first, afternoon second
      expect(result[0].period).toBe('morning')
      expect(result[0].template_id).toBe(2)
      expect(result[0].is_override).toBe(true)
      expect(result[1].period).toBe('afternoon')
      expect(result[1].template_id).toBe(3)
      expect(result[1].is_override).toBe(true)
    })
  })

  // ── Day of week scoping ─────────────────────────────────────────────
  describe('day_of_week scoping', () => {
    it('different days on same mesocycle/week are independent', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 2, 2, 'normal', 'morning');
      `)

      const mon = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      const wed = await getEffectiveScheduleForDay(db, 1, 1, 2, 'normal')
      expect(mon).toHaveLength(1)
      expect(mon[0].template_id).toBe(1)
      expect(wed).toHaveLength(1)
      expect(wed[0].template_id).toBe(2)
    })
  })

  // ── Week type filtering ─────────────────────────────────────────────
  describe('week type filtering', () => {
    it('normal weekType does not return deload base entries', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Push DL', 'push-dl', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 2, 'deload', 'morning');
      `)

      // Querying normal weekType — deload-only entry not returned
      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result).toEqual([])
    })

    it('deload weekType does not return normal base entries', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'deload')
      expect(result).toEqual([])
    })
  })

  // ── Overrides don't filter by weekType ──────────────────────────────
  describe('overrides are not filtered by weekType', () => {
    it('overrides apply regardless of weekType parameter', async () => {
      // NOTE: overrides query does not filter by week_type — they are keyed by
      // (mesocycle_id, week_number, day_of_week). This means an override applies
      // whether the caller requests 'normal' or 'deload'.
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
        VALUES (1, 1, 0, 'morning', 1, 'grp-1');
      `)

      // No base schedule for either week type, but override adds entry
      const normal = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      const deload = await getEffectiveScheduleForDay(db, 1, 1, 0, 'deload')
      // NOTE: Both get the override because overrides don't filter by weekType
      expect(normal).toHaveLength(1)
      expect(normal[0].is_override).toBe(true)
      expect(deload).toHaveLength(1)
      expect(deload[0].is_override).toBe(true)
    })
  })

  // ── time_slot default from schema ───────────────────────────────────
  describe('time_slot defaults', () => {
    it('base schedule defaults time_slot to 07:00', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result[0].time_slot).toBe('07:00')
    })

    it('override defaults time_slot to 07:00', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
        VALUES (1, 1, 0, 'morning', 1, 'grp-1');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      expect(result[0].time_slot).toBe('07:00')
    })
  })

  // ── Multiple overrides at different time_slots ──────────────────────
  describe('multiple overrides at different time_slots (same period)', () => {
    it('each override at a distinct time_slot produces a separate entry', async () => {
      // With time_slot-based keying, two overrides at different time_slots
      // are separate entries. The base at 07:00 also remains (no override at that slot).
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
      `)
      // Two overrides at different time_slots (unique index allows this)
      sqlite.exec(`
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
        VALUES (1, 1, 0, 'morning', 1, '08:00', 'grp-a');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
        VALUES (1, 1, 0, 'morning', 2, '09:00', 'grp-b');
      `)

      const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
      // Base at 07:00 (default) + override at 08:00 + override at 09:00 = 3 entries
      expect(result).toHaveLength(3)
      expect(result[0].time_slot).toBe('07:00')
      expect(result[0].template_id).toBe(1)
      expect(result[0].is_override).toBe(false)
      expect(result[1].time_slot).toBe('08:00')
      expect(result[1].template_id).toBe(1)
      expect(result[1].is_override).toBe(true)
      expect(result[2].time_slot).toBe('09:00')
      expect(result[2].template_id).toBe(2)
      expect(result[2].is_override).toBe(true)
    })
  })

  // ── Non-existent mesocycle_id ───────────────────────────────────────
  describe('non-existent mesocycle', () => {
    it('returns empty array for non-existent mesocycle_id', async () => {
      const result = await getEffectiveScheduleForDay(db, 999, 1, 0, 'normal')
      expect(result).toEqual([])
    })
  })
})
