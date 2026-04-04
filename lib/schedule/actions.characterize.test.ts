// Characterization test — captures current behavior for safe refactoring (T208 sync hooks)
// Focuses on return shapes, revalidation timing, and absence of side effects beyond DB + cache
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

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { assignTemplate, removeAssignment } from './actions'

function seedMesocycle(
  overrides: Partial<{ name: string; status: string; has_deload: number }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: 0,
      status: 'planned',
      ...overrides,
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

beforeEach(() => {
  vi.clearAllMocks()
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
      notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
      interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
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
})

describe('assignTemplate — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true, data: ScheduleRow } with all expected fields', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: tmpl.id,
        time_slot: '14:00',
        duration: 60,
      })
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          id: expect.any(Number),
          mesocycle_id: meso.id,
          day_of_week: 1,
          template_id: tmpl.id,
          week_type: 'normal',
          period: 'afternoon',
          time_slot: '14:00',
          duration: 60,
          created_at: expect.any(Date),
        }),
      })
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error: string } for validation errors', async () => {
      const result = await assignTemplate({
        mesocycle_id: -1,
        day_of_week: 0,
        template_id: 1,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
      expect('error' in result && typeof result.error).toBe('string')
      expect('data' in result).toBe(false)
    })

    it('returns { success: false, error: string } for business rule errors', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result).toEqual({
        success: false,
        error: 'Cannot modify schedule of a completed mesocycle',
      })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath("/mesocycles", "layout") on success', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath on validation failure', async () => {
      await assignTemplate({
        mesocycle_id: -1,
        day_of_week: 0,
        template_id: 1,
        time_slot: '07:00',
        duration: 60,
      })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath when mesocycle not found', async () => {
      await assignTemplate({
        mesocycle_id: 999,
        day_of_week: 0,
        template_id: 1,
        time_slot: '07:00',
        duration: 60,
      })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })

    it('does NOT call revalidatePath when template not found', async () => {
      const meso = seedMesocycle()
      await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: 999,
        time_slot: '07:00',
        duration: 60,
      })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('no external side effects', () => {
    it('only modifies weekly_schedule table (no other tables touched)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)

      const mesosBefore = testDb.select().from(schema.mesocycles).all()
      const tmplsBefore = testDb.select().from(schema.workout_templates).all()

      await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })

      const mesosAfter = testDb.select().from(schema.mesocycles).all()
      const tmplsAfter = testDb.select().from(schema.workout_templates).all()
      expect(mesosAfter).toEqual(mesosBefore)
      expect(tmplsAfter).toEqual(tmplsBefore)
    })
  })
})

describe('removeAssignment — characterize for T208', () => {
  describe('return shape', () => {
    it('returns { success: true } on successful removal (no data field)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const assigned = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      if (!assigned.success) throw new Error('setup failed')

      const result = await removeAssignment({ id: assigned.data.id })
      expect(result).toEqual({ success: true })
    })

    it('returns { success: true } for non-existent ID (idempotent)', async () => {
      const result = await removeAssignment({ id: 999 })
      expect(result).toEqual({ success: true })
    })

    it('returns { success: false, error } for completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id)
      const row = testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id,
          day_of_week: 0,
          template_id: tmpl.id,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 60,
          created_at: new Date(),
        })
        .returning()
        .get()

      const result = await removeAssignment({ id: row.id })
      expect(result).toEqual({
        success: false,
        error: 'Cannot modify schedule of a completed mesocycle',
      })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath on successful removal', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const assigned = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      if (!assigned.success) throw new Error('setup failed')
      vi.clearAllMocks()

      await removeAssignment({ id: assigned.data.id })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('calls revalidatePath even for idempotent (non-existent) removal', async () => {
      await removeAssignment({ id: 999 })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
    })

    it('does NOT call revalidatePath on validation failure', async () => {
      await removeAssignment({ id: -1 })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })
})
