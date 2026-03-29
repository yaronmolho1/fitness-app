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

import { moveWorkout, undoScheduleMove, resetWeekSchedule } from './override-actions'

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
  timeSlot?: string
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

describe('moveWorkout', () => {
  describe('AC1: this_week scope creates 2 override rows', () => {
    it('creates source=null and target=template_id override rows', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      // Monday morning has Push A
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 3,
        source_day: 1,
        source_period: 'morning',
        target_day: 3, // Wednesday
        target_period: 'evening',
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      expect(overrides).toHaveLength(2)

      // Source override: nulls out the template on Monday morning
      const source = overrides.find(
        (o: OverrideRow) => o.day_of_week === 1 && o.period === 'morning'
      )
      expect(source).toBeDefined()
      expect(source!.template_id).toBeNull()
      expect(source!.week_number).toBe(3)

      // Target override: places template on Wednesday evening
      const target = overrides.find(
        (o: OverrideRow) => o.day_of_week === 3 && o.period === 'evening'
      )
      expect(target).toBeDefined()
      expect(target!.template_id).toBe(tmpl.id)
      expect(target!.week_number).toBe(3)

      // Both share same override_group
      expect(source!.override_group).toBe(target!.override_group)
      expect(source!.override_group).toBeTruthy()
    })
  })

  describe('AC2: remaining_weeks creates pairs for weeks N through total_weeks', () => {
    it('creates override pairs for all remaining weeks', async () => {
      const meso = seedMesocycle({ work_weeks: 4 })
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'remaining_weeks',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      // Weeks 2, 3, 4 — 3 weeks × 2 rows = 6
      expect(overrides).toHaveLength(6)

      for (const week of [2, 3, 4]) {
        const sourceRow = overrides.find(
          (o: OverrideRow) => o.week_number === week && o.day_of_week === 1
        )
        const targetRow = overrides.find(
          (o: OverrideRow) => o.week_number === week && o.day_of_week === 3
        )
        expect(sourceRow).toBeDefined()
        expect(sourceRow!.template_id).toBeNull()
        expect(targetRow).toBeDefined()
        expect(targetRow!.template_id).toBe(tmpl.id)
      }
    })

    it('skips weeks where the template is already logged', async () => {
      const meso = seedMesocycle({
        work_weeks: 4,
        start_date: '2026-03-02',
      })
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning') // Monday morning

      // Log Push A on week 3 Tuesday (2026-03-02 + 14 + 1 = 2026-03-17)
      seedLoggedWorkout(tmpl.id, 'push-a', '2026-03-17')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'remaining_weeks',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      // Weeks 2 and 4 only (week 3 skipped) — 2 weeks × 2 rows = 4
      expect(overrides).toHaveLength(4)
      const weekNumbers = [...new Set(overrides.map((o: OverrideRow) => o.week_number))]
      expect(weekNumbers.sort()).toEqual([2, 4])
    })
  })

  describe('AC3: moving one period does not affect other periods', () => {
    it('preserves other periods on the source day', async () => {
      const meso = seedMesocycle()
      const tmplMorning = seedTemplate(meso.id, 'Push A')
      const tmplEvening = seedTemplate(meso.id, 'Cardio')
      seedSchedule(meso.id, 1, tmplMorning.id, 'morning')
      seedSchedule(meso.id, 1, tmplEvening.id, 'evening')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'afternoon',
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      // Only 2 overrides — source morning null, target afternoon push-a
      expect(overrides).toHaveLength(2)
      // No override for evening
      const eveningOverride = overrides.find(
        (o: OverrideRow) => o.day_of_week === 1 && o.period === 'evening'
      )
      expect(eveningOverride).toBeUndefined()
    })
  })

  describe('AC4: target day can accumulate sessions across periods', () => {
    it('allows moving to a day that already has a workout in a different period', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Cardio')
      // Monday morning: Push A, Wednesday morning: Cardio
      seedSchedule(meso.id, 1, tmpl1.id, 'morning')
      seedSchedule(meso.id, 3, tmpl2.id, 'morning')

      // Move Push A from Mon morning → Wed afternoon
      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'afternoon',
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      expect(overrides).toHaveLength(2)
      // Target is Wednesday afternoon, not Wednesday morning
      const target = overrides.find(
        (o: OverrideRow) => o.day_of_week === 3 && o.period === 'afternoon'
      )
      expect(target).toBeDefined()
      expect(target!.template_id).toBe(tmpl1.id)
    })
  })

  describe('AC5: completed mesocycle guard', () => {
    it('rejects move on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })
  })

  describe('AC6: logged workout guard', () => {
    it('rejects move when source template already logged on that date', async () => {
      const meso = seedMesocycle({ start_date: '2026-03-02' })
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      // Log Push A on week 1 Monday (2026-03-02 + day 1 = 2026-03-03)
      seedLoggedWorkout(tmpl.id, 'push-a', '2026-03-03')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/logged/i)
    })
  })

  describe('edge: same day different period', () => {
    it('allows moving to same day with different period', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 1,
        target_period: 'evening',
        scope: 'this_week',
      })

      expect(result.success).toBe(true)
      const overrides = getOverrides()
      expect(overrides).toHaveLength(2)
    })
  })

  describe('edge: same day same period', () => {
    it('rejects moving to same day and same period (no-op)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 1,
        target_period: 'morning',
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/same/i)
    })
  })

  describe('validation', () => {
    it('rejects non-existent mesocycle', async () => {
      const result = await moveWorkout({
        mesocycle_id: 999,
        week_number: 1,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })

    it('rejects when source slot has no template', async () => {
      const meso = seedMesocycle()
      // No schedule entry for day 1 morning

      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })

      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/template/i)
    })

    it('rejects invalid day_of_week values', async () => {
      const meso = seedMesocycle()
      const result = await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 7,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('override_group', () => {
    it('uses a unique override_group per move operation', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id, 'Push A')
      const tmpl2 = seedTemplate(meso.id, 'Pull A')
      seedSchedule(meso.id, 1, tmpl1.id, 'morning')
      seedSchedule(meso.id, 3, tmpl2.id, 'morning')

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 1,
        source_period: 'morning',
        target_day: 2,
        target_period: 'morning',
        scope: 'this_week',
      })

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 3,
        source_period: 'morning',
        target_day: 4,
        target_period: 'morning',
        scope: 'this_week',
      })

      const overrides = getOverrides()
      expect(overrides).toHaveLength(4)
      const groups = [...new Set(overrides.map((o: OverrideRow) => o.override_group))]
      expect(groups).toHaveLength(2)
    })
  })

  describe('transaction atomicity', () => {
    it('does not create partial overrides on validation failure', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 1,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })

      const overrides = getOverrides()
      expect(overrides).toHaveLength(0)
    })
  })

  describe('revalidation', () => {
    it('calls revalidatePath on success', async () => {
      const { revalidatePath } = await import('next/cache')
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id, 'Push A')
      seedSchedule(meso.id, 1, tmpl.id, 'morning')

      await moveWorkout({
        mesocycle_id: meso.id,
        week_number: 2,
        source_day: 1,
        source_period: 'morning',
        target_day: 3,
        target_period: 'evening',
        scope: 'this_week',
      })

      expect(revalidatePath).toHaveBeenCalled()
    })
  })
})

