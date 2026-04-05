import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql, eq, and } from 'drizzle-orm'
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
      modality: 'running',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

// Insert a rotation directly into DB for test setup
function seedRotation(
  mesoId: number,
  dayOfWeek: number,
  timeSlot: string,
  templateIds: number[],
  weekType = 'normal'
) {
  const cycleLength = templateIds.length
  for (let i = 0; i < templateIds.length; i++) {
    testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: mesoId,
        day_of_week: dayOfWeek,
        template_id: templateIds[i],
        week_type: weekType,
        period: 'morning',
        time_slot: timeSlot,
        duration: 60,
        cycle_length: cycleLength,
        cycle_position: i + 1,
        created_at: new Date(),
      })
      .run()
  }
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

describe('assignTemplate — rotation-aware (T215)', () => {
  it('inserts with cycle_length=1, cycle_position=1', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'Push A')

    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: t1.id,
      time_slot: '07:00',
      duration: 60,
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.cycle_length).toBe(1)
    expect(result.data.cycle_position).toBe(1)
  })

  it('replaces existing rotation with single assignment', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'VO2 Max')
    const t2 = seedTemplate(meso.id, 'Threshold')
    const t3 = seedTemplate(meso.id, 'Tempo')

    // Seed a 3-position rotation
    seedRotation(meso.id, 1, '07:00', [t1.id, t2.id, t3.id])
    const beforeRows = testDb.select().from(schema.weekly_schedule).all()
    expect(beforeRows).toHaveLength(3)

    // Now assign single template to same slot
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: t2.id,
      time_slot: '07:00',
      duration: 90,
    })

    expect(result.success).toBe(true)
    const afterRows = testDb.select().from(schema.weekly_schedule).all()
    expect(afterRows).toHaveLength(1)
    expect(afterRows[0].cycle_length).toBe(1)
    expect(afterRows[0].cycle_position).toBe(1)
    expect(afterRows[0].template_id).toBe(t2.id)
  })

  it('does not affect other slots when replacing rotation', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'VO2 Max')
    const t2 = seedTemplate(meso.id, 'Threshold')

    // Rotation at 07:00
    seedRotation(meso.id, 1, '07:00', [t1.id, t2.id])
    // Single assignment at 18:00
    testDb.insert(schema.weekly_schedule).values({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: t1.id,
      week_type: 'normal',
      period: 'evening',
      time_slot: '18:00',
      duration: 60,
    }).run()

    await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: t2.id,
      time_slot: '07:00',
      duration: 60,
    })

    const rows = testDb.select().from(schema.weekly_schedule).all()
    // 1 new at 07:00 + 1 existing at 18:00
    expect(rows).toHaveLength(2)
  })
})

describe('removeAssignment — rotation-aware (T215)', () => {
  it('removes single row when cycle_length=1', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'Push A')

    // Insert a single assignment
    const row = testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: t1.id,
        week_type: 'normal',
        period: 'morning',
        time_slot: '07:00',
        duration: 60,
        cycle_length: 1,
        cycle_position: 1,
      })
      .returning()
      .get()

    const result = await removeAssignment({ id: row.id })
    expect(result.success).toBe(true)

    const remaining = testDb.select().from(schema.weekly_schedule).all()
    expect(remaining).toHaveLength(0)
  })

  it('removes ALL rotation rows when cycle_length > 1', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'VO2 Max')
    const t2 = seedTemplate(meso.id, 'Threshold')
    const t3 = seedTemplate(meso.id, 'Tempo')

    // Seed a 3-position rotation
    seedRotation(meso.id, 1, '07:00', [t1.id, t2.id, t3.id])
    const rows = testDb.select().from(schema.weekly_schedule).all()
    expect(rows).toHaveLength(3)

    // Remove using one of the rotation row IDs
    const result = await removeAssignment({ id: rows[0].id })
    expect(result.success).toBe(true)

    const remaining = testDb.select().from(schema.weekly_schedule).all()
    expect(remaining).toHaveLength(0)
  })

  it('does not affect other slots when removing rotation', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'VO2 Max')
    const t2 = seedTemplate(meso.id, 'Threshold')

    // Rotation at 07:00
    seedRotation(meso.id, 1, '07:00', [t1.id, t2.id])
    // Single assignment at 18:00
    testDb.insert(schema.weekly_schedule).values({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: t1.id,
      week_type: 'normal',
      period: 'evening',
      time_slot: '18:00',
      duration: 60,
    }).run()

    const rotationRows = testDb
      .select()
      .from(schema.weekly_schedule)
      .where(
        and(
          eq(schema.weekly_schedule.time_slot, '07:00'),
          eq(schema.weekly_schedule.mesocycle_id, meso.id),
        )
      )
      .all()

    await removeAssignment({ id: rotationRows[0].id })

    const remaining = testDb.select().from(schema.weekly_schedule).all()
    // Only the 18:00 row should remain
    expect(remaining).toHaveLength(1)
    expect(remaining[0].time_slot).toBe('18:00')
  })

  it('does not affect other week_types when removing rotation', async () => {
    const meso = seedMesocycle({ has_deload: 1 })
    const t1 = seedTemplate(meso.id, 'VO2 Max')
    const t2 = seedTemplate(meso.id, 'Threshold')

    // Normal rotation at 07:00
    seedRotation(meso.id, 1, '07:00', [t1.id, t2.id], 'normal')
    // Deload single assignment at same slot
    testDb.insert(schema.weekly_schedule).values({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: t1.id,
      week_type: 'deload',
      period: 'morning',
      time_slot: '07:00',
      duration: 60,
    }).run()

    const normalRows = testDb
      .select()
      .from(schema.weekly_schedule)
      .where(eq(schema.weekly_schedule.week_type, 'normal'))
      .all()

    await removeAssignment({ id: normalRows[0].id })

    const remaining = testDb.select().from(schema.weekly_schedule).all()
    // Only the deload row should remain
    expect(remaining).toHaveLength(1)
    expect(remaining[0].week_type).toBe('deload')
  })
})
