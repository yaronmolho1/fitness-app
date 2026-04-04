// T198: Tests for refactored assignTemplate + removeAssignment (time-first model)
// assignTemplate: required time_slot + duration, no period in input, period derived via derivePeriod()
// removeAssignment: takes row ID instead of composite key

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

// ============================================================================
// assignTemplate — new API: time_slot + duration required, no period input
// ============================================================================

describe('assignTemplate — time-first API', () => {
  describe('requires time_slot and duration', () => {
    it('accepts time_slot and duration, derives period', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: tmpl.id,
        time_slot: '06:30',
        duration: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.time_slot).toBe('06:30')
        expect(result.data.duration).toBe(60)
        expect(result.data.period).toBe('morning') // derived from 06:30
      }
    })

    it('rejects missing time_slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        duration: 60,
      } as unknown as Parameters<typeof assignTemplate>[0])
      expect(result.success).toBe(false)
    })

    it('rejects missing duration', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
      } as unknown as Parameters<typeof assignTemplate>[0])
      expect(result.success).toBe(false)
    })
  })

  describe('period derivation via derivePeriod()', () => {
    it('derives morning for time_slot before 12:00', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '11:59',
        duration: 45,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.period).toBe('morning')
      }
    })

    it('derives afternoon for time_slot 12:00-16:59', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '14:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.period).toBe('afternoon')
      }
    })

    it('derives evening for time_slot 17:00+', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '19:00',
        duration: 90,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.period).toBe('evening')
      }
    })

    it('derives morning at midnight boundary', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '00:00',
        duration: 30,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.period).toBe('morning')
      }
    })

    it('derives afternoon at boundary 12:00', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '12:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.period).toBe('afternoon')
      }
    })

    it('derives evening at boundary 17:00', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '17:00',
        duration: 60,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.period).toBe('evening')
      }
    })
  })

  describe('duration stored in DB', () => {
    it('stores custom duration value', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 45,
      })
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].duration).toBe(45)
    })

    it('returns duration in result data', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 120,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.duration).toBe(120)
      }
    })
  })

  describe('duration validation', () => {
    it('rejects duration of 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative duration', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: -10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-integer duration', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '07:00',
        duration: 45.5,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('time_slot validation', () => {
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

    it('rejects non-zero-padded time_slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await assignTemplate({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        time_slot: '7:00',
        duration: 60,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('upsert on (meso, day, weekType, time_slot, template_id)', () => {
    it('same template at same time upserts (single row)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)

      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      const result = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 90,
      })
      expect(result.success).toBe(true)
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
    })

    it('different templates at same time upsert (cycle_position-based key)', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Pull A')

      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
        time_slot: '07:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
        time_slot: '07:00', duration: 60,
      })
      const rows = testDb.select().from(schema.weekly_schedule).all()
      // Same slot + default cycle_position=1 → upsert replaces template
      expect(rows).toHaveLength(1)
      expect(rows[0].template_id).toBe(tmpl2.id)
    })

    it('same template at different time creates separate rows', async () => {
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

  describe('unlimited workouts per day (AC5)', () => {
    it('allows 5+ workouts on the same day', async () => {
      const meso = seedMesocycle()
      const templates = []
      for (let i = 0; i < 5; i++) {
        templates.push(seedTemplate(meso.id, `Workout ${i}`))
      }
      const times = ['06:00', '08:00', '10:00', '14:00', '18:00']
      for (let i = 0; i < 5; i++) {
        const r = await assignTemplate({
          mesocycle_id: meso.id,
          day_of_week: 0,
          template_id: templates[i].id,
          time_slot: times[i],
          duration: 60,
        })
        expect(r.success).toBe(true)
      }
      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(5)
    })
  })

  describe('upsert updates duration on conflict', () => {
    it('updates duration when upserting same key', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)

      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 120,
      })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].duration).toBe(120)
    })
  })
})

// ============================================================================
// removeAssignment — new API: row ID instead of composite key
// ============================================================================

describe('removeAssignment — ID-based', () => {
  describe('removes by row ID', () => {
    it('removes a specific entry by its row ID', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const assigned = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      expect(assigned.success).toBe(true)
      if (!assigned.success) return

      const result = await removeAssignment({ id: assigned.data.id })
      expect(result.success).toBe(true)

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(0)
    })

    it('only removes the targeted row, not others on same day', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push')
      const tmpl2 = seedTemplate(meso.id, 'Pull')

      const r1 = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
        time_slot: '06:00', duration: 60,
      })
      await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
        time_slot: '08:00', duration: 60,
      })

      expect(r1.success).toBe(true)
      if (!r1.success) return

      await removeAssignment({ id: r1.data.id })

      const rows = testDb.select().from(schema.weekly_schedule).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].template_id).toBe(tmpl2.id)
    })
  })

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

  describe('guards', () => {
    it('rejects removal on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id)

      // Insert directly to simulate existing row
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
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('succeeds silently when ID does not exist (idempotent)', async () => {
      const result = await removeAssignment({ id: 999 })
      expect(result.success).toBe(true)
    })
  })

  describe('revalidation', () => {
    it('calls revalidatePath on success', async () => {
      const { revalidatePath } = await import('next/cache')
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const assigned = await assignTemplate({
        mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
        time_slot: '07:00', duration: 60,
      })
      if (!assigned.success) return

      await removeAssignment({ id: assigned.data.id })
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
    })
  })
})