describe('undoScheduleMove', () => {
  beforeEach(() => {
    createTables()
    vi.clearAllMocks()
  })

  it('deletes all override rows matching override_group + mesocycle', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    seedSchedule(meso.id, 1, tmpl.id, 'morning')

    const moveResult = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      source_day: 1,
      source_period: 'morning',
      target_day: 3,
      target_period: 'evening',
      scope: 'this_week',
    })
    expect(moveResult.success).toBe(true)
    const group = (moveResult as { success: true; override_group: string }).override_group

    const result = await undoScheduleMove(group, meso.id)
    expect(result.success).toBe(true)
    expect((result as { success: true; deleted: number }).deleted).toBe(2)

    const remaining = testDb
      .select()
      .from(schema.schedule_week_overrides)
      .all()
    expect(remaining).toHaveLength(0)
  })

  it('does not delete overrides from a different override_group', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    seedSchedule(meso.id, 1, tmpl.id, 'morning')
    seedSchedule(meso.id, 2, tmpl.id, 'afternoon')

    const move1 = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      source_day: 1,
      source_period: 'morning',
      target_day: 3,
      target_period: 'evening',
      scope: 'this_week',
    })
    const move2 = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 2,
      source_day: 2,
      source_period: 'afternoon',
      target_day: 4,
      target_period: 'morning',
      scope: 'this_week',
    })

    const group1 = (move1 as { success: true; override_group: string }).override_group
    await undoScheduleMove(group1, meso.id)

    const remaining = testDb
      .select()
      .from(schema.schedule_week_overrides)
      .all()
    expect(remaining).toHaveLength(2)
    expect(remaining[0].override_group).toBe(
      (move2 as { success: true; override_group: string }).override_group
    )
  })

  it('does not delete overrides from a different mesocycle', async () => {
    const meso1 = seedMesocycle()
    const meso2 = seedMesocycle({ name: 'Other Meso' })
    const tmpl1 = seedTemplate(meso1.id)
    const tmpl2 = seedTemplate(meso2.id, 'Pull A')
    seedSchedule(meso1.id, 1, tmpl1.id, 'morning')
    seedSchedule(meso2.id, 1, tmpl2.id, 'morning')

    const move1 = await moveWorkout({
      mesocycle_id: meso1.id,
      week_number: 1,
      source_day: 1,
      source_period: 'morning',
      target_day: 3,
      target_period: 'evening',
      scope: 'this_week',
    })
    await moveWorkout({
      mesocycle_id: meso2.id,
      week_number: 1,
      source_day: 1,
      source_period: 'morning',
      target_day: 4,
      target_period: 'afternoon',
      scope: 'this_week',
    })

    const group1 = (move1 as { success: true; override_group: string }).override_group
    // Try to undo group1 against meso2 — should delete nothing
    const result = await undoScheduleMove(group1, meso2.id)
    expect(result.success).toBe(true)
    expect((result as { success: true; deleted: number }).deleted).toBe(0)

    const all = testDb.select().from(schema.schedule_week_overrides).all()
    expect(all).toHaveLength(4)
  })

  it('rejects completed mesocycle', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const result = await undoScheduleMove('some-group', meso.id)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('completed')
  })

  it('rejects non-existent mesocycle', async () => {
    const result = await undoScheduleMove('some-group', 9999)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('not found')
  })

  it('returns deleted=0 when no matching rows', async () => {
    const meso = seedMesocycle()
    const result = await undoScheduleMove('nonexistent-group', meso.id)
    expect(result.success).toBe(true)
    expect((result as { success: true; deleted: number }).deleted).toBe(0)
  })

  it('revalidates path on success', async () => {
    const { revalidatePath } = await import('next/cache')
    const meso = seedMesocycle()
    await undoScheduleMove('any-group', meso.id)
    expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
  })
})

