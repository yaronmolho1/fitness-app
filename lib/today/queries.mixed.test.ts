// T121 — Mixed template display: query tests
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

import { getTodayWorkout } from './queries'

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
    target_distance REAL, target_duration INTEGER,
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
    target_distance REAL, target_duration INTEGER,
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
      rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
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

// Seed helpers

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

function seedTemplate(
  mesocycleId: number,
  name = 'Push A',
  overrides: Partial<{
    modality: string
    notes: string
    run_type: string
    target_pace: string
    hr_zone: number
    interval_count: number
    interval_rest: number
    coaching_cues: string
    planned_duration: number
  }> = {}
) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: overrides.modality ?? 'resistance',
      notes: overrides.notes ?? null,
      run_type: overrides.run_type ?? null,
      target_pace: overrides.target_pace ?? null,
      hr_zone: overrides.hr_zone ?? null,
      interval_count: overrides.interval_count ?? null,
      interval_rest: overrides.interval_rest ?? null,
      coaching_cues: overrides.coaching_cues ?? null,
      planned_duration: overrides.planned_duration ?? null,
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedSection(
  templateId: number,
  sectionName: string,
  modality: string,
  order: number,
  overrides: Partial<{
    run_type: string
    target_pace: string
    hr_zone: number
    interval_count: number
    interval_rest: number
    coaching_cues: string
    planned_duration: number
  }> = {}
) {
  return testDb
    .insert(schema.template_sections)
    .values({
      template_id: templateId,
      modality,
      section_name: sectionName,
      order,
      run_type: overrides.run_type ?? null,
      target_pace: overrides.target_pace ?? null,
      hr_zone: overrides.hr_zone ?? null,
      interval_count: overrides.interval_count ?? null,
      interval_rest: overrides.interval_rest ?? null,
      coaching_cues: overrides.coaching_cues ?? null,
      planned_duration: overrides.planned_duration ?? null,
      created_at: new Date(),
    })
    .returning({ id: schema.template_sections.id })
    .get()
}

function seedExercise(name: string) {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance', created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
}

function seedSlot(
  templateId: number,
  exerciseId: number,
  order: number,
  overrides: Partial<{
    section_id: number
    sets: number
    reps: string
    weight: number
    rpe: number
    rest_seconds: number
    guidelines: string
    is_main: boolean
  }> = {}
) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      section_id: overrides.section_id ?? null,
      sets: overrides.sets ?? 3,
      reps: overrides.reps ?? '10',
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

