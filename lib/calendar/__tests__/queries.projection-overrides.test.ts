// T185: Calendar projection wires schedule_week_overrides
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import * as relationsModule from '@/lib/db/relations'
import type { AppDb } from '@/lib/db'
import { getCalendarProjection } from '../queries'

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
    CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_template_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id);
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
    CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id);
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
  `)

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  return { sqlite, db }
}

describe('getCalendarProjection — schedule_week_overrides', () => {
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
    sqlite.exec('DELETE FROM logged_workouts')
    sqlite.exec('DELETE FROM schedule_week_overrides')
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
  })

  // ── AC11: Override replaces base schedule in projection ──────────────
  describe('override replaces base schedule entry', () => {
    it('uses overridden template instead of base for specific week/day', async () => {
      // Meso: Mar 2 (Mon) - Mar 29, 4 work weeks
      // Base: Monday morning = Push (template 1)
      // Override: week 2, Monday morning = Pull (template 2)
      // Week 2 Monday = Mar 9
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 2, 0, 'morning', 2, '07:00', 90, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')

      // Week 1 Monday (Mar 2) — no override, base schedule
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.template_name).toBe('Push')
      expect(mar2.status).toBe('projected')

      // Week 2 Monday (Mar 9) — override replaces Push with Pull
      const mar9 = result.days.find((d) => d.date === '2026-03-09')!
      expect(mar9.template_name).toBe('Pull')
      expect(mar9.status).toBe('projected')
      expect(mar9.period).toBe('morning')

      // Week 3 Monday (Mar 16) — no override, base schedule
      const mar16 = result.days.find((d) => d.date === '2026-03-16')!
      expect(mar16.template_name).toBe('Push')
    })
  })

  // ── Override with null template_id = rest (source slot cleared) ──────
  describe('override with null template_id', () => {
    it('source slot becomes rest when override has null template_id', async () => {
      // Move workout away: source slot override has template_id=null
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 0, 'morning', NULL, '07:00', 60, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.template_name).toBeNull()
      expect(mar2.status).toBe('rest')
    })
  })

  // ── Override adds workout to previously empty slot ───────────────────
  describe('override adds session to new period', () => {
    it('target slot gains workout via override on previously rest day', async () => {
      // Base: Monday morning = Push. No Wednesday schedule.
      // Override: week 1, Wednesday evening = Push (moved)
      // Wednesday = day_of_week 2
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 2, 'evening', 1, '18:00', 90, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Mar 4 = Wednesday week 1
      const mar4 = result.days.find(
        (d) => d.date === '2026-03-04' && d.template_name === 'Push'
      )
      expect(mar4).toBeDefined()
      expect(mar4!.period).toBe('evening')
      expect(mar4!.status).toBe('projected')
    })
  })

  // ── Full move: source cleared + target filled ────────────────────────
  describe('full move scenario (source + target overrides)', () => {
    it('AC1: source day becomes rest, target day shows moved workout', async () => {
      // Base: Mon morning = Push, Wed = rest
      // Move Push from Mon to Wed evening for week 3 only
      // Week 3 Mon = Mar 16, Week 3 Wed = Mar 18
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');

        -- Source: clear Mon morning in week 3
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 3, 0, 'morning', NULL, '07:00', 60, 'move-1');
        -- Target: add Push to Wed evening in week 3
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 3, 2, 'evening', 1, '18:00', 90, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')

      // Mar 16 (Mon W3) — override clears it
      const mar16 = result.days.find((d) => d.date === '2026-03-16')!
      expect(mar16.template_name).toBeNull()
      expect(mar16.status).toBe('rest')

      // Mar 18 (Wed W3) — override adds Push
      const mar18 = result.days.find(
        (d) => d.date === '2026-03-18' && d.template_name === 'Push'
      )
      expect(mar18).toBeDefined()
      expect(mar18!.period).toBe('evening')

      // Other weeks unaffected
      // Mar 2 (Mon W1) — still Push
      expect(result.days.find((d) => d.date === '2026-03-02')!.template_name).toBe('Push')
      // Mar 23 (Mon W4) — still Push
      expect(result.days.find((d) => d.date === '2026-03-23')!.template_name).toBe('Push')
    })
  })

  // ── Multi-session: override one period, other unaffected ─────────────
  describe('multi-session override', () => {
    it('AC3: overriding morning time_slot does not affect evening on same day', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Run', 'run', 'running');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 2, 'normal', 'evening', '18:00');

        -- Override only 07:00 time_slot in week 1 (clear it)
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 0, 'morning', NULL, '07:00', 60, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.filter((d) => d.date === '2026-03-02')

      // Morning (07:00) cleared by override
      const morning = mar2.find((d) => d.time_slot === '07:00')!
      expect(morning.template_name).toBeNull()
      expect(morning.status).toBe('rest')

      // Evening (18:00) unaffected
      const evening = mar2.find((d) => d.time_slot === '18:00')!
      expect(evening.template_name).toBe('Run')
      expect(evening.status).toBe('projected')
    })
  })

  // ── Deload week override ─────────────────────────────────────────────
  describe('deload week override', () => {
    it('AC12: override in deload week resolves against deload base schedule', async () => {
      // 2 work weeks + deload. Deload = week 3
      // Base deload: Mon morning = Push DL
      // Override: deload week, Mon morning = Pull DL
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push DL', 'push-dl', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull DL', 'pull-dl', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'deload', 'morning');

        -- Override deload Mon morning with Pull DL
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 3, 0, 'morning', 2, '07:00', 90, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Deload Mon = Mar 16 (week 3)
      const mar16 = result.days.find((d) => d.date === '2026-03-16')!
      expect(mar16.is_deload).toBe(true)
      expect(mar16.template_name).toBe('Pull DL')
    })
  })

  // ── Override with time_slot ──────────────────────────────────────────
  describe('override time_slot', () => {
    it('override at same time_slot replaces the base entry', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00');

        -- Override week 2 Mon 07:00 to a different template
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
        VALUES (1, 2, 0, 'morning', 2, '07:00', 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Week 1 (Mar 2) — base template
      expect(result.days.find((d) => d.date === '2026-03-02')!.template_name).toBe('Push')
      // Week 2 (Mar 9) — overridden template at same time_slot
      const mar9 = result.days.find((d) => d.date === '2026-03-09')!
      expect(mar9.template_name).toBe('Pull')
      expect(mar9.time_slot).toBe('07:00')
    })
  })

  // ── Multiple mesocycles with overrides ───────────────────────────────
  describe('multiple mesocycles', () => {
    it('overrides scoped to correct mesocycle', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-08', 1, 0, 'active');
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (2, 'Block B', '2026-03-09', '2026-03-15', 1, 0, 'active');

        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull A', 'pull-a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 2, 'Push B', 'push-b', 'resistance');

        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (2, 0, 3, 'normal', 'morning');

        -- Override only in meso 1
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 0, 'morning', 2, '07:00', 90, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Mar 2 (Mon, meso 1 week 1) — override: Pull A
      expect(result.days.find((d) => d.date === '2026-03-02')!.template_name).toBe('Pull A')
      // Mar 9 (Mon, meso 2 week 1) — no override: Push B
      expect(result.days.find((d) => d.date === '2026-03-09')!.template_name).toBe('Push B')
    })
  })

  // ── Remaining weeks scope (multiple week overrides) ──────────────────
  describe('remaining weeks scope', () => {
    it('AC2: overrides for weeks 3-4 all reflect the move', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');

        -- Overrides for weeks 3 and 4
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 3, 0, 'morning', 2, '07:00', 90, 'move-1');
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 4, 0, 'morning', 2, '07:00', 90, 'move-1');
      `)

      const result = await getCalendarProjection(db, '2026-03')
      // Weeks 1-2 unaffected
      expect(result.days.find((d) => d.date === '2026-03-02')!.template_name).toBe('Push')
      expect(result.days.find((d) => d.date === '2026-03-09')!.template_name).toBe('Push')
      // Weeks 3-4 overridden
      expect(result.days.find((d) => d.date === '2026-03-16')!.template_name).toBe('Pull')
      expect(result.days.find((d) => d.date === '2026-03-23')!.template_name).toBe('Pull')
    })
  })
})
