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

function seedScheduleRow(mesoId: number, day: number, templateId: number, weekType = 'normal') {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      created_at: new Date(),
    })
    .returning()
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
    target_distance REAL, target_duration INTEGER,
      planned_duration INTEGER,
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
      time_slot TEXT,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_period_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, period)`
  )
})

describe('getScheduleForMesocycle', () => {
  it('returns empty array when no assignments', async () => {
    const meso = seedMesocycle()
    const result = await getScheduleForMesocycle(meso.id)
    expect(result).toEqual([])
  })

  it('returns assignments with template names for normal week', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id)

    const result = await getScheduleForMesocycle(meso.id)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      day_of_week: 0,
      template_id: tmpl.id,
      template_name: 'Push A',
    })
  })

  it('returns only normal week assignments by default', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal')
    seedScheduleRow(meso.id, 0, tmpl.id, 'deload')

    const result = await getScheduleForMesocycle(meso.id)
    expect(result).toHaveLength(1)
  })

  it('returns deload week when specified', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal')
    seedScheduleRow(meso.id, 1, tmpl.id, 'deload')

    const result = await getScheduleForMesocycle(meso.id, 'deload')
    expect(result).toHaveLength(1)
    expect(result[0].day_of_week).toBe(1)
  })

  it('returns multiple assignments ordered by day', async () => {
    const meso = seedMesocycle()
    const t1 = seedTemplate(meso.id, 'Push A')
    const t2 = seedTemplate(meso.id, 'Pull A')
    seedScheduleRow(meso.id, 3, t2.id)
    seedScheduleRow(meso.id, 0, t1.id)

    const result = await getScheduleForMesocycle(meso.id)
    expect(result).toHaveLength(2)
    expect(result[0].day_of_week).toBe(0)
    expect(result[1].day_of_week).toBe(3)
  })

  it('scoped to mesocycle — does not return other mesocycle data', async () => {
    const meso1 = seedMesocycle('Meso 1')
    const meso2 = seedMesocycle('Meso 2')
    const t1 = seedTemplate(meso1.id, 'Push A')
    const t2 = seedTemplate(meso2.id, 'Pull A')
    seedScheduleRow(meso1.id, 0, t1.id)
    seedScheduleRow(meso2.id, 0, t2.id)

    const result = await getScheduleForMesocycle(meso1.id)
    expect(result).toHaveLength(1)
    expect(result[0].template_name).toBe('Push A')
  })
})

describe('getTemplatesForMesocycle', () => {
  it('returns templates scoped to mesocycle', async () => {
    const meso = seedMesocycle()
    seedTemplate(meso.id, 'Push A')
    seedTemplate(meso.id, 'Pull A')

    const result = await getTemplatesForMesocycle(meso.id)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ name: 'Push A', modality: 'resistance' })
    expect(result[1]).toMatchObject({ name: 'Pull A', modality: 'resistance' })
  })

  it('returns empty array when no templates exist', async () => {
    const meso = seedMesocycle()
    const result = await getTemplatesForMesocycle(meso.id)
    expect(result).toEqual([])
  })

  it('does not return templates from other mesocycles', async () => {
    const meso1 = seedMesocycle('Meso 1')
    const meso2 = seedMesocycle('Meso 2')
    seedTemplate(meso1.id, 'Push A')
    seedTemplate(meso2.id, 'Pull A')

    const result = await getTemplatesForMesocycle(meso1.id)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Push A')
  })

  it('includes target_distance and target_duration fields', async () => {
    const meso = seedMesocycle()
    testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Easy Run',
        canonical_name: 'easy-run',
        modality: 'running',
        run_type: 'easy',
        target_distance: 5.0,
        target_duration: 30,
        created_at: new Date(),
      })
      .run()

    const result = await getTemplatesForMesocycle(meso.id)
    expect(result).toHaveLength(1)
    expect(result[0].target_distance).toBe(5.0)
    expect(result[0].target_duration).toBe(30)
  })

  it('returns null for target_distance and target_duration when not set', async () => {
    const meso = seedMesocycle()
    seedTemplate(meso.id, 'Push A')

    const result = await getTemplatesForMesocycle(meso.id)
    expect(result[0].target_distance).toBeNull()
    expect(result[0].target_duration).toBeNull()
  })
})