describe('resetWeekSchedule', () => {
  beforeEach(() => {
    createTables()
    vi.clearAllMocks()
  })

  it('deletes all overrides for a given mesocycle + week', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    seedSchedule(meso.id, 1, tmpl.id, 'morning')
    seedSchedule(meso.id, 2, tmpl.id, 'afternoon')

    await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      source_day: 1,
      source_period: 'morning',
      target_day: 3,
      target_period: 'evening',
      scope: 'this_week',
    })
    await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      source_day: 2,
      source_period: 'afternoon',
      target_day: 4,
      target_period: 'morning',
      scope: 'this_week',
    })

    const result = await resetWeekSchedule(meso.id, 1)
    expect(result.success).toBe(true)
    expect((result as { success: true; deleted: number }).deleted).toBe(4)

    const remaining = testDb.select().from(schema.schedule_week_overrides).all()
    expect(remaining).toHaveLength(0)
  })

  it('does not delete overrides from other weeks', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    seedSchedule(meso.id, 1, tmpl.id, 'morning')

    await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      source_day: 1,
      source_period: 'morning',
      target_day: 3,
      target_period: 'evening',
      scope: 'remaining_weeks',
    })

    // Should have overrides for weeks 1-4
    const before = testDb.select().from(schema.schedule_week_overrides).all()
    expect(before.length).toBeGreaterThan(2)

    await resetWeekSchedule(meso.id, 1)

    const remaining = testDb.select().from(schema.schedule_week_overrides).all()
    expect(remaining.every((r: { week_number: number }) => r.week_number !== 1)).toBe(true)
    expect(remaining.length).toBeGreaterThan(0)
  })

  it('rejects completed mesocycle', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const result = await resetWeekSchedule(meso.id, 1)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('completed')
  })

  it('rejects non-existent mesocycle', async () => {
    const result = await resetWeekSchedule(9999, 1)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toContain('not found')
  })

  it('returns deleted=0 when no overrides for that week', async () => {
    const meso = seedMesocycle()
    const result = await resetWeekSchedule(meso.id, 3)
    expect(result.success).toBe(true)
    expect((result as { success: true; deleted: number }).deleted).toBe(0)
  })

  it('revalidates path on success', async () => {
    const { revalidatePath } = await import('next/cache')
    const meso = seedMesocycle()
    await resetWeekSchedule(meso.id, 1)
    expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
  })
})
