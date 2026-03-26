// Characterization test — captures current behavior for safe refactoring
// T153: Week override merge — pins slot value passthrough + week/deload detection
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

import { getTodayWorkout, isDeloadWeek } from './queries'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS routine_logs`)
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_sets`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_exercises`)
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)
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
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      modality TEXT NOT NULL,
      muscle_group TEXT,
      equipment TEXT,
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
      planned_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE template_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      modality TEXT NOT NULL,
      section_name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      run_type TEXT,
      target_pace TEXT,
      hr_zone INTEGER,
      interval_count INTEGER,
      interval_rest INTEGER,
      coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      section_id INTEGER REFERENCES template_sections(id),
      sets INTEGER NOT NULL,
      reps TEXT NOT NULL,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
      guidelines TEXT,
      "order" INTEGER NOT NULL,
      is_main INTEGER NOT NULL DEFAULT 0,
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
  testDb.run(sql`
    CREATE TABLE logged_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_workout_id INTEGER NOT NULL REFERENCES logged_workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER,
      exercise_name TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      actual_rpe REAL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE logged_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      actual_reps INTEGER,
      actual_weight REAL,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE routine_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      has_weight INTEGER NOT NULL DEFAULT 0,
      has_length INTEGER NOT NULL DEFAULT 0,
      has_duration INTEGER NOT NULL DEFAULT 0,
      has_sets INTEGER NOT NULL DEFAULT 0,
      has_reps INTEGER NOT NULL DEFAULT 0,
      frequency_target INTEGER NOT NULL DEFAULT 1,
      scope TEXT NOT NULL DEFAULT 'global',
      mesocycle_id INTEGER REFERENCES mesocycles(id),
      start_date TEXT,
      end_date TEXT,
      skip_on_deload INTEGER NOT NULL DEFAULT 0,
      frequency_mode TEXT NOT NULL DEFAULT 'weekly_target',
      frequency_days TEXT,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE routine_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_item_id INTEGER NOT NULL REFERENCES routine_items(id),
      log_date TEXT NOT NULL,
      status TEXT NOT NULL,
      value_weight REAL,
      value_length REAL,
      value_duration REAL,
      value_sets INTEGER,
      value_reps INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX routine_logs_item_date_idx ON routine_logs(routine_item_id, log_date)`
  )
}

function seedMesocycle(
  overrides: Partial<{
    name: string
    start_date: string
    end_date: string
    work_weeks: number
    has_deload: boolean
    status: string
  }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: overrides.name ?? 'Test Meso',
      start_date: overrides.start_date ?? '2026-03-01',
      end_date: overrides.end_date ?? '2026-03-28',
      work_weeks: overrides.work_weeks ?? 4,
      has_deload: overrides.has_deload ?? false,
      status: overrides.status ?? 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedExercise(name: string) {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance', created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
}

function seedTemplate(
  mesocycleId: number,
  name = 'Push A',
  modality = 'resistance'
) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality,
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedSlot(
  templateId: number,
  exerciseId: number,
  order: number,
  overrides: Partial<{
    sets: number
    reps: string
    weight: number
    rpe: number
    rest_seconds: number
    guidelines: string
    is_main: boolean
    section_id: number
  }> = {}
) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      section_id: overrides.section_id ?? null,
      sets: overrides.sets ?? 3,
      reps: overrides.reps ?? '8-12',
      weight: overrides.weight ?? null,
      rpe: overrides.rpe ?? null,
      rest_seconds: overrides.rest_seconds ?? null,
      guidelines: overrides.guidelines ?? null,
      order,
      is_main: overrides.is_main ?? false,
      created_at: new Date(),
    })
    .returning({ id: schema.exercise_slots.id })
    .get()
}

function seedSchedule(
  mesoId: number,
  day: number,
  templateId: number,
  weekType = 'normal'
) {
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

// ==========================================================================
// Slot value passthrough — pins that slots are returned with exact DB values
// T153 will modify this to merge week overrides
// ==========================================================================

describe('getTodayWorkout — slot values are raw DB values (T153 baseline)', () => {
  beforeEach(() => {
    createTables()
  })

  it('slot weight, sets, reps, rpe come directly from exercise_slots table', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex = seedExercise('Bench Press')
    seedSlot(tmpl.id, ex.id, 1, { sets: 4, reps: '6-8', weight: 100, rpe: 8.5, is_main: true })
    seedSchedule(meso.id, 1, tmpl.id) // Tuesday

    const results = await getTodayWorkout('2026-03-10') // Week 2 Tuesday
    const result = results[0]
    expect(result.type).toBe('workout')
    if (result.type !== 'workout') return

    const slot = result.slots[0]
    expect(slot.weight).toBe(100)
    expect(slot.sets).toBe(4)
    expect(slot.reps).toBe('6-8')
    expect(slot.rpe).toBe(8.5)
    expect(slot.is_main).toBe(true)
  })

  it('same slot values returned regardless of which week within mesocycle', async () => {
    // Meso starts 2026-03-01 (Sunday), 4 work weeks, no deload
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex = seedExercise('Bench Press')
    seedSlot(tmpl.id, ex.id, 1, { sets: 3, reps: '10', weight: 80, rpe: 7 })
    seedSchedule(meso.id, 1, tmpl.id) // Tuesday

    // Week 1 — 2026-03-03 (Tuesday)
    const week1 = await getTodayWorkout('2026-03-03')
    // Week 2 — 2026-03-10 (Tuesday)
    const week2 = await getTodayWorkout('2026-03-10')
    // Week 3 — 2026-03-17 (Tuesday)
    const week3 = await getTodayWorkout('2026-03-17')
    // Week 4 — 2026-03-24 (Tuesday)
    const week4 = await getTodayWorkout('2026-03-24')

    for (const results of [week1, week2, week3, week4]) {
      const r = results[0]
      expect(r.type).toBe('workout')
      if (r.type !== 'workout') continue
      expect(r.slots[0].weight).toBe(80)
      expect(r.slots[0].sets).toBe(3)
      expect(r.slots[0].reps).toBe('10')
      expect(r.slots[0].rpe).toBe(7)
    }
  })

  it('slot id is included in response', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex = seedExercise('Bench Press')
    const slot = seedSlot(tmpl.id, ex.id, 1, { sets: 3, reps: '10' })
    seedSchedule(meso.id, 1, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'workout') {
      expect(results[0].slots[0].id).toBe(slot.id)
    }
  })

  it('null-valued slot fields are preserved as null', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex = seedExercise('Bench Press')
    // No weight, rpe, rest_seconds, guidelines
    seedSlot(tmpl.id, ex.id, 1, { sets: 3, reps: '10' })
    seedSchedule(meso.id, 1, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'workout') {
      const slot = results[0].slots[0]
      expect(slot.weight).toBeNull()
      expect(slot.rpe).toBeNull()
      expect(slot.rest_seconds).toBeNull()
      expect(slot.guidelines).toBeNull()
      expect(slot.group_id).toBeNull()
      expect(slot.group_rest_seconds).toBeNull()
    }
  })

  it('multiple slots all return their individual DB values', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A')
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('OHP')
    const ex3 = seedExercise('Lateral Raise')
    seedSlot(tmpl.id, ex1.id, 1, { sets: 4, reps: '6', weight: 100, rpe: 9, is_main: true })
    seedSlot(tmpl.id, ex2.id, 2, { sets: 3, reps: '8-10', weight: 50, rpe: 8 })
    seedSlot(tmpl.id, ex3.id, 3, { sets: 3, reps: '12-15', weight: 10 })
    seedSchedule(meso.id, 1, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type !== 'workout') return

    const slots = results[0].slots
    expect(slots).toHaveLength(3)
    expect(slots[0]).toMatchObject({ weight: 100, sets: 4, reps: '6', rpe: 9 })
    expect(slots[1]).toMatchObject({ weight: 50, sets: 3, reps: '8-10', rpe: 8 })
    expect(slots[2]).toMatchObject({ weight: 10, sets: 3, reps: '12-15', rpe: null })
  })
})

// ==========================================================================
// Week type detection — pins current isDeloadWeek behavior
// T153 relies on week number calculation for override lookup
// ==========================================================================

describe('isDeloadWeek — week boundary detection (T153 baseline)', () => {
  // Meso: start=2026-03-01, 4 work weeks, deload=true
  // Week 1: Mar 1-7, Week 2: Mar 8-14, Week 3: Mar 15-21, Week 4: Mar 22-28
  // Deload: Mar 29+

  it('day 0 (start date) is not deload', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-01')).toBe(false)
  })

  it('day 6 (end of week 1) is not deload', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-07')).toBe(false)
  })

  it('day 7 (start of week 2) is not deload', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-08')).toBe(false)
  })

  it('day 27 (last day of week 4) is not deload', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-28')).toBe(false)
  })

  it('day 28 (first day of deload) is deload', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-03-29')).toBe(true)
  })

  it('day 34 (last day of deload week) is deload', () => {
    expect(isDeloadWeek('2026-03-01', 4, true, '2026-04-04')).toBe(true)
  })

  // Week number inference from diffDays
  // diffDays / 7 = week index (0-based), +1 = week number
  it('computes week index from day difference (week 1 = days 0-6)', () => {
    // Day 0-6 → weekIndex 0 → not deload (0 < workWeeks=4)
    for (let d = 0; d <= 6; d++) {
      const date = `2026-03-${String(1 + d).padStart(2, '0')}`
      expect(isDeloadWeek('2026-03-01', 4, true, date)).toBe(false)
    }
  })

  it('computes week index from day difference (week 4 = days 21-27)', () => {
    // Day 21-27 → deloadStartDay=28, so not deload
    for (let d = 21; d <= 27; d++) {
      const date = `2026-03-${String(1 + d).padStart(2, '0')}`
      expect(isDeloadWeek('2026-03-01', 4, true, date)).toBe(false)
    }
  })
})

// ==========================================================================
// Deload week_type propagation to response
// ==========================================================================

describe('getTodayWorkout — week_type in mesocycle info (T153 baseline)', () => {
  beforeEach(() => {
    createTables()
  })

  it('week_type is "normal" on day 10 (week 2)', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id, 'normal')

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'workout') {
      expect(results[0].mesocycle.week_type).toBe('normal')
    }
  })

  it('week_type is "deload" on day 31 (deload week)', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-04-04',
      work_weeks: 4,
      has_deload: true,
    })
    const tmpl = seedTemplate(meso.id, 'Push Deload')
    seedSchedule(meso.id, 1, tmpl.id, 'deload')

    const results = await getTodayWorkout('2026-03-31')
    if (results[0].type === 'workout') {
      expect(results[0].mesocycle.week_type).toBe('deload')
    }
  })

  it('mesocycle status is passed through as-is', async () => {
    const meso = seedMesocycle({
      status: 'active',
      start_date: '2026-03-01',
    })
    const tmpl = seedTemplate(meso.id, 'Push A')
    seedSchedule(meso.id, 1, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type === 'workout') {
      expect(results[0].mesocycle.status).toBe('active')
    }
  })
})

// ==========================================================================
// Mixed template sections — slot values inside sections are also raw
// ==========================================================================

describe('getTodayWorkout — mixed template section slots are raw DB values (T153 baseline)', () => {
  beforeEach(() => {
    createTables()
  })

  it('resistance section slots have raw weight/sets/reps/rpe', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Mixed Session', 'mixed')
    const sec = testDb
      .insert(schema.template_sections)
      .values({
        template_id: tmpl.id,
        modality: 'resistance',
        section_name: 'Strength',
        order: 1,
        created_at: new Date(),
      })
      .returning({ id: schema.template_sections.id })
      .get()
    testDb
      .insert(schema.template_sections)
      .values({
        template_id: tmpl.id,
        modality: 'running',
        section_name: 'Cooldown',
        order: 2,
        created_at: new Date(),
      })
      .run()
    const ex = seedExercise('Squat')
    seedSlot(tmpl.id, ex.id, 1, {
      section_id: sec.id,
      sets: 5,
      reps: '3',
      weight: 140,
      rpe: 9,
      is_main: true,
    })
    seedSchedule(meso.id, 1, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    if (results[0].type !== 'workout') return

    const section = results[0].sections![0]
    expect(section.modality).toBe('resistance')
    expect(section.slots).toHaveLength(1)
    expect(section.slots![0]).toMatchObject({
      weight: 140,
      sets: 5,
      reps: '3',
      rpe: 9,
      is_main: true,
    })
  })
})
