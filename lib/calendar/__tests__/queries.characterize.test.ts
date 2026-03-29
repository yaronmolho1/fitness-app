// Characterization test — captures current behavior for safe refactoring
// T185: Calendar projection override wiring — pins getCalendarProjection() contract
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
    CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id);
  `)

  const db = drizzle(sqlite, { schema: { ...schema, ...relationsModule } }) as AppDb
  return { sqlite, db }
}

describe('getCalendarProjection — characterization', () => {
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
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
  })

  // ── Output shape ─────────────────────────────────────────────────────
  describe('output shape', () => {
    it('returns { days: CalendarDay[] } with correct field set', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      expect(result).toHaveProperty('days')
      expect(Array.isArray(result.days)).toBe(true)
      const day = result.days[0]
      expect(day).toHaveProperty('date')
      expect(day).toHaveProperty('template_name')
      expect(day).toHaveProperty('modality')
      expect(day).toHaveProperty('mesocycle_id')
      expect(day).toHaveProperty('is_deload')
      expect(day).toHaveProperty('status')
      expect(day).toHaveProperty('period')
      expect(day).toHaveProperty('time_slot')
    })

    it('days are ordered chronologically', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      for (let i = 1; i < result.days.length; i++) {
        expect(result.days[i].date >= result.days[i - 1].date).toBe(true)
      }
    })
  })

  // ── daysInMonth behavior ─────────────────────────────────────────────
  describe('month date generation', () => {
    it('generates 31 days for March', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days).toHaveLength(31)
      expect(result.days[0].date).toBe('2026-03-01')
      expect(result.days[30].date).toBe('2026-03-31')
    })

    it('generates 28 days for Feb non-leap', async () => {
      const result = await getCalendarProjection(db, '2026-02')
      expect(result.days).toHaveLength(28)
    })

    it('generates 29 days for Feb leap year', async () => {
      const result = await getCalendarProjection(db, '2028-02')
      expect(result.days).toHaveLength(29)
      expect(result.days[28].date).toBe('2028-02-29')
    })

    it('generates 30 days for April', async () => {
      const result = await getCalendarProjection(db, '2026-04')
      expect(result.days).toHaveLength(30)
    })
  })

  // ── No mesocycles ────────────────────────────────────────────────────
  describe('no mesocycles', () => {
    it('all days are rest with null fields', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      for (const day of result.days) {
        expect(day).toEqual({
          date: day.date,
          template_name: null,
          modality: null,
          mesocycle_id: null,
          is_deload: false,
          status: 'rest',
          period: null,
          time_slot: null,
          duration: null,
        })
      }
    })
  })

  // ── Mesocycle with no schedule ────────────────────────────────────────
  describe('mesocycle with no schedule rows', () => {
    it('days in range get mesocycle_id but rest status', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.mesocycle_id).toBe(1)
      expect(mar2.status).toBe('rest')
      expect(mar2.template_name).toBeNull()
      expect(mar2.period).toBeNull()
    })
  })

  // ── Schedule entry with null template_id ─────────────────────────────
  describe('schedule entry with null template_id', () => {
    it('renders as rest day with period still null', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, NULL, 'normal', 'morning');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      // template_name is null from LEFT JOIN => status='rest'
      expect(mar2.template_name).toBeNull()
      expect(mar2.status).toBe('rest')
      // period comes from schedule row even when template is null
      expect(mar2.period).toBe('morning')
    })
  })

  // ── Week number + deload computation ─────────────────────────────────
  describe('week number and deload detection', () => {
    it('week 1 starts from mesocycle start_date, not month start', async () => {
      // Meso starts Mar 9 (Monday), 2 work weeks + deload
      // W1=Mar9-15, W2=Mar16-22, Deload=Mar23-29
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-09', '2026-03-29', 2, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Push DL', 'push-dl', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 2, 'deload');
      `)
      const result = await getCalendarProjection(db, '2026-03')

      // W1 Mon
      expect(result.days.find((d) => d.date === '2026-03-09')!.is_deload).toBe(false)
      expect(result.days.find((d) => d.date === '2026-03-09')!.template_name).toBe('Push')
      // W2 Mon
      expect(result.days.find((d) => d.date === '2026-03-16')!.is_deload).toBe(false)
      // Deload Mon
      expect(result.days.find((d) => d.date === '2026-03-23')!.is_deload).toBe(true)
      expect(result.days.find((d) => d.date === '2026-03-23')!.template_name).toBe('Push DL')
    })

    it('has_deload as integer 1 is treated same as boolean true', async () => {
      // has_deload stored as integer 1 in SQLite
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-15', 1, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'deload');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // W2 (deload) Mon = Mar 9
      const mar9 = result.days.find((d) => d.date === '2026-03-09')!
      expect(mar9.is_deload).toBe(true)
      expect(mar9.template_name).toBe('Push')
    })

    it('has_deload=0 means weekNumber > work_weeks is NOT deload', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // W3 Mon = Mar 16 — beyond work_weeks but has_deload=false
      const mar16 = result.days.find((d) => d.date === '2026-03-16')!
      expect(mar16.is_deload).toBe(false)
      expect(mar16.template_name).toBe('Push')
    })
  })

  // ── Overlapping mesocycles ───────────────────────────────────────────
  describe('overlapping mesocycles', () => {
    it('first matching mesocycle wins (find() semantics)', async () => {
      // Two mesocycles covering same dates — first inserted wins
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (2, 'Block B', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 2, 'Push B', 'push-b', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (2, 0, 2, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      // mesoRows from DB select — first row returned by query wins in find()
      expect(mar2.mesocycle_id).toBe(1)
      expect(mar2.template_name).toBe('Push A')
    })
  })

  // ── Status logic ─────────────────────────────────────────────────────
  describe('status determination', () => {
    it('projected when template assigned, no log', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days.find((d) => d.date === '2026-03-02')!.status).toBe('projected')
    })

    it('completed when template assigned and log exists for that date', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
        INSERT INTO logged_workouts (template_id, canonical_name, log_date, logged_at, template_snapshot)
        VALUES (1, 'push-a', '2026-03-02', 1740900000, '{"version":1}');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days.find((d) => d.date === '2026-03-02')!.status).toBe('completed')
    })

    it('rest when no template (null template_name)', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days[0].status).toBe('rest')
    })

    it('completed status is date-level, not template-level', async () => {
      // Log exists for date but for a different template — still marks completed
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push A', 'push-a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull A', 'pull-a', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 2, 'normal', 'evening');
        INSERT INTO logged_workouts (template_id, canonical_name, log_date, logged_at, template_snapshot)
        VALUES (1, 'push-a', '2026-03-02', 1740900000, '{"version":1}');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.filter((d) => d.date === '2026-03-02')
      // Both entries marked completed because log check is date-level
      expect(mar2[0].status).toBe('completed')
      expect(mar2[1].status).toBe('completed')
    })
  })

  // ── Multi-session per day ordering ───────────────────────────────────
  describe('multi-session ordering', () => {
    it('sorts by period order: morning(0) < afternoon(1) < evening(2)', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'A', 'a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'B', 'b', 'running');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'C', 'c', 'mma');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 3, 'normal', 'evening');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 2, 'normal', 'afternoon');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const entries = result.days.filter((d) => d.date === '2026-03-02')
      expect(entries).toHaveLength(3)
      expect(entries[0].period).toBe('morning')
      expect(entries[0].template_name).toBe('A')
      expect(entries[1].period).toBe('afternoon')
      expect(entries[1].template_name).toBe('B')
      expect(entries[2].period).toBe('evening')
      expect(entries[2].template_name).toBe('C')
    })

    it('unknown period gets sort order 99 (sorted last)', async () => {
      // Directly insert a non-standard period to test fallback sort
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'A', 'a', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'B', 'b', 'running');
      `)
      // Force insert with non-enum period (SQLite doesn't enforce enums)
      sqlite.exec(`
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 2, 'normal', 'night');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const entries = result.days.filter((d) => d.date === '2026-03-02')
      expect(entries).toHaveLength(2)
      expect(entries[0].period).toBe('morning')
      expect(entries[1].period).toBe('night')
    })
  })

  // ── Day of week mapping ──────────────────────────────────────────────
  describe('isoDayOfWeek mapping', () => {
    it('0=Monday, 6=Sunday (ISO convention)', async () => {
      // Mar 2026: 1=Sun, 2=Mon, 7=Sat, 8=Sun
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-01', '2026-03-08', 1, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Mon', 'mon', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Sun', 'sun', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'Sat', 'sat', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 5, 3, 'normal');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 6, 2, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')

      // Mar 1 = Sunday = dow 6
      expect(result.days.find((d) => d.date === '2026-03-01')!.template_name).toBe('Sun')
      // Mar 2 = Monday = dow 0
      expect(result.days.find((d) => d.date === '2026-03-02')!.template_name).toBe('Mon')
      // Mar 7 = Saturday = dow 5
      expect(result.days.find((d) => d.date === '2026-03-07')!.template_name).toBe('Sat')
    })
  })

  // ── Mesocycle boundary behavior ──────────────────────────────────────
  describe('mesocycle boundaries', () => {
    it('mesocycle starting before month still projects within-month days', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-02-16', '2026-03-15', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // Mar 2 = Mon, within meso range
      expect(result.days.find((d) => d.date === '2026-03-02')!.template_name).toBe('Push')
      // Mar 16 = Mon, after meso end_date
      expect(result.days.find((d) => d.date === '2026-03-16')!.template_name).toBeNull()
    })

    it('week number computed from meso start even when start is in prior month', async () => {
      // Meso starts Feb 16 (Mon). By Mar 2 (Mon), that's week 3.
      // 2 work weeks + deload: W1=Feb16-22, W2=Feb23-Mar1, Deload=Mar2-8
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-02-16', '2026-03-08', 2, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Push DL', 'push-dl', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 2, 'deload');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // Mar 2 = Mon, week 3 from Feb 16 = deload
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.is_deload).toBe(true)
      expect(mar2.template_name).toBe('Push DL')
    })

    it('start_date and end_date are inclusive boundaries', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-10', '2026-03-20', 2, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 1, 1, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // Mar 10 = Tuesday = start_date (inclusive)
      expect(result.days.find((d) => d.date === '2026-03-10')!.mesocycle_id).toBe(1)
      expect(result.days.find((d) => d.date === '2026-03-10')!.template_name).toBe('Push')
      // Mar 20 = Friday = end_date (inclusive)
      expect(result.days.find((d) => d.date === '2026-03-20')!.mesocycle_id).toBe(1)
      // Mar 9 = before start
      expect(result.days.find((d) => d.date === '2026-03-09')!.mesocycle_id).toBeNull()
      // Mar 21 = after end
      expect(result.days.find((d) => d.date === '2026-03-21')!.mesocycle_id).toBeNull()
    })
  })

  // ── time_slot passthrough ────────────────────────────────────────────
  describe('time_slot passthrough', () => {
    it('passes time_slot from schedule row to output', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 1, 'normal', 'morning', '07:30');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days.find((d) => d.date === '2026-03-02')!.time_slot).toBe('07:30')
    })

    it('default time_slot when not specified', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
        VALUES (1, 0, 1, 'normal', 'morning');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      expect(result.days.find((d) => d.date === '2026-03-02')!.time_slot).toBe('07:00')
    })
  })

  // ── Query scoping (only fetches relevant data) ───────────────────────
  describe('query scoping', () => {
    it('ignores mesocycles entirely outside the requested month', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-04-01', '2026-04-30', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      for (const day of result.days) {
        expect(day.mesocycle_id).toBeNull()
      }
    })

    it('ignores logged_workouts outside the requested month', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-04-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (1, 0, 1, 'normal');
        INSERT INTO logged_workouts (template_id, canonical_name, log_date, logged_at, template_snapshot)
        VALUES (1, 'push', '2026-04-06', 1740900000, '{"version":1}');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // No logs in March, so all scheduled days should be 'projected'
      const mar2 = result.days.find((d) => d.date === '2026-03-02')!
      expect(mar2.status).toBe('projected')
    })
  })
})
