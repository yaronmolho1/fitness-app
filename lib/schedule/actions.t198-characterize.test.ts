// Characterization test — captures current behavior for safe refactoring
// Focused on period↔time_slot derivation, upsert conflict targets, remove semantics,
// and return shapes that T198 will change.

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
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_template_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id)`
  )
})

describe('assignTemplate — time_slot derivation from period', () => {
  it('morning period → time_slot 07:00', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'morning',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('07:00')
    }
  })

  it('afternoon period → time_slot 13:00', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'afternoon',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('13:00')
    }
  })

  it('evening period → time_slot 18:00', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'evening',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('18:00')
    }
  })

  it('explicit time_slot overrides period-based default', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'morning',
      time_slot: '09:30',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // period stays as-is even when time_slot doesn't match typical morning range
      expect(result.data.time_slot).toBe('09:30')
      expect(result.data.period).toBe('morning')
    }
  })

  it('null time_slot triggers period-based derivation', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'evening',
      time_slot: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.time_slot).toBe('18:00')
    }
  })
})

describe('assignTemplate — duration hardcoded to 90', () => {
  it('returns duration=90 on every new assignment', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'morning',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration).toBe(90)
    }
  })

  it('duration=90 persisted in DB', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'morning',
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows[0].duration).toBe(90)
  })
})

describe('assignTemplate — upsert conflict target', () => {
  // Conflict key: (mesocycle_id, day_of_week, week_type, time_slot, template_id)

  it('same key → upsert (single row)', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', time_slot: '07:00',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'afternoon', time_slot: '07:00',
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(1)
    // Upsert set clause updates template_id and time_slot (both same here)
    expect(rows[0].template_id).toBe(tmpl.id)
    expect(rows[0].time_slot).toBe('07:00')
  })

  it('upsert set clause updates template_id and time_slot only', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)

    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', time_slot: '07:00',
    })

    // Re-assign same conflict key but different period
    const result = await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'evening', time_slot: '07:00',
    })
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(1)
    // NOTE: period is NOT part of upsert set — original period is retained
    // This may be a bug: period stays 'morning' even though second call said 'evening'
    expect(rows[0].period).toBe('morning')
  })

  it('different template_id at same time_slot → separate rows', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id, 'Push')
    const tmpl2 = seedTemplate(meso.id, 'Pull')
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
      period: 'morning', time_slot: '07:00',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
      period: 'morning', time_slot: '07:00',
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    // template_id is part of the unique index, so different templates = different rows
    expect(rows).toHaveLength(2)
  })

  it('same template different day_of_week → separate rows', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 1, template_id: tmpl.id,
      period: 'morning',
    })
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(2)
  })

  it('same template same day different week_type → separate rows', async () => {
    const meso = seedMesocycle({ has_deload: 1 })
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', week_type: 'normal',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', week_type: 'deload',
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
      period: 'afternoon',
      time_slot: '14:00',
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
        duration: 90,
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
      period: 'morning',
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
      period: 'morning',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.week_type).toBe('normal')
    }
  })
})

describe('removeAssignment — deletes by period column', () => {
  it('removes all entries matching period on that day regardless of time_slot', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id, 'Push')
    const tmpl2 = seedTemplate(meso.id, 'Pull')

    // Two templates at same period but different time_slots
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
      period: 'morning', time_slot: '06:00',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
      period: 'morning', time_slot: '08:00',
    })

    const before = testDb.select().from(schema.weekly_schedule).all()
    expect(before).toHaveLength(2)

    const result = await removeAssignment({
      mesocycle_id: meso.id, day_of_week: 0, period: 'morning',
    })
    expect(result.success).toBe(true)

    const after = testDb.select().from(schema.weekly_schedule).all()
    // Both morning entries removed — delete uses period, not time_slot
    expect(after).toHaveLength(0)
  })

  it('does not remove entries with different period even if same time_slot', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id, 'Push')
    const tmpl2 = seedTemplate(meso.id, 'Cardio')

    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl1.id,
      period: 'morning', time_slot: '07:00',
    })
    // Assign with period=afternoon but same time_slot (unusual but possible)
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl2.id,
      period: 'afternoon', time_slot: '07:00',
    })

    await removeAssignment({
      mesocycle_id: meso.id, day_of_week: 0, period: 'morning',
    })

    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].period).toBe('afternoon')
  })

  it('removeAssignment does NOT use time_slot in its delete WHERE clause', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)

    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', time_slot: '09:00',
    })

    // Remove by period — no time_slot in removeAssignment input
    const result = await removeAssignment({
      mesocycle_id: meso.id, day_of_week: 0, period: 'morning',
    })
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(0)
  })
})

describe('removeAssignment — return shape', () => {
  it('success result has no data field', async () => {
    const meso = seedMesocycle()
    const result = await removeAssignment({
      mesocycle_id: meso.id, day_of_week: 0, period: 'morning',
    })
    expect(result).toEqual({ success: true })
    expect('data' in result).toBe(false)
  })

  it('failure result has error string', async () => {
    const result = await removeAssignment({
      mesocycle_id: 999, day_of_week: 0, period: 'morning',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTypeOf('string')
    }
  })
})

describe('removeAssignment — week_type defaults to normal', () => {
  it('omitted week_type targets normal entries only', async () => {
    const meso = seedMesocycle({ has_deload: 1 })
    const tmpl = seedTemplate(meso.id)

    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', week_type: 'normal',
    })
    await assignTemplate({
      mesocycle_id: meso.id, day_of_week: 0, template_id: tmpl.id,
      period: 'morning', week_type: 'deload',
    })

    // Remove without specifying week_type (defaults to 'normal')
    await removeAssignment({
      mesocycle_id: meso.id, day_of_week: 0, period: 'morning',
    })

    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].week_type).toBe('deload')
  })
})

describe('assignTemplate — period is NOT validated against time_slot', () => {
  it('allows period=evening with a morning time_slot (no cross-validation)', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      period: 'evening',
      time_slot: '06:00',
    })
    // No validation between period and time_slot — both stored as-is
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe('evening')
      expect(result.data.time_slot).toBe('06:00')
    }
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
      period: 'morning',
    })

    expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
  })
})

describe('removeAssignment — revalidatePath called on success', () => {
  it('calls revalidatePath with /mesocycles layout', async () => {
    const { revalidatePath } = await import('next/cache')
    const meso = seedMesocycle()

    await removeAssignment({
      mesocycle_id: meso.id,
      day_of_week: 0,
      period: 'morning',
    })

    expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
  })
})