describe('getTodayWorkout — mixed template sections', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns sections array for mixed templates', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Strength + Cardio', { modality: 'mixed' })
    const sec1 = seedSection(tmpl.id, 'Main Lift', 'resistance', 1)
    seedSection(tmpl.id, 'Cooldown Run', 'running', 2, {
      run_type: 'easy',
      target_pace: '5:30',
      hr_zone: 2,
    })
    const ex = seedExercise('Bench Press')
    seedSlot(tmpl.id, ex.id, 1, { section_id: sec1.id, sets: 4, reps: '8', weight: 80, is_main: true })
    seedSchedule(meso.id, 2, tmpl.id) // Tuesday 2026-03-10

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    expect(result.type).toBe('workout')
    if (result.type === 'workout') {
      expect(result.template.modality).toBe('mixed')
      expect(result.sections).toBeDefined()
      expect(result.sections).toHaveLength(2)
    }
  })

  it('sections are ordered by order field', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Mixed Session', { modality: 'mixed' })
    // Insert in reverse order
    seedSection(tmpl.id, 'Cooldown Run', 'running', 2)
    seedSection(tmpl.id, 'Main Lift', 'resistance', 1)
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.sections![0].section_name).toBe('Main Lift')
      expect(result.sections![1].section_name).toBe('Cooldown Run')
    }
  })

  it('resistance sections include exercise slots', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Strength + Run', { modality: 'mixed' })
    const sec = seedSection(tmpl.id, 'Strength', 'resistance', 1)
    const ex1 = seedExercise('Squat')
    const ex2 = seedExercise('RDL')
    seedSlot(tmpl.id, ex1.id, 1, { section_id: sec.id, sets: 4, reps: '5', weight: 100, is_main: true })
    seedSlot(tmpl.id, ex2.id, 2, { section_id: sec.id, sets: 3, reps: '10', weight: 60 })
    seedSection(tmpl.id, 'Easy Run', 'running', 2)
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      const resistanceSection = result.sections![0]
      expect(resistanceSection.modality).toBe('resistance')
      expect(resistanceSection.slots).toHaveLength(2)
      expect(resistanceSection.slots![0].exercise_name).toBe('Squat')
      expect(resistanceSection.slots![1].exercise_name).toBe('RDL')
    }
  })

  it('running sections include run plan fields', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Lift + Run', { modality: 'mixed' })
    seedSection(tmpl.id, 'Strength', 'resistance', 1)
    seedSection(tmpl.id, 'Tempo Run', 'running', 2, {
      run_type: 'tempo',
      target_pace: '4:30',
      hr_zone: 4,
      coaching_cues: 'Stay relaxed',
    })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      const runSection = result.sections![1]
      expect(runSection.modality).toBe('running')
      expect(runSection.run_type).toBe('tempo')
      expect(runSection.target_pace).toBe('4:30')
      expect(runSection.hr_zone).toBe(4)
      expect(runSection.coaching_cues).toBe('Stay relaxed')
    }
  })

  it('mma sections include planned duration', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'BJJ + Conditioning', { modality: 'mixed' })
    seedSection(tmpl.id, 'BJJ Drills', 'mma', 1, { planned_duration: 60 })
    seedSection(tmpl.id, 'Finisher', 'resistance', 2)
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      const mmaSection = result.sections![0]
      expect(mmaSection.modality).toBe('mma')
      expect(mmaSection.planned_duration).toBe(60)
    }
  })

  it('running sections include target_distance and target_duration', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Run + Lift', { modality: 'mixed' })
    seedSection(tmpl.id, 'Easy Run', 'running', 1, {
      run_type: 'easy',
      target_pace: '5:30',
    })
    // Also insert target_distance/target_duration directly
    testDb.run(sql`
      UPDATE template_sections
      SET target_distance = 5.0, target_duration = 30
      WHERE section_name = 'Easy Run'
    `)
    seedSection(tmpl.id, 'Lifts', 'resistance', 2)
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      const runSection = result.sections![0]
      expect(runSection.target_distance).toBe(5.0)
      expect(runSection.target_duration).toBe(30)
    }
  })

  it('resistance section slots include group_id and group_rest_seconds', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Mixed Supersets', { modality: 'mixed' })
    const sec = seedSection(tmpl.id, 'Strength', 'resistance', 1)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Row')

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex1.id,
        section_id: sec.id,
        sets: 3,
        reps: '10',
        order: 1,
        is_main: false,
        group_id: 1,
        group_rest_seconds: 90,
        created_at: new Date(),
      })
      .run()
    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex2.id,
        section_id: sec.id,
        sets: 3,
        reps: '10',
        order: 2,
        is_main: false,
        group_id: 1,
        group_rest_seconds: 90,
        created_at: new Date(),
      })
      .run()
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      const resistanceSection = result.sections![0]
      expect(resistanceSection.slots).toHaveLength(2)
      expect(resistanceSection.slots![0].group_id).toBe(1)
      expect(resistanceSection.slots![0].group_rest_seconds).toBe(90)
    }
  })

  it('non-mixed templates do not include sections', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Push A', { modality: 'resistance' })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.sections).toBeUndefined()
    }
  })

  it('mixed template with 3 sections (resistance + running + mma)', async () => {
    const meso = seedMesocycle({ status: 'active', start_date: '2026-03-01' })
    const tmpl = seedTemplate(meso.id, 'Full Session', { modality: 'mixed' })
    seedSection(tmpl.id, 'Warm-up Jog', 'running', 1, { run_type: 'easy', target_pace: '6:00' })
    const sec2 = seedSection(tmpl.id, 'Main Lifts', 'resistance', 2)
    seedSection(tmpl.id, 'Sparring', 'mma', 3, { planned_duration: 30 })
    const ex = seedExercise('Deadlift')
    seedSlot(tmpl.id, ex.id, 1, { section_id: sec2.id, sets: 5, reps: '3', weight: 140, is_main: true })
    seedSchedule(meso.id, 2, tmpl.id)

    const results = await getTodayWorkout('2026-03-10')
    const result = results[0]
    if (result.type === 'workout') {
      expect(result.sections).toHaveLength(3)
      expect(result.sections![0].modality).toBe('running')
      expect(result.sections![1].modality).toBe('resistance')
      expect(result.sections![1].slots).toHaveLength(1)
      expect(result.sections![2].modality).toBe('mma')
      expect(result.sections![2].planned_duration).toBe(30)
    }
  })
})
