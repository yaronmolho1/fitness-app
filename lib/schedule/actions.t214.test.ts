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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { assignRotation } from './actions'

function seedMesocycle(
  overrides: Partial<{ name: string; status: string; has_deload: number }> = {}
) {
  const defaults = {
    name: 'Test Meso',
    start_date: '2026-03-01',
    end_date: '2026-03-28',
    work_weeks: 4,
    has_deload: 0,
    status: 'planned',
  }
  return testDb
    .insert(schema.mesocycles)
    .values({ ...defaults, ...overrides })
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
      modality: 'running',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

beforeEach(() => {
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
      planned_duration INTEGER, estimated_duration INTEGER, display_order INTEGER NOT NULL DEFAULT 0,
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
})

describe('assignRotation (T214)', () => {
  describe('validation — positions contiguous 1..N', () => {
    it('rejects fewer than 2 positions', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [{ cycle_position: 1, template_id: t1.id }],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/2.*8|positions/i)
    })

    it('rejects more than 8 positions', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const positions = Array.from({ length: 9 }, (_, i) => ({
        cycle_position: i + 1,
        template_id: t1.id,
      }))
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/2.*8|positions/i)
    })

    it('rejects non-contiguous positions (gap)', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 3, template_id: t1.id },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/contiguous/i)
    })

    it('rejects positions not starting at 1', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 2, template_id: t1.id },
          { cycle_position: 3, template_id: t1.id },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/contiguous/i)
    })

    it('rejects duplicate cycle_position values', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 1, template_id: t1.id },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/contiguous/i)
    })
  })

  describe('validation — template existence', () => {
    it('rejects template_id not belonging to this mesocycle', async () => {
      const meso1 = seedMesocycle({ name: 'Meso 1' })
      const meso2 = seedMesocycle({ name: 'Meso 2' })
      const t1 = seedTemplate(meso1.id, 'VO2 Max')
      const t2 = seedTemplate(meso2.id, 'Threshold')
      const result = await assignRotation({
        mesocycle_id: meso1.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/template/i)
    })

    it('rejects non-existent template_id', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: 9999 },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/template/i)
    })
  })

  describe('validation — mesocycle guards', () => {
    it('rejects completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('rejects non-existent mesocycle', async () => {
      const result = await assignRotation({
        mesocycle_id: 9999,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: 1 },
          { cycle_position: 2, template_id: 2 },
        ],
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })
  })

  describe('successful rotation insert', () => {
    it('creates N rows with shared cycle_length', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')
      const t3 = seedTemplate(meso.id, 'Tempo')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
          { cycle_position: 3, template_id: t3.id },
        ],
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(3)
      for (const row of rows) {
        expect(row.cycle_length).toBe(3)
        expect(row.mesocycle_id).toBe(meso.id)
        expect(row.day_of_week).toBe(1)
        expect(row.time_slot).toBe('07:00')
        expect(row.duration).toBe(60)
      }
      // Verify correct template_id per position
      const sorted = rows.sort((a: { cycle_position: number }, b: { cycle_position: number }) => a.cycle_position - b.cycle_position)
      expect(sorted[0].template_id).toBe(t1.id)
      expect(sorted[1].template_id).toBe(t2.id)
      expect(sorted[2].template_id).toBe(t3.id)
    })

    it('derives period from time_slot', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')
      await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '18:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })
      const rows = testDb.select().from(schema.weekly_schedule).all()
      for (const row of rows) {
        expect(row.period).toBe('evening')
      }
    })

    it('allows same template in multiple positions', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t1.id },
        ],
      })
      expect(result.success).toBe(true)
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(2)
      expect(rows[0].template_id).toBe(t1.id)
      expect(rows[1].template_id).toBe(t1.id)
    })

    it('returns data array with inserted rows', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })
  })

  describe('atomic delete + insert (replace existing rotation)', () => {
    it('replaces existing rotation rows for same slot', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')
      const t3 = seedTemplate(meso.id, 'Tempo')

      // First rotation: 2-week cycle
      await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })
      expect(testDb.select().from(schema.weekly_schedule).all()).toHaveLength(2)

      // Replace with 3-week cycle
      const result = await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 90,
        positions: [
          { cycle_position: 1, template_id: t2.id },
          { cycle_position: 2, template_id: t3.id },
          { cycle_position: 3, template_id: t1.id },
        ],
      })
      expect(result.success).toBe(true)

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(3)
      for (const row of rows) {
        expect(row.cycle_length).toBe(3)
        expect(row.duration).toBe(90)
      }
    })

    it('does not affect other slots on same day', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')

      // Assign single template at 18:00
      testDb.insert(schema.weekly_schedule).values({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: t1.id,
        time_slot: '18:00',
        duration: 60,
        period: 'evening',
      }).run()

      // Assign rotation at 07:00
      await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      // 1 (18:00) + 2 (07:00 rotation) = 3
      expect(rows).toHaveLength(3)
    })

    it('does not affect other week_types on same slot', async () => {
      const meso = seedMesocycle({ has_deload: 1 })
      const t1 = seedTemplate(meso.id, 'VO2 Max')
      const t2 = seedTemplate(meso.id, 'Threshold')

      // Assign deload entry
      testDb.insert(schema.weekly_schedule).values({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: t1.id,
        week_type: 'deload',
        time_slot: '07:00',
        duration: 60,
        period: 'morning',
      }).run()

      // Assign normal rotation on same slot
      await assignRotation({
        mesocycle_id: meso.id,
        day_of_week: 1,
        week_type: 'normal',
        time_slot: '07:00',
        duration: 60,
        positions: [
          { cycle_position: 1, template_id: t1.id },
          { cycle_position: 2, template_id: t2.id },
        ],
      })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      // 1 (deload) + 2 (normal rotation) = 3
      expect(rows).toHaveLength(3)
    })
  })
})
