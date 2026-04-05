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

import { assignTemplate, removeAssignment } from './actions'

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
      modality: 'resistance',
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

describe('assignTemplate', () => {
  describe('validation', () => {
    it('rejects day_of_week < 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: -1,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
    })

    it('rejects day_of_week > 6', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 7,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-existent mesocycle', async () => {
      const result = await assignTemplate({
        mesocycle_id: 999,
        day_of_week: 0,
        template_id: 1,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })

    it('rejects non-existent template', async () => {
      const meso = seedMesocycle()
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: 999,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/template/i)
    })

    it('rejects invalid time_slot format', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '25:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
    })

    it('rejects time_slot with invalid minutes', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '08:60',
        duration: 60,
      })
      expect(result.success).toBe(false)
    })

    it('rejects malformed time_slot string', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: 'not-a-time',
        duration: 60,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('completed mesocycle', () => {
    it('blocks assignment on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('allows assignment on planned mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
    })

    it('allows assignment on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('same-mesocycle check', () => {
    it('rejects template from a different mesocycle', async () => {
      const meso1 = seedMesocycle({ name: 'Meso 1' })
      const meso2 = seedMesocycle({ name: 'Meso 2' })
      const tmpl = seedTemplate(meso2.id)
      const result = await assignTemplate({
        mesocycle_id: meso1.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })
  })

  describe('successful assignment', () => {
    it('creates weekly_schedule row with correct fields including derived period', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: tmpl.id,
        time_slot: '14:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.mesocycle_id).toBe(meso.id)
        expect(result.data.day_of_week).toBe(1)
        expect(result.data.template_id).toBe(tmpl.id)
        expect(result.data.week_type).toBe('normal')
        expect(result.data.period).toBe('afternoon')
        expect(result.data.time_slot).toBe('14:00')
        expect(result.data.duration).toBe(60)
      }
    })

    it('persists row to database with derived period and time_slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 3,
        template_id: tmpl.id,
        time_slot: '18:00',
        duration: 90,
      })
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].day_of_week).toBe(3)
      expect(rows[0].week_type).toBe('normal')
      expect(rows[0].period).toBe('evening')
      expect(rows[0].time_slot).toBe('18:00')
      expect(rows[0].duration).toBe(90)
    })

    it('allows same template on multiple days', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id, time_slot: '07:00', duration: 60 })
      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 3, template_id: tmpl.id, time_slot: '07:00', duration: 60 })
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(2)
    })

    it('allows all 7 days assigned', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      for (let d = 0; d <= 6; d++) {
        const r = await assignTemplate({ mesocycle_id: meso.id, day_of_week: d, template_id: tmpl.id, time_slot: '07:00', duration: 60 })
        expect(r.success).toBe(true)
      }
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(7)
    })
  })

  describe('multiple workouts per day', () => {
    it('allows different templates on the same day at different times', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Cardio')
      const r1 = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
        time_slot: '07:00', duration: 60,
      })
      const r2 = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
        time_slot: '18:00', duration: 60,
      })
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(2)
    })

    it('allows three workouts on same day at different times', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Morning')
      const tmpl2 = seedTemplate(meso.id, 'Afternoon')
      const tmpl3 = seedTemplate(meso.id, 'Evening')
      for (const [tmpl, ts] of [[tmpl1, '07:00'], [tmpl2, '13:00'], [tmpl3, '18:00']] as const) {
        const r = await assignTemplate({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          time_slot: ts, duration: 60,
        })
        expect(r.success).toBe(true)
      }
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(3)
    })
  })

  describe('deload week_type', () => {
    it('assigns with week_type=deload', async () => {
      const meso = seedMesocycle({ has_deload: 1 })
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: tmpl.id,
        week_type: 'deload',
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.week_type).toBe('deload')
      }
    })

    it('rejects deload assignment on mesocycle without deload', async () => {
      const meso = seedMesocycle({ has_deload: 0 })
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: tmpl.id,
        week_type: 'deload',
        time_slot: '07:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Mesocycle does not have a deload week')
      }
    })

    it('keeps normal and deload assignments independent', async () => {
      const meso = seedMesocycle({ has_deload: 1 })
      const tmpl = seedTemplate(meso.id)
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        week_type: 'normal', time_slot: '07:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        week_type: 'deload', time_slot: '07:00', duration: 60,
      })
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(2)
    })
  })

  describe('replace existing assignment', () => {
    it('upserts same template on same day+time_slot (idempotent)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')

      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id, time_slot: '07:00', duration: 60 })
      const result = await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id, time_slot: '07:00', duration: 60 })

      expect(result.success).toBe(true)
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
    })

    it('different template on same slot replaces existing (single assignment)', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Pull A')

      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id, time_slot: '07:00', duration: 60 })
      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id, time_slot: '07:00', duration: 60 })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].template_id).toBe(tmpl2.id)
    })

    it('keeps other days untouched on re-assign', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')

      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id, time_slot: '07:00', duration: 60 })
      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 1, template_id: tmpl1.id, time_slot: '07:00', duration: 60 })
      // Re-assign same template to day 0 (upsert)
      await assignTemplate({ mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id, time_slot: '07:00', duration: 60 })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(2)
    })

    it('different time_slot creates separate row', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)

      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '06:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:30', duration: 60,
      })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(2)
    })
  })
})

describe('removeAssignment', () => {
  describe('validation', () => {
    it('rejects non-integer ID', async () => {
      const result = await removeAssignment({ id: 1.5 })
      expect(result.success).toBe(false)
    })

    it('rejects negative ID', async () => {
      const result = await removeAssignment({ id: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('completed mesocycle', () => {
    it('blocks removal on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id)
      const row = testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
          week_type: 'normal', period: 'morning', time_slot: '07:00',
          duration: 60, created_at: new Date(),
        })
        .returning()
        .get()

      const result = await removeAssignment({ id: row.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })
  })

  describe('successful removal', () => {
    it('deletes the specific assignment by ID', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const assigned = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 2, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      expect(assigned.success).toBe(true)
      if (!assigned.success) return

      const result = await removeAssignment({ id: assigned.data.id })
      expect(result.success).toBe(true)

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(0)
    })

    it('only removes the targeted row, keeps others on same day', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Cardio')
      const r1 = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
        time_slot: '07:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
        time_slot: '18:00', duration: 60,
      })
      expect(r1.success).toBe(true)
      if (!r1.success) return

      await removeAssignment({ id: r1.data.id })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].template_id).toBe(tmpl2.id)
    })

    it('only removes the targeted day', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const r0 = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 1, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      expect(r0.success).toBe(true)
      if (!r0.success) return

      await removeAssignment({ id: r0.data.id })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].day_of_week).toBe(1)
    })

    it('removes deload assignment without affecting normal', async () => {
      const meso = seedMesocycle({ has_deload: 1 })
      const tmpl = seedTemplate(meso.id)
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        week_type: 'normal', time_slot: '07:00', duration: 60,
      })
      const deload = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        week_type: 'deload', time_slot: '07:00', duration: 60,
      })
      expect(deload.success).toBe(true)
      if (!deload.success) return

      const result = await removeAssignment({ id: deload.data.id })
      expect(result.success).toBe(true)

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].week_type).toBe('normal')
    })

    it('succeeds even if ID has no assignment (idempotent)', async () => {
      const result = await removeAssignment({ id: 999 })
      expect(result.success).toBe(true)
    })
  })
})
