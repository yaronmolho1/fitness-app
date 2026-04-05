// Characterization test — captures behavior after T198 refactor (time-first model)
// Updated from period-first to time-first: assignTemplate takes time_slot + duration,
// period is derived; removeAssignment takes row ID.

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

describe('assignTemplate — period derived from time_slot', () => {
  it('morning time → period=morning', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('07:00')
      expect(result.data.period).toBe('morning')
    }
  })

  it('afternoon time → period=afternoon', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '13:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('13:00')
      expect(result.data.period).toBe('afternoon')
    }
  })

  it('evening time → period=evening', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '18:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('18:00')
      expect(result.data.period).toBe('evening')
    }
  })

  it('period always consistent with time_slot (no manual override)', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    // 06:00 is morning — period must be morning, no way to override
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '06:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe('morning')
      expect(result.data.time_slot).toBe('06:00')
    }
  })
})

describe('assignTemplate — duration is caller-provided', () => {
  it('stores the provided duration value', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 45,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration).toBe(45)
    }
  })

  it('duration persisted in DB', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 120,
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows[0].duration).toBe(120)
  })
})

describe('assignTemplate — upsert conflict target', () => {
  // Conflict key: (mesocycle_id, day_of_week, week_type, time_slot, template_id)

  it('same key → upsert (single row)', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 60,
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 90,
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].template_id).toBe(tmpl.id)
    expect(rows[0].time_slot).toBe('07:00')
  })

  it('upsert updates duration and period on conflict', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)

    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 60,
    })

    // Re-assign same conflict key, duration changes
    const result = await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 120,
    })
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].duration).toBe(120)
    expect(rows[0].period).toBe('morning') // derived from 07:00
  })

  it('different template_id at same time_slot → upsert replaces (cycle_position-based key)', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id, 'Push')
    const tmpl2 = seedTemplate(meso.id, 'Pull')
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

  it('same template different day_of_week → separate rows', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 60,
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 1, template_id: tmpl.id,
      time_slot: '07:00', duration: 60,
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(2)
  })

  it('same template same day different week_type → separate rows', async () => {
    const meso = seedMesocycle({ has_deload: 1 })
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 60, week_type: 'normal',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 60, week_type: 'deload',
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(2)
  })
})

describe('assignTemplate — return shape', () => {
  it('success result contains full ScheduleRow', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 3,
      template_id: tmpl.id,
      time_slot: '14:00',
      duration: 75,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        mesocycle_id: meso.id,
        day_of_week: 3,
        template_id: tmpl.id,
        week_type: 'normal',
        period: 'afternoon',
        time_slot: '14:00',
        duration: 75,
      })
      expect(result.data.id).toBeTypeOf('number')
      expect(result.data.created_at).toBeDefined()
    }
  })

  it('failure result has error string', async () => {
    const result = await assignTemplate({
      mesocycle_id: 999,
      day_of_week: 0,
      template_id: 1,
      time_slot: '07:00',
      duration: 60,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTypeOf('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})

describe('assignTemplate — week_type defaults to normal', () => {
  it('omitted week_type defaults to normal in schema', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.week_type).toBe('normal')
    }
  })
})

describe('removeAssignment — deletes by row ID', () => {
  it('removes only the targeted row by ID', async () => {
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

    const before = testDb.select().from(schema.weekly_schedule).all()
    expect(before).toHaveLength(2)

    const result = await removeAssignment({ id: r1.data.id })
    expect(result.success).toBe(true)

    const after = testDb.select().from(schema.weekly_schedule).all()
    expect(after).toHaveLength(1)
    expect(after[0].template_id).toBe(tmpl2.id)
  })
})

describe('removeAssignment — return shape', () => {
  it('success result has no data field', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const assigned = await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      time_slot: '07:00', duration: 60,
    })
    expect(assigned.success).toBe(true)
    if (!assigned.success) return

    const result = await removeAssignment({ id: assigned.data.id })
    expect(result).toEqual({ success: true })
    expect('data' in result).toBe(false)
  })

  it('failure result has error string', async () => {
    const result = await removeAssignment({ id: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTypeOf('string')
    }
  })
})

describe('removeAssignment — idempotent for missing ID', () => {
  it('succeeds when ID does not exist', async () => {
    const result = await removeAssignment({ id: 999 })
    expect(result.success).toBe(true)
  })
})

describe('assignTemplate — revalidatePath called on success', () => {
  it('calls revalidatePath with /mesocycles layout', async () => {
    const { revalidatePath } = await import('next/cache')
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)

    await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 60,
    })

    expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
  })
})

describe('removeAssignment — revalidatePath called on success', () => {
  it('calls revalidatePath with /mesocycles layout', async () => {
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
