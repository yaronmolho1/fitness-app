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
      target_distance REAL,
      target_duration INTEGER,
      target_elevation_gain INTEGER,
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

describe('getEffectiveScheduleForDay', () => {
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

  it('returns base schedule entries when no overrides exist', async () => {
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
    expect(result[0]).toMatchObject({
      template_id: 1,
      period: 'morning',
      time_slot: '08:00',
      is_override: false,
      override_group: null,
    })
  })

  it('returns override entry instead of base when override exists for a slot', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Pull A', 'pull-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
      VALUES (1, 0, 1, 'normal', 'morning', '08:00');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 2, 0, 'morning', 2, '09:00', 'move-abc');
    `)

    const result = await getEffectiveScheduleForDay(db, 1, 2, 0, 'normal')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      template_id: 2,
      period: 'morning',
      time_slot: '09:00',
      is_override: true,
      override_group: 'move-abc',
    })
  })

  it('returns rest entry when override has null template_id', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot, duration)
      VALUES (1, 0, 1, 'normal', 'morning', '07:00', 90);
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, duration, override_group)
      VALUES (1, 3, 0, 'morning', NULL, '07:00', 60, 'move-xyz');
    `)

    const result = await getEffectiveScheduleForDay(db, 1, 3, 0, 'normal')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      template_id: null,
      period: 'morning',
      time_slot: '07:00',
      is_override: true,
      override_group: 'move-xyz',
    })
  })

  it('handles multiple periods on same day independently', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, '5K Run', '5k-run', 'running');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (3, 1, 'Pull A', 'pull-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
      VALUES (1, 0, 1, 'normal', 'morning', '07:00');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period, time_slot)
      VALUES (1, 0, 2, 'normal', 'evening', '18:00');
      -- Override only the morning slot
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 2, 0, 'morning', 3, '08:00', 'move-123');
    `)

    const result = await getEffectiveScheduleForDay(db, 1, 2, 0, 'normal')

    expect(result).toHaveLength(2)
    // Morning is overridden
    const morning = result.find((e) => e.period === 'morning')!
    expect(morning.template_id).toBe(3)
    expect(morning.is_override).toBe(true)
    expect(morning.override_group).toBe('move-123')
    // Evening is base
    const evening = result.find((e) => e.period === 'evening')!
    expect(evening.template_id).toBe(2)
    expect(evening.is_override).toBe(false)
    expect(evening.override_group).toBeNull()
  })

  it('resolves deload week type against deload base schedule', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-04-05', 4, 1, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'deload', 'morning');
    `)

    // Query deload week type
    const result = await getEffectiveScheduleForDay(db, 1, 5, 0, 'deload')

    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(2)
    expect(result[0].is_override).toBe(false)
  })

  it('returns empty array when no base schedule and no overrides', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
    `)

    const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
    expect(result).toEqual([])
  })

  it('override for a period with no base entry adds a new slot', async () => {
    // An override can place a workout on a period that had no base schedule
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Pull A', 'pull-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      -- Override places a workout in evening (no base evening entry)
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, time_slot, override_group)
      VALUES (1, 1, 0, 'evening', 2, '19:00', 'move-new');
    `)

    const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')

    expect(result).toHaveLength(2)
    const morning = result.find((e) => e.period === 'morning')!
    expect(morning.template_id).toBe(1)
    expect(morning.is_override).toBe(false)
    const evening = result.find((e) => e.period === 'evening')!
    expect(evening.template_id).toBe(2)
    expect(evening.is_override).toBe(true)
    expect(evening.override_group).toBe('move-new')
  })

  it('results are sorted by period: morning → afternoon → evening', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, '5K Run', '5k-run', 'running');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (3, 1, 'BJJ', 'bjj', 'mma');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 2, 'normal', 'evening');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 3, 'normal', 'afternoon');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
    `)

    const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')

    expect(result).toHaveLength(3)
    expect(result[0].period).toBe('morning')
    expect(result[1].period).toBe('afternoon')
    expect(result[2].period).toBe('evening')
  })

  it('override only applies to specified week number', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Pull A', 'pull-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
      VALUES (1, 2, 0, 'morning', 2, 'move-w2');
    `)

    // Week 1: no override → base schedule
    const week1 = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
    expect(week1).toHaveLength(1)
    expect(week1[0].template_id).toBe(1)
    expect(week1[0].is_override).toBe(false)

    // Week 2: override applies
    const week2 = await getEffectiveScheduleForDay(db, 1, 2, 0, 'normal')
    expect(week2).toHaveLength(1)
    expect(week2[0].template_id).toBe(2)
    expect(week2[0].is_override).toBe(true)

    // Week 3: no override → base schedule
    const week3 = await getEffectiveScheduleForDay(db, 1, 3, 0, 'normal')
    expect(week3).toHaveLength(1)
    expect(week3[0].template_id).toBe(1)
    expect(week3[0].is_override).toBe(false)
  })

  it('scoped to mesocycle — does not leak across mesocycles', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (2, 'Block B', '2026-04-06', '2026-05-03', 4, 0, 'planned');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 2, 'Pull B', 'pull-b', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (1, 0, 1, 'normal', 'morning');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type, period)
      VALUES (2, 0, 2, 'normal', 'morning');
      INSERT INTO schedule_week_overrides (mesocycle_id, week_number, day_of_week, period, template_id, override_group)
      VALUES (2, 1, 0, 'morning', NULL, 'move-other');
    `)

    // Mesocycle 1 should not be affected by mesocycle 2's override
    const result = await getEffectiveScheduleForDay(db, 1, 1, 0, 'normal')
    expect(result).toHaveLength(1)
    expect(result[0].template_id).toBe(1)
    expect(result[0].is_override).toBe(false)
  })
})
