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
      planned_duration INTEGER, estimated_duration INTEGER, display_order INTEGER NOT NULL DEFAULT 0,
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

describe('getCalendarProjection — cycle-aware rotation (T213)', () => {
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

  describe('2-week rotation filtering', () => {
    // Meso starts 2026-03-02 (Monday), 4 work weeks, no deload
    // 2-week rotation on Monday 07:00: Push (pos 1) / Pull (pos 2)
    // W1=Mar2-8, W2=Mar9-15, W3=Mar16-22, W4=Mar23-29
    // Expected: W1->Push, W2->Pull, W3->Push (wraps), W4->Pull
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 2, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '07:00', 2, 2);
      `)
    })

    it('week 1 shows position 1 template only', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      const mar2 = result.days.filter((d) => d.date === '2026-03-02')
      expect(mar2).toHaveLength(1)
      expect(mar2[0].template_name).toBe('Push')
    })

    it('week 2 shows position 2 template only', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      const mar9 = result.days.filter((d) => d.date === '2026-03-09')
      expect(mar9).toHaveLength(1)
      expect(mar9[0].template_name).toBe('Pull')
    })

    it('week 3 wraps back to position 1', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      const mar16 = result.days.filter((d) => d.date === '2026-03-16')
      expect(mar16).toHaveLength(1)
      expect(mar16[0].template_name).toBe('Push')
    })

    it('week 4 wraps to position 2', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      const mar23 = result.days.filter((d) => d.date === '2026-03-23')
      expect(mar23).toHaveLength(1)
      expect(mar23[0].template_name).toBe('Pull')
    })
  })

  describe('4-week rotation (AC16)', () => {
    // 12-week meso starting 2026-01-05 (Monday)
    // 4-week rotation on Monday 07:00: VO2max/Threshold/VO2max/Tempo
    // Check March (weeks 9-13 area)
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-01-05', '2026-03-30', 12, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'VO2max', 'vo2max', 'running');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Threshold', 'threshold', 'running');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'Tempo', 'tempo', 'running');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 4, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '07:00', 4, 2);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 4, 3);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 3, 'normal', 'morning', '07:00', 4, 4);
      `)
    })

    it('each Monday in March shows correct rotation position', async () => {
      const result = await getCalendarProjection(db, '2026-03')
      // Meso starts Jan 5. Mar 2 = week 9. ((9-1)%4)+1 = 1 -> VO2max
      const mar2 = result.days.filter((d) => d.date === '2026-03-02')
      expect(mar2).toHaveLength(1)
      expect(mar2[0].template_name).toBe('VO2max')

      // Mar 9 = week 10. ((10-1)%4)+1 = 2 -> Threshold
      const mar9 = result.days.filter((d) => d.date === '2026-03-09')
      expect(mar9).toHaveLength(1)
      expect(mar9[0].template_name).toBe('Threshold')

      // Mar 16 = week 11. ((11-1)%4)+1 = 3 -> VO2max
      const mar16 = result.days.filter((d) => d.date === '2026-03-16')
      expect(mar16).toHaveLength(1)
      expect(mar16[0].template_name).toBe('VO2max')

      // Mar 23 = week 12. ((12-1)%4)+1 = 4 -> Tempo
      const mar23 = result.days.filter((d) => d.date === '2026-03-23')
      expect(mar23).toHaveLength(1)
      expect(mar23[0].template_name).toBe('Tempo')
    })
  })

  describe('backward compatibility — cycle_length=1', () => {
    it('single entry per slot shown every week (no filtering)', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 1, 1);
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const mondays = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23']
      for (const d of mondays) {
        const entries = result.days.filter((e) => e.date === d)
        expect(entries).toHaveLength(1)
        expect(entries[0].template_name).toBe('Push')
      }
    })
  })

  describe('independent time_slots with rotation', () => {
    it('different time_slots rotate independently', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'AM-A', 'am-a', 'running');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'AM-B', 'am-b', 'running');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'PM-X', 'pm-x', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (4, 1, 'PM-Y', 'pm-y', 'resistance');
        -- AM slot: 2-week rotation
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '06:00', 2, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '06:00', 2, 2);
        -- PM slot: 2-week rotation
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 3, 'normal', 'evening', '18:00', 2, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 4, 'normal', 'evening', '18:00', 2, 2);
      `)
      const result = await getCalendarProjection(db, '2026-03')

      // W1: AM-A + PM-X
      const w1 = result.days.filter((d) => d.date === '2026-03-02')
      expect(w1).toHaveLength(2)
      expect(w1[0].template_name).toBe('AM-A')
      expect(w1[1].template_name).toBe('PM-X')

      // W2: AM-B + PM-Y
      const w2 = result.days.filter((d) => d.date === '2026-03-09')
      expect(w2).toHaveLength(2)
      expect(w2[0].template_name).toBe('AM-B')
      expect(w2[1].template_name).toBe('PM-Y')
    })
  })

  describe('rotation does not affect override merging', () => {
    it('override wins over rotation-resolved template', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'Override', 'override', 'resistance');
        -- 2-week rotation
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 2, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '07:00', 2, 2);
        -- Override for week 1 replaces rotation
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 1, 0, 'morning', 3, '07:00', 90, 'swap-1');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // W1 Mon: override wins
      const mar2 = result.days.filter((d) => d.date === '2026-03-02')
      expect(mar2).toHaveLength(1)
      expect(mar2[0].template_name).toBe('Override')
      // W2 Mon: no override, rotation resolves to Pull
      const mar9 = result.days.filter((d) => d.date === '2026-03-09')
      expect(mar9).toHaveLength(1)
      expect(mar9[0].template_name).toBe('Pull')
    })

    it('null-template override makes rotation slot rest', async () => {
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 2, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '07:00', 2, 2);
        -- Null-template override for week 2
        INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
        VALUES (1, 2, 0, 'morning', NULL, '07:00', 90, 'rest-1');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      const mar9 = result.days.filter((d) => d.date === '2026-03-09')
      expect(mar9).toHaveLength(1)
      expect(mar9[0].template_name).toBeNull()
      expect(mar9[0].status).toBe('rest')
    })
  })

  describe('deload week uses deload schedule, not rotation', () => {
    it('deload week ignores normal rotation', async () => {
      // 2 work weeks + deload. Rotation on normal weeks.
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-22', 2, 1, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (3, 1, 'Deload', 'deload', 'resistance');
        -- Normal rotation
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 2, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '07:00', 2, 2);
        -- Deload schedule (separate week_type)
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
        VALUES (1, 0, 3, 'deload', 'morning', '07:00');
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // W3 = deload
      const mar16 = result.days.filter((d) => d.date === '2026-03-16')
      expect(mar16).toHaveLength(1)
      expect(mar16[0].template_name).toBe('Deload')
      expect(mar16[0].is_deload).toBe(true)
    })
  })

  describe('missing cycle position resolves to rest', () => {
    it('returns rest when active position has no matching row', async () => {
      // 3-week rotation but only positions 1 and 2 defined (missing position 3)
      sqlite.exec(`
        INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
        VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (1, 1, 'Push', 'push', 'resistance');
        INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
        VALUES (2, 1, 'Pull', 'pull', 'resistance');
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 1, 'normal', 'morning', '07:00', 3, 1);
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, cycle_length, cycle_position)
        VALUES (1, 0, 2, 'normal', 'morning', '07:00', 3, 2);
      `)
      const result = await getCalendarProjection(db, '2026-03')
      // W3: ((3-1)%3)+1 = 3 -> no match -> slot dropped from this time_slot
      const mar16 = result.days.filter((d) => d.date === '2026-03-16')
      // No entry for this time_slot means rest day
      expect(mar16).toHaveLength(1)
      expect(mar16[0].template_name).toBeNull()
      expect(mar16[0].status).toBe('rest')
    })
  })
})
