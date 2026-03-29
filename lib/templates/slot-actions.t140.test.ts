// T140 tests: addExerciseSlot section_id parameter
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

import { addExerciseSlot } from './slot-actions'

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

function seedTemplate(mesocycleId: number, modality: 'resistance' | 'mixed' = 'resistance') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name: modality === 'mixed' ? 'Strength + Cardio' : 'Push A',
      canonical_name: modality === 'mixed' ? 'strength-cardio' : 'push-a',
      modality,
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

function seedSection(templateId: number, name = 'Strength', modality: 'resistance' | 'running' | 'mma' = 'resistance') {
  return testDb
    .insert(schema.template_sections)
    .values({
      template_id: templateId,
      section_name: name,
      modality,
      order: 1,
      created_at: new Date(),
    })
    .returning({ id: schema.template_sections.id })
    .get()
}

beforeEach(() => {
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
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
      target_distance REAL,
      target_duration INTEGER,
    target_elevation_gain INTEGER,
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
})

describe('addExerciseSlot — section_id parameter (T140)', () => {
  it('accepts section_id and stores it on the created slot', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'mixed')
    const section = seedSection(tmpl.id, 'Strength', 'resistance')
    const ex = seedExercise()

    const result = await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
      section_id: section.id,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.section_id).toBe(section.id)
    }
  })

  it('stores section_id in the database', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'mixed')
    const section = seedSection(tmpl.id, 'Strength', 'resistance')
    const ex = seedExercise()

    await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
      section_id: section.id,
    })

    const rows = testDb.select().from(schema.exercise_slots).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].section_id).toBe(section.id)
  })

  it('rejects non-existent section_id', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'mixed')
    const ex = seedExercise()

    const result = await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
      section_id: 99999,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/section/i)
    }
  })

  it('rejects section_id that belongs to a different template', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id, 'mixed')
    const tmpl2 = testDb.insert(schema.workout_templates).values({
      mesocycle_id: meso.id, name: 'Other', canonical_name: 'other',
      modality: 'mixed', created_at: new Date(),
    }).returning({ id: schema.workout_templates.id }).get()

    const section = seedSection(tmpl2.id, 'Strength', 'resistance')
    const ex = seedExercise()

    const result = await addExerciseSlot({
      template_id: tmpl1.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
      section_id: section.id,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/section/i)
    }
  })

  // AC9: Pure resistance templates — section_id remains null
  it('section_id defaults to null when not provided', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id) // pure resistance
    const ex = seedExercise()

    const result = await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.section_id).toBeNull()
    }
  })

  it('section_id null stored in DB when not provided', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()

    await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
    })

    const rows = testDb.select().from(schema.exercise_slots).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].section_id).toBeNull()
  })

  it('validates section_id is a positive integer when provided', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id, 'mixed')
    const ex = seedExercise()

    const result = await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
      section_id: -1,
    })

    expect(result.success).toBe(false)
  })
})
