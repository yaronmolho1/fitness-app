// Characterization test — captures current behavior for safe refactoring
// T200: getScheduleForMesocycle + getTemplatesForMesocycle edge cases
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

import { getScheduleForMesocycle, getTemplatesForMesocycle } from './queries'

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
      cycle_length INTEGER NOT NULL DEFAULT 1,
      cycle_position INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
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

function seedTemplate(
  mesocycleId: number,
  name = 'Push A',
  overrides: Partial<{
    modality: string
    notes: string
    run_type: string
    target_pace: string
    hr_zone: number
    interval_count: number
    interval_rest: number
    coaching_cues: string
    planned_duration: number
    target_distance: number
    target_duration: number
  }> = {}
) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: overrides.modality ?? 'resistance',
      notes: overrides.notes ?? null,
      run_type: overrides.run_type ?? null,
      target_pace: overrides.target_pace ?? null,
      hr_zone: overrides.hr_zone ?? null,
      interval_count: overrides.interval_count ?? null,
      interval_rest: overrides.interval_rest ?? null,
      coaching_cues: overrides.coaching_cues ?? null,
      planned_duration: overrides.planned_duration ?? null,
      target_distance: overrides.target_distance ?? null,
      target_duration: overrides.target_duration ?? null,
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
  timeSlot = '07:00'
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
      created_at: new Date(),
    })
    .returning()
    .get()
}

describe('getScheduleForMesocycle — characterization', () => {
  beforeEach(() => {
    createTables()
  })

  // ── Return type shape ─────────────────────────────────────────────
  describe('return type shape', () => {
    it('ScheduleEntry has day_of_week, template_id, template_name, period, time_slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 'afternoon', '14:00')

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 1,
        day_of_week: 0,
        template_id: tmpl.id,
        template_name: 'Push A',
        period: 'afternoon',
        time_slot: '14:00',
        duration: 90,
        cycle_length: 1,
        cycle_position: 1,
      })
    })
  })

  // ── Period and time_slot passthrough ───────────────────────────────
  describe('period and time_slot', () => {
    it('returns period from schedule row', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 'evening', '18:30')

      const result = await getScheduleForMesocycle(meso.id)
      expect(result[0].period).toBe('evening')
      expect(result[0].time_slot).toBe('18:30')
    })

    it('default period is morning, default time_slot is 07:00', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      // Insert without specifying period/time_slot — uses DB defaults
      testDb.run(sql`
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (${meso.id}, 0, ${tmpl.id}, 'normal')
      `)

      const result = await getScheduleForMesocycle(meso.id)
      expect(result[0].period).toBe('morning')
      expect(result[0].time_slot).toBe('07:00')
    })
  })

  // ── Ordering ──────────────────────────────────────────────────────
  describe('ordering', () => {
    it('orders by day_of_week first, then period', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'A')
      const t2 = seedTemplate(meso.id, 'B')
      const t3 = seedTemplate(meso.id, 'C')
      const t4 = seedTemplate(meso.id, 'D')
      // Insert out of order
      seedScheduleRow(meso.id, 3, t3.id, 'normal', 'evening', '18:00')
      seedScheduleRow(meso.id, 0, t2.id, 'normal', 'evening', '18:00')
      seedScheduleRow(meso.id, 3, t4.id, 'normal', 'morning', '08:00')
      seedScheduleRow(meso.id, 0, t1.id, 'normal', 'morning', '08:00')

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toHaveLength(4)
      // day 0 morning, day 0 evening, day 3 morning, day 3 evening
      expect(result[0].day_of_week).toBe(0)
      expect(result[1].day_of_week).toBe(0)
      expect(result[2].day_of_week).toBe(3)
      expect(result[3].day_of_week).toBe(3)
    })
  })

  // ── innerJoin excludes null template_id ─────────────────────────────
  describe('null template_id handling', () => {
    it('rows with null template_id are excluded (INNER JOIN)', async () => {
      // NOTE: getScheduleForMesocycle uses innerJoin with workout_templates,
      // so rows with null template_id are silently dropped.
      const meso = seedMesocycle()
      testDb.run(sql`
        INSERT INTO weekly_schedule (mesocycle_id, day_of_week, template_id, week_type)
        VALUES (${meso.id}, 0, NULL, 'normal')
      `)

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toEqual([])
    })
  })

  // ── Non-existent mesocycle ──────────────────────────────────────────
  describe('non-existent mesocycle', () => {
    it('returns empty array', async () => {
      const result = await getScheduleForMesocycle(999)
      expect(result).toEqual([])
    })
  })

  // ── weekType default ────────────────────────────────────────────────
  describe('weekType default parameter', () => {
    it('defaults to normal when not specified', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      seedScheduleRow(meso.id, 0, tmpl.id, 'normal')
      seedScheduleRow(meso.id, 1, tmpl.id, 'deload')

      const result = await getScheduleForMesocycle(meso.id)
      expect(result).toHaveLength(1)
      expect(result[0].day_of_week).toBe(0)
    })
  })
})

describe('getTemplatesForMesocycle — characterization', () => {
  beforeEach(() => {
    createTables()
  })

  describe('return type shape', () => {
    it('TemplateOption includes all modality-specific fields', async () => {
      const meso = seedMesocycle()
      seedTemplate(meso.id, 'Easy Run', {
        modality: 'running',
        run_type: 'easy',
        target_pace: '5:30',
        hr_zone: 2,
        interval_count: null as unknown as number,
        interval_rest: null as unknown as number,
        coaching_cues: 'relax',
        target_distance: 10.0,
        target_duration: 50,
        planned_duration: 55,
      })

      const result = await getTemplatesForMesocycle(meso.id)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        name: 'Easy Run',
        canonical_name: 'easy-run',
        modality: 'running',
        run_type: 'easy',
        target_pace: '5:30',
        hr_zone: 2,
        coaching_cues: 'relax',
        target_distance: 10.0,
        target_duration: 50,
        planned_duration: 55,
      })
    })
  })

  describe('mixed modality templates', () => {
    it('returns templates of all modalities in same mesocycle', async () => {
      const meso = seedMesocycle()
      seedTemplate(meso.id, 'Push A', { modality: 'resistance' })
      seedTemplate(meso.id, 'Easy Run', { modality: 'running' })
      seedTemplate(meso.id, 'BJJ', { modality: 'mma' })

      const result = await getTemplatesForMesocycle(meso.id)
      expect(result).toHaveLength(3)
      const modalities = result.map((t) => t.modality)
      expect(modalities).toContain('resistance')
      expect(modalities).toContain('running')
      expect(modalities).toContain('mma')
    })
  })
})
