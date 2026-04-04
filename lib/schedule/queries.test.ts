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

import { getScheduleForMesocycle, getTemplatesForMesocycle, getActiveWeeksForTemplate } from './queries'

function seedMesocycle(name = 'Test Meso', workWeeks = 4) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name,
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: workWeeks,
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
  cycleLength = 1,
  cyclePosition = 1,
  timeSlot = '07:00'
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesoId,
      day_of_week: day,
      template_id: templateId,
      week_type: weekType,
      cycle_length: cycleLength,
      cycle_position: cyclePosition,
      time_slot: timeSlot,
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedOverride(
  mesoId: number,
  weekNumber: number,
  day: number,
  templateId: number | null,
  overrideGroup: string,
  timeSlot = '07:00'
) {
  return testDb
    .insert(schema.schedule_week_overrides)
    .values({
      mesocycle_id: mesoId,
      week_number: weekNumber,
      day_of_week: day,
      period: 'morning',
      template_id: templateId,
      override_group: overrideGroup,
      time_slot: timeSlot,
      created_at: new Date(),
    })
    .returning()
    .get()
}

beforeEach(() => {
  testDb.run(sql`DROP TABLE IF EXISTS schedule_week_overrides`)
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
  testDb.run(sql`
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'morning',
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      override_group TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id)`
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

describe('getActiveWeeksForTemplate', () => {
  // AC3: Non-rotating template (cycle_length=1) appears every work week
  it('returns all work weeks for non-rotating template', async () => {
    const meso = seedMesocycle('Test', 12)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 1, 1)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  // AC1: Rotating template cycle_length=4, position=1, 12-week meso → [1, 5, 9]
  it('returns correct weeks for rotating template', async () => {
    const meso = seedMesocycle('Test', 12)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 1)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 5, 9])
  })

  // AC2: Template in positions 1 AND 3 of 4-week rotation, 12-week meso → [1, 3, 5, 7, 9, 11]
  it('returns union of weeks for template in multiple positions', async () => {
    const meso = seedMesocycle('Test', 12)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 1)
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 3, '09:00')

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 3, 5, 7, 9, 11])
  })

  // Template in multiple slots on different days → union
  it('returns union of weeks across different day slots', async () => {
    const meso = seedMesocycle('Test', 8)
    const tmpl = seedTemplate(meso.id, 'Push A')
    // Day 0: cycle_length=4, position=1 → weeks 1,5
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 1)
    // Day 3: cycle_length=4, position=2 → weeks 2,6
    seedScheduleRow(meso.id, 3, tmpl.id, 'normal', 4, 2)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 2, 5, 6])
  })

  // AC4: Template in both rotating and non-rotating slots → all work weeks
  it('returns all weeks when template is in both rotating and non-rotating slots', async () => {
    const meso = seedMesocycle('Test', 8)
    const tmpl = seedTemplate(meso.id, 'Push A')
    // Non-rotating slot
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 1, 1)
    // Rotating slot
    seedScheduleRow(meso.id, 3, tmpl.id, 'normal', 4, 1)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  // Template not in schedule → empty array
  it('returns empty array when template is not in schedule', async () => {
    const meso = seedMesocycle('Test', 8)
    const tmpl = seedTemplate(meso.id, 'Push A')

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([])
  })

  // AC5: Override replaces template for specific week → that week excluded
  it('excludes week where override replaces template', async () => {
    const meso = seedMesocycle('Test', 12)
    const tmplA = seedTemplate(meso.id, 'Push A')
    const tmplB = seedTemplate(meso.id, 'Push B')
    // Push A on day 0 every week
    seedScheduleRow(meso.id, 0, tmplA.id, 'normal', 1, 1)
    // Override week 5: replace Push A with Push B
    seedOverride(meso.id, 5, 0, tmplB.id, 'day0-07:00')

    const result = await getActiveWeeksForTemplate(tmplA.id, meso.id)
    expect(result).not.toContain(5)
    expect(result).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12])
  })

  // AC6: Override adds template to week where it wouldn't normally appear
  it('includes week where override adds template', async () => {
    const meso = seedMesocycle('Test', 8)
    const tmplA = seedTemplate(meso.id, 'Push A')
    // Push A in cycle_length=4, position=1 → weeks 1,5
    seedScheduleRow(meso.id, 0, tmplA.id, 'normal', 4, 1)
    // Override adds Push A to week 3 (where it wouldn't appear)
    seedOverride(meso.id, 3, 0, tmplA.id, 'day0-07:00')

    const result = await getActiveWeeksForTemplate(tmplA.id, meso.id)
    expect(result).toEqual([1, 3, 5])
  })

  // Override removes template (null) for a week
  it('excludes week where override sets template to null (rest)', async () => {
    const meso = seedMesocycle('Test', 4)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 1, 1)
    // Override week 2 to rest (null template)
    seedOverride(meso.id, 2, 0, null, 'day0-07:00')

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 3, 4])
  })

  // AC15/16: cycle_length > work_weeks
  it('handles cycle_length greater than work_weeks', async () => {
    const meso = seedMesocycle('Test', 3)
    const tmpl = seedTemplate(meso.id, 'Push A')
    // 4-week cycle, position 1 → only week 1 fits (position 1 maps to week 1)
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 1)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1])
  })

  // AC16: 13-week meso, cycle_length=4, position=1 → [1, 5, 9, 13]
  it('wraps cycle correctly in 13-week meso', async () => {
    const meso = seedMesocycle('Test', 13)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 1)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 5, 9, 13])
  })

  // AC17: 2 positions in 4-week cycle, 8-week meso → 4 weeks
  it('returns correct count for multi-position rotation', async () => {
    const meso = seedMesocycle('Test', 8)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 1)
    seedScheduleRow(meso.id, 0, tmpl.id, 'normal', 4, 3, '09:00')

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([1, 3, 5, 7])
    expect(result).toHaveLength(4)
  })

  // Only considers normal week_type, not deload
  it('ignores deload schedule entries', async () => {
    const meso = seedMesocycle('Test', 4)
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedScheduleRow(meso.id, 0, tmpl.id, 'deload', 1, 1)

    const result = await getActiveWeeksForTemplate(tmpl.id, meso.id)
    expect(result).toEqual([])
  })
})
