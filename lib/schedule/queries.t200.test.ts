// T200: Tests for time-first schedule queries — duration field, time_slot ordering
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

const { testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return { testDb: drizzle(sqlite) }
})

vi.mock('@/lib/db/index', () => ({
  db: testDb,
}))

import { getScheduleForMesocycle } from './queries'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`
    CREATE TABLE mesocycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      work_weeks INTEGER NOT NULL,
      has_deload INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'planned',
      created_at INTEGER
    )
  `)
  testDb.run(sql`
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
    )
  `)
  testDb.run(sql`
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
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_template_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id)`
  )
}

function seedMesocycle(name = 'Test Meso') {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name,
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: 0,
      status: 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(mesocycleId: number, name = 'Push A') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedScheduleRow(
  mesoId: number,
  day: number,
  templateId: number,
  weekType = 'normal',
  period = 'morning',
  timeSlot = '07:00',
  duration = 90
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      period,
      time_slot: timeSlot,
      duration,
      created_at: new Date(),
    })
    .returning()
    .get()
}

describe('getScheduleForMesocycle — T200 time-first model', () => {
  beforeEach(() => {
    createTables()
  })

  // ── duration field ──────────────────────────────────────────────────
  describe('duration field in ScheduleEntry', () => {
    it('includes duration from schedule row', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 'morning', '08:00', 60)

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toHaveLength(1)
      expect(result[0].duration).toBe(60)
    })

    it('includes default duration (90) when not explicitly set', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      // Insert via raw SQL to use defaults
      testDb.run(sql`
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (${meso.id}, 0, ${tmpl.id}, 'normal')
      `)

      const result = await getScheduleForMesocycle(meso.id)
      expect(result[0].duration).toBe(90)
    })
  })

  // ── time_slot ordering ──────────────────────────────────────────────
  describe('ordering by time_slot', () => {
    it('orders by day_of_week then time_slot (not period)', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'A')
      const t2 = seedTemplate(meso.id, 'B')
      const t3 = seedTemplate(meso.id, 'C')
      const t4 = seedTemplate(meso.id, 'D')

      // Insert out of order — period should NOT determine sort
      seedScheduleRow(meso.id, 3, t3.id, 'normal', 'evening', '18:00')
      seedScheduleRow(meso.id, 0, t2.id, 'normal', 'evening', '18:00')
      seedScheduleRow(meso.id, 3, t4.id, 'normal', 'morning', '08:00')
      seedScheduleRow(meso.id, 0, t1.id, 'normal', 'morning', '08:00')

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toHaveLength(4)
      // day 0 at 08:00, day 0 at 18:00, day 3 at 08:00, day 3 at 18:00
      expect(result[0].day_of_week).toBe(0)
      expect(result[0].time_slot).toBe('08:00')
      expect(result[1].day_of_week).toBe(0)
      expect(result[1].time_slot).toBe('18:00')
      expect(result[2].day_of_week).toBe(3)
      expect(result[2].time_slot).toBe('08:00')
      expect(result[3].day_of_week).toBe(3)
      expect(result[3].time_slot).toBe('18:00')
    })

    it('afternoon at 06:00 sorts before morning at 09:00 on same day', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'Early')
      const t2 = seedTemplate(meso.id, 'Late')

      seedScheduleRow(meso.id, 0, t2.id, 'normal', 'morning', '09:00')
      seedScheduleRow(meso.id, 0, t1.id, 'normal', 'afternoon', '06:00')

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toHaveLength(2)
      expect(result[0].time_slot).toBe('06:00')
      expect(result[0].template_name).toBe('Early')
      expect(result[1].time_slot).toBe('09:00')
      expect(result[1].template_name).toBe('Late')
    })
  })
})
