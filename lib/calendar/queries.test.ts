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

  // Create tables
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
      planned_duration INTEGER,
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

describe('getCalendarProjection', () => {
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
    // Clean tables between tests
    sqlite.exec('DELETE FROM logged_workouts')
    sqlite.exec('DELETE FROM weekly_schedule')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
  })

  it('returns one entry per day in the requested month', async () => {
    const result = await getCalendarProjection(db, '2026-03')
    // March 2026 has 31 days
    expect(result.days).toHaveLength(31)
    expect(result.days[0].date).toBe('2026-03-01')
    expect(result.days[30].date).toBe('2026-03-31')
  })

  it('returns all rest days when no mesocycles exist', async () => {
    const result = await getCalendarProjection(db, '2026-03')
    for (const day of result.days) {
      expect(day.template_name).toBeNull()
      expect(day.modality).toBeNull()
      expect(day.mesocycle_id).toBeNull()
      expect(day.is_deload).toBe(false)
      expect(day.status).toBe('rest')
    }
  })

  it('maps days to correct mesocycle and template via weekly_schedule', async () => {
    // Mesocycle: Mon 2026-03-02 to Sun 2026-03-29, 4 work weeks, no deload
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // March 2 is Monday (day_of_week=0). Check it's mapped.
    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.template_name).toBe('Push A')
    expect(mar2.modality).toBe('resistance')
    expect(mar2.mesocycle_id).toBe(1)

    // March 9 is also Monday
    const mar9 = result.days.find((d) => d.date === '2026-03-09')!
    expect(mar9.template_name).toBe('Push A')

    // March 3 is Tuesday, no schedule row for Tuesday
    const mar3 = result.days.find((d) => d.date === '2026-03-03')!
    expect(mar3.template_name).toBeNull()
    expect(mar3.status).toBe('rest')
  })

  it('returns rest for days outside mesocycle range', async () => {
    // Mesocycle starts Mar 10
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-10', '2026-03-31', 3, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // March 2 is Monday but before mesocycle starts
    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.template_name).toBeNull()
    expect(mar2.status).toBe('rest')

    // March 16 is Monday and within range
    const mar16 = result.days.find((d) => d.date === '2026-03-16')!
    expect(mar16.template_name).toBe('Push A')
  })

  it('handles mesocycle ending mid-month', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-01', '2026-03-15', 2, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // March 9 is Monday, within range
    const mar9 = result.days.find((d) => d.date === '2026-03-09')!
    expect(mar9.template_name).toBe('Push A')

    // March 16 is Monday, after end_date
    const mar16 = result.days.find((d) => d.date === '2026-03-16')!
    expect(mar16.template_name).toBeNull()
    expect(mar16.status).toBe('rest')
  })

  it('handles multiple mesocycles in one month', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-01', '2026-03-14', 2, 0, 'active');
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (2, 'Block B', '2026-03-15', '2026-03-31', 2, 0, 'planned');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 2, 'Run Easy', 'run-easy', 'running');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (2, 0, 2, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // March 9 Mon -> Block A
    const mar9 = result.days.find((d) => d.date === '2026-03-09')!
    expect(mar9.mesocycle_id).toBe(1)
    expect(mar9.template_name).toBe('Push A')
    expect(mar9.modality).toBe('resistance')

    // March 16 Mon -> Block B
    const mar16 = result.days.find((d) => d.date === '2026-03-16')!
    expect(mar16.mesocycle_id).toBe(2)
    expect(mar16.template_name).toBe('Run Easy')
    expect(mar16.modality).toBe('running')
  })

  it('computes is_deload correctly for last week of mesocycle', async () => {
    // 4 work weeks + deload. Start 2026-03-02 (Mon).
    // Weeks: W1=Mar2-8, W2=Mar9-15, W3=Mar16-22, W4=Mar23-29, Deload=Mar30-Apr5
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-04-05', 4, 1, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // Week 1 Monday (Mar 2) — normal
    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.is_deload).toBe(false)
    expect(mar2.template_name).toBe('Push A')

    // Week 4 Monday (Mar 23) — still normal
    const mar23 = result.days.find((d) => d.date === '2026-03-23')!
    expect(mar23.is_deload).toBe(false)

    // Deload week Monday (Mar 30) — deload
    const mar30 = result.days.find((d) => d.date === '2026-03-30')!
    expect(mar30.is_deload).toBe(true)
    expect(mar30.template_name).toBe('Push Deload')
  })

  it('has_deload=false means no deload days', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    for (const day of result.days) {
      expect(day.is_deload).toBe(false)
    }
  })

  it('deload week spanning month boundary marks days correctly', async () => {
    // 2 work weeks + deload. Start 2026-03-16 (Mon).
    // W1=Mar16-22, W2=Mar23-29, Deload=Mar30-Apr5
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-16', '2026-04-05', 2, 1, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // Mar 30 and 31 are in deload week
    const mar30 = result.days.find((d) => d.date === '2026-03-30')!
    expect(mar30.is_deload).toBe(true)
    const mar31 = result.days.find((d) => d.date === '2026-03-31')!
    expect(mar31.is_deload).toBe(true)

    // Mar 23 is work week
    const mar23 = result.days.find((d) => d.date === '2026-03-23')!
    expect(mar23.is_deload).toBe(false)
  })

  it('status is completed when logged_workouts row exists for date', async () => {
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

    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.status).toBe('completed')
  })

  it('status is projected when template assigned but no log', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.status).toBe('projected')
  })

  it('status is rest when no template assigned', async () => {
    const result = await getCalendarProjection(db, '2026-03')
    for (const day of result.days) {
      expect(day.status).toBe('rest')
    }
  })

  it('handles February in a leap year', async () => {
    // 2028 is a leap year
    const result = await getCalendarProjection(db, '2028-02')
    expect(result.days).toHaveLength(29)
    expect(result.days[28].date).toBe('2028-02-29')
  })

  it('handles February in a non-leap year', async () => {
    const result = await getCalendarProjection(db, '2026-02')
    expect(result.days).toHaveLength(28)
  })

  it('mesocycle with no weekly_schedule rows renders as rest days', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-29', 4, 0, 'active');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.template_name).toBeNull()
    expect(mar2.status).toBe('rest')
    // mesocycle_id should still be set since the day falls within its range
    expect(mar2.mesocycle_id).toBe(1)
  })

  it('uses deload schedule variant during deload week', async () => {
    // 1 work week + deload. Start 2026-03-02 (Mon).
    // W1=Mar2-8, Deload=Mar9-15
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-15', 1, 1, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Push A', 'push-a', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Push Deload', 'push-deload', 'resistance');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 2, 'deload');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // Work week Mon
    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.template_name).toBe('Push A')
    expect(mar2.is_deload).toBe(false)

    // Deload week Mon
    const mar9 = result.days.find((d) => d.date === '2026-03-09')!
    expect(mar9.template_name).toBe('Push Deload')
    expect(mar9.is_deload).toBe(true)
  })

  it('day_of_week mapping: 0=Monday through 6=Sunday', async () => {
    sqlite.exec(`
      INSERT INTO mesocycles (id, name, start_date, end_date, work_weeks, has_deload, status)
      VALUES (1, 'Block A', '2026-03-02', '2026-03-08', 1, 0, 'active');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (1, 1, 'Mon', 'mon', 'resistance');
      INSERT INTO workout_templates (id, mesocycle_id, name, canonical_name, modality)
      VALUES (2, 1, 'Sun', 'sun', 'mma');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 0, 1, 'normal');
      INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
      VALUES (1, 6, 2, 'normal');
    `)

    const result = await getCalendarProjection(db, '2026-03')

    // Mar 2 = Monday
    const mar2 = result.days.find((d) => d.date === '2026-03-02')!
    expect(mar2.template_name).toBe('Mon')

    // Mar 8 = Sunday
    const mar8 = result.days.find((d) => d.date === '2026-03-08')!
    expect(mar8.template_name).toBe('Sun')
    expect(mar8.modality).toBe('mma')
  })
})
