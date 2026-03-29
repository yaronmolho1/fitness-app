import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
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

import { updateExerciseSlot } from './slot-actions'

function seedMesocycle() {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(mesocycleId: number) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name: 'Push A',
      canonical_name: 'push-a',
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedExercise(name = 'Bench Press') {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance', created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
}

function seedSlot(templateId: number, exerciseId: number) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      sets: 3,
      reps: '10',
      weight: 60,
      rpe: 8,
      order: 1,
      is_main: false,
      created_at: new Date(),
    })
    .returning()
    .get()
}

function seedOverride(slotId: number, weekNumber: number, weight: number) {
  return testDb
    .insert(schema.slot_week_overrides)
    .values({
      exercise_slot_id: slotId,
      week_number: weekNumber,
      weight,
      is_deload: 0,
      created_at: new Date(),
    })
    .returning()
    .get()
}

function countOverrides(slotId: number): number {
  const rows = testDb
    .select()
    .from(schema.slot_week_overrides)
    .where(eq(schema.slot_week_overrides.exercise_slot_id, slotId))
    .all()
  return rows.length
}

beforeEach(() => {
  testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)
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
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      section_id INTEGER,
      sets INTEGER,
      reps TEXT,
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
    CREATE TABLE slot_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      weight REAL,
      reps TEXT,
      sets INTEGER,
      rpe REAL,
      distance REAL,
      duration INTEGER,
      pace TEXT,
      planned_duration INTEGER,
      interval_count INTEGER,
      interval_rest INTEGER,
      elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER,
      UNIQUE(exercise_slot_id, week_number)
    )
  `)
})

describe('updateExerciseSlot — clearOverrides (T158)', () => {
  it('deletes all overrides when clearOverrides is true', async () => {
    const meso = seedMesocycle()
    const template = seedTemplate(meso.id)
    const exercise = seedExercise()
    const slot = seedSlot(template.id, exercise.id)

    seedOverride(slot.id, 1, 62)
    seedOverride(slot.id, 2, 65)
    seedOverride(slot.id, 3, 67)
    expect(countOverrides(slot.id)).toBe(3)

    const result = await updateExerciseSlot({
      id: slot.id,
      weight: 70,
      clearOverrides: true,
    })

    expect(result.success).toBe(true)
    expect(countOverrides(slot.id)).toBe(0)
  })

  it('preserves overrides when clearOverrides is false', async () => {
    const meso = seedMesocycle()
    const template = seedTemplate(meso.id)
    const exercise = seedExercise()
    const slot = seedSlot(template.id, exercise.id)

    seedOverride(slot.id, 1, 62)
    seedOverride(slot.id, 2, 65)

    const result = await updateExerciseSlot({
      id: slot.id,
      weight: 70,
      clearOverrides: false,
    })

    expect(result.success).toBe(true)
    expect(countOverrides(slot.id)).toBe(2)
  })

  it('preserves overrides when clearOverrides is omitted', async () => {
    const meso = seedMesocycle()
    const template = seedTemplate(meso.id)
    const exercise = seedExercise()
    const slot = seedSlot(template.id, exercise.id)

    seedOverride(slot.id, 1, 62)

    const result = await updateExerciseSlot({
      id: slot.id,
      weight: 70,
    })

    expect(result.success).toBe(true)
    expect(countOverrides(slot.id)).toBe(1)
  })

  it('still updates slot values when clearing overrides', async () => {
    const meso = seedMesocycle()
    const template = seedTemplate(meso.id)
    const exercise = seedExercise()
    const slot = seedSlot(template.id, exercise.id)

    seedOverride(slot.id, 1, 62)

    const result = await updateExerciseSlot({
      id: slot.id,
      weight: 75,
      sets: 4,
      clearOverrides: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.weight).toBe(75)
      expect(result.data.sets).toBe(4)
    }
    expect(countOverrides(slot.id)).toBe(0)
  })
})
