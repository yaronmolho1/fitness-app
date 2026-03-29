import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

let testDb: ReturnType<typeof drizzle>

beforeAll(() => {
  const sqlite = new Database(':memory:')
  testDb = drizzle(sqlite, { schema })

  testDb.run(sql`CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  )`)

  testDb.run(sql`CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    modality TEXT NOT NULL,
    notes TEXT,
    run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER,
    created_at INTEGER
  )`)

  testDb.run(sql`CREATE TABLE weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER REFERENCES workout_templates(id),
    week_type TEXT NOT NULL DEFAULT 'normal',
    period TEXT NOT NULL DEFAULT 'morning',
    time_slot TEXT NOT NULL DEFAULT '07:00',
    duration INTEGER NOT NULL DEFAULT 90,
    created_at INTEGER
  )`)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_template_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id)`
  )

  // Seed a mesocycle + template
  testDb.insert(schema.mesocycles).values({
    name: 'Test Meso',
    start_date: '2026-03-01',
    end_date: '2026-03-28',
    work_weeks: 4,
    created_at: new Date(),
  }).run()

  testDb.insert(schema.workout_templates).values({
    mesocycle_id: 1,
    name: 'Push Day',
    canonical_name: 'push-day',
    modality: 'resistance',
    created_at: new Date(),
  }).run()

  testDb.insert(schema.workout_templates).values({
    mesocycle_id: 1,
    name: 'Run',
    canonical_name: 'run',
    modality: 'running',
    created_at: new Date(),
  }).run()
})

describe('weekly_schedule period + time_slot columns', () => {
  it('defaults period to morning and time_slot to 07:00 when not specified', () => {
    const row = testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: 1,
        day_of_week: 0,
        template_id: 1,
        week_type: 'normal',
        created_at: new Date(),
      })
      .returning()
      .get()

    expect(row.period).toBe('morning')
    expect(row.time_slot).toBe('07:00')
    expect(row.duration).toBe(90)
  })

  it('accepts all valid period values', () => {
    for (const [i, period] of (['morning', 'afternoon', 'evening'] as const).entries()) {
      const row = testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: 1,
          day_of_week: 1,
          template_id: 1,
          week_type: 'normal',
          period,
          time_slot: `${String(7 + i * 5).padStart(2, '0')}:00`,
          created_at: new Date(),
        })
        .returning()
        .get()

      expect(row.period).toBe(period)
    }
  })

  it('stores time_slot as required text', () => {
    const row = testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: 1,
        day_of_week: 2,
        template_id: 1,
        week_type: 'normal',
        period: 'afternoon',
        time_slot: '14:30',
        created_at: new Date(),
      })
      .returning()
      .get()

    expect(row.time_slot).toBe('14:30')
  })

  it('allows different templates at the same time_slot (new unique constraint)', () => {
    const evening = testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: 1,
        day_of_week: 2,
        template_id: 2,
        week_type: 'normal',
        period: 'evening',
        time_slot: '18:00',
        created_at: new Date(),
      })
      .returning()
      .get()

    expect(evening.period).toBe('evening')
  })

  it('rejects duplicate (day, week_type, time_slot, template_id) combination', () => {
    // 14:30 on day 2 with template 1 already exists
    expect(() =>
      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: 1,
          day_of_week: 2,
          template_id: 1,
          week_type: 'normal',
          period: 'afternoon',
          time_slot: '14:30',
          created_at: new Date(),
        })
        .run()
    ).toThrow()
  })
})
