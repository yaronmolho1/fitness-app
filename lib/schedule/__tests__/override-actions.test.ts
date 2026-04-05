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

import { moveWorkout } from '../override-actions'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
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
      target_distance REAL,
      target_duration INTEGER,
      target_elevation_gain INTEGER,
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
  testDb.run(sql`
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
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
  testDb.run(sql`
    CREATE TABLE logged_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      canonical_name TEXT,
      log_date TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      rating INTEGER,
      notes TEXT,
      template_snapshot TEXT NOT NULL,
      created_at INTEGER
    )
  `)
}

function seedMesocycle(
  overrides: Partial<{
    name: string
    status: string
    has_deload: number
    work_weeks: number
    start_date: string
    end_date: string
  }> = {}
) {
  const defaults = {
    name: 'Test Meso',
    start_date: '2026-03-02', // Monday
    end_date: '2026-03-29',
    work_weeks: 4,
    has_deload: 0,
    status: 'active',
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

function seedSchedule(
  mesocycleId: number,
  dayOfWeek: number,
  templateId: number,
  period: 'morning' | 'afternoon' | 'evening' = 'morning',
  weekType: 'normal' | 'deload' = 'normal',
  timeSlot?: string,
  duration?: number
) {
  const resolvedTimeSlot = timeSlot ?? (
    period === 'morning' ? '07:00' : period === 'afternoon' ? '13:00' : '18:00'
  )
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesocycleId,
      day_of_week: dayOfWeek,
      template_id: templateId,
      week_type: weekType,
      period,
      time_slot: resolvedTimeSlot,
      duration: duration ?? 90,
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedLoggedWorkout(
  templateId: number,
  canonicalName: string,
  logDate: string
) {
  return testDb
    .insert(schema.logged_workouts)
    .values({
      template_id: templateId,
      canonical_name: canonicalName,
      log_date: logDate,
      logged_at: new Date(),
      template_snapshot: { version: 1, name: canonicalName },
      created_at: new Date(),
    })
    .returning()
    .get()
}

type OverrideRow = typeof schema.schedule_week_overrides.$inferSelect

function getOverrides(): OverrideRow[] {
  return testDb.select().from(schema.schedule_week_overrides).all() as OverrideRow[]
}

beforeEach(() => {
  createTables()
})

describe('moveWorkout — time-aware (T199)', () => {
  describe('AC1: source identified by schedule_id (row ID)', () => {
    it('accepts schedule_id instead of source_day + source_period', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
    })

    it('rejects when schedule_id does not exist', async () => {
      const meso = seedMesocycle()

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        schedule_id: 9999,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/source/i)
    })

    it('rejects when schedule_id belongs to different mesocycle', async () => {
      const meso1 = seedMesocycle()
      const meso2 = seedMesocycle({ name: 'Other Meso' })
      const tmpl = seedTemplate(meso1.id, 'Push A')
      const entry = seedSchedule(meso1.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso2.id,
        week_number: 1,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/source/i)
    })
  })

  describe('AC5: override rows store target time_slot and duration', () => {
    it('creates source override with original time_slot/duration and target override with specified values', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '08:30', 75)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '17:30',
        target_duration: 45,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      expect(overrides).toHaveLength(2)

      // Source override: nulls out template, uses source's time_slot and duration
      const source = overrides.find((o: OverrideRow) => o.template_id === null)
      expect(source).toBeDefined()
      expect(source!.day_of_week).toBe(1)
      expect(source!.time_slot).toBe('08:30')
      expect(source!.duration).toBe(75)

      // Target override: places template with specified time_slot + duration
      const target = overrides.find((o: OverrideRow) => o.template_id === tmpl.id)
      expect(target).toBeDefined()
      expect(target!.day_of_week).toBe(3)
      expect(target!.time_slot).toBe('17:30')
      expect(target!.duration).toBe(45)
    })
  })

  describe('AC6: period is derived from time_slot via derivePeriod()', () => {
    it('derives morning period for target time < 12:00', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '09:00',
        target_duration: 60,
        scope: 'this_week',
      })

      const overrides = getOverrides()
      const target = overrides.find((o: OverrideRow) => o.template_id === tmpl.id)
      expect(target!.period).toBe('morning')
    })

    it('derives afternoon period for target time 12:00-16:59', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '14:00',
        target_duration: 60,
        scope: 'this_week',
      })

      const overrides = getOverrides()
      const target = overrides.find((o: OverrideRow) => o.template_id === tmpl.id)
      expect(target!.period).toBe('afternoon')
    })

    it('derives evening period for target time >= 17:00', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '19:00',
        target_duration: 60,
        scope: 'this_week',
      })

      const overrides = getOverrides()
      const target = overrides.find((o: OverrideRow) => o.template_id === tmpl.id)
      expect(target!.period).toBe('evening')
    })

    it('derives source override period from source time_slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      // Source at 14:00 = afternoon
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'afternoon', 'normal', '14:00', 60)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '07:00',
        target_duration: 60,
        scope: 'this_week',
      })

      const overrides = getOverrides()
      const source = overrides.find((o: OverrideRow) => o.template_id === null)
      expect(source!.period).toBe('afternoon')
    })
  })

  describe('Zod validation — new schema', () => {
    it('rejects missing schedule_id', async () => {
      const result = await moveWorkout({
        mesocycle_id: 1,
        week_number: 1,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      } as Parameters<typeof moveWorkout>[0])

      expect(result.success).toBe(false)
    })

    it('rejects missing target_time_slot', async () => {
      const result = await moveWorkout({
        mesocycle_id: 1,
        week_number: 1,
        schedule_id: 1,
        target_day: 3,
        target_duration: 60,
        scope: 'this_week',
      } as Parameters<typeof moveWorkout>[0])

      expect(result.success).toBe(false)
    })

    it('rejects missing target_duration', async () => {
      const result = await moveWorkout({
        mesocycle_id: 1,
        week_number: 1,
        schedule_id: 1,
        target_day: 3,
        target_time_slot: '18:00',
        scope: 'this_week',
      } as Parameters<typeof moveWorkout>[0])

      expect(result.success).toBe(false)
    })

    it('rejects invalid time_slot format', async () => {
      const result = await moveWorkout({
        mesocycle_id: 1,
        week_number: 1,
        schedule_id: 1,
        target_day: 3,
        target_time_slot: '25:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
    })

    it('rejects non-positive duration', async () => {
      const result = await moveWorkout({
        mesocycle_id: 1,
        week_number: 1,
        schedule_id: 1,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 0,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('no-op guard: same day + same time_slot', () => {
    it('rejects when target is same day and same time_slot with offset=0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 1,
        target_time_slot: '07:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/same/i)
    })

    it('allows same day with different time_slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 1,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('AC7: remaining_weeks creates overrides for each future week', () => {
    it('creates override pairs for all remaining weeks with time_slot and duration', async () => {
      const meso = seedMesocycle({ work_weeks: 4 })
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '17:30',
        target_duration: 45,
        scope: 'remaining_weeks',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      // Weeks 2, 3, 4 = 3 weeks * 2 rows = 6
      expect(overrides).toHaveLength(6)

      // Verify each target override has correct time_slot and duration
      const targets = overrides.filter((o: OverrideRow) => o.template_id === tmpl.id)
      expect(targets).toHaveLength(3)
      for (const t of targets) {
        expect(t.time_slot).toBe('17:30')
        expect(t.duration).toBe(45)
        expect(t.period).toBe('evening') // derived from 17:30
      }
    })
  })

  describe('AC11: no periods-full restriction', () => {
    it('allows moving to a day that already has workouts at different times', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Cardio')
      const tmpl3 = seedTemplate(meso.id, 'Legs')
      // Wednesday already has two workouts
      seedSchedule(meso.id, 3, tmpl2.id, 'morning', 'normal', '07:00', 60)
      seedSchedule(meso.id, 3, tmpl3.id, 'afternoon', 'normal', '13:00', 60)
      const entry = seedSchedule(meso.id, 1, tmpl1.id, 'morning', 'normal', '07:00', 60)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('logged workout guard (unchanged behavior)', () => {
    it('rejects this_week scope when workout is logged', async () => {
      const meso = seedMesocycle({ start_date: '2026-03-02' })
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      // Log on week 1 Monday (day_of_week=1 => 2026-03-03)
      seedLoggedWorkout(tmpl.id, 'push-a', '2026-03-03')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/logged/i)
    })

    it('skips logged weeks for remaining_weeks scope', async () => {
      const meso = seedMesocycle({ work_weeks: 4, start_date: '2026-03-02' })
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      // Log on week 3 Monday (2026-03-02 + 14 + 1 = 2026-03-17)
      seedLoggedWorkout(tmpl.id, 'push-a', '2026-03-17')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'remaining_weeks',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      // Weeks 2, 4 (week 3 skipped) = 2 * 2 = 4
      expect(overrides).toHaveLength(4)
      const weekNumbers = [...new Set(overrides.map((o: OverrideRow) => o.week_number))]
      expect(weekNumbers.sort()).toEqual([2, 4])
    })
  })

  describe('mesocycle guards (unchanged behavior)', () => {
    it('rejects completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('rejects non-existent mesocycle', async () => {
      const result = await moveWorkout({
        mesocycle_id: 999,
        week_number: 1,
        schedule_id: 1,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })
  })

  describe('override_group', () => {
    it('both override rows share the same override_group', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.override_group).toMatch(/^move-/)
      }
      const overrides = getOverrides()
      expect(overrides).toHaveLength(2)
      expect(overrides[0].override_group).toBe(overrides[1].override_group)
    })
  })

  describe('revalidation', () => {
    it('calls revalidatePath on success', async () => {
      const { revalidatePath } = await import('next/cache')
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      const entry = seedSchedule(meso.id, 1, tmpl.id, 'morning', 'normal', '07:00', 60)

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        schedule_id: entry.id,
        target_day: 3,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })

      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
    })
  })
})
