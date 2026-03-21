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
import { getSlotsByTemplate } from './slot-queries'
import { reorderExerciseSlots } from './slot-actions'

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

function seedExercise(name: string) {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance', created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
}

beforeEach(() => {
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
    section_id INTEGER,
      sets INTEGER,
      reps TEXT,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
      guidelines TEXT,
      "order" INTEGER NOT NULL,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
})

describe('reorderExerciseSlots', () => {
  it('reorders slots to match provided ID sequence', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')
    const ex3 = seedExercise('Flyes')

    const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
    const r3 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: 10 })

    if (!r1.success || !r2.success || !r3.success) throw new Error('setup failed')

    // Reorder: Flyes first, Bench second, Incline third
    const result = await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [r3.data.id, r1.data.id, r2.data.id],
    })

    expect(result.success).toBe(true)

    const slots = getSlotsByTemplate(tmpl.id)
    expect(slots.map(s => s.exercise_name)).toEqual(['Flyes', 'Bench Press', 'Incline Press'])
  })

  it('is a no-op when order unchanged', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')

    const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })

    if (!r1.success || !r2.success) throw new Error('setup failed')

    // Same order as current
    const result = await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [r1.data.id, r2.data.id],
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.noop).toBe(true)
  })

  it('returns error for empty slot_ids array', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)

    const result = await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [],
    })

    expect(result.success).toBe(false)
  })

  it('returns error when template does not exist', async () => {
    const result = await reorderExerciseSlots({
      template_id: 9999,
      slot_ids: [1, 2],
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/template/i)
  })

  it('returns error when slot IDs do not match template slots', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')

    const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })

    if (!r1.success) throw new Error('setup failed')

    // Missing one slot ID
    const result = await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [r1.data.id],
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mismatch/i)
  })

  it('returns error when slot IDs contain IDs from another template', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id)
    const tmpl2 = testDb.insert(schema.workout_templates).values({
      mesocycle_id: meso.id, name: 'Pull A', canonical_name: 'pull-a',
      modality: 'resistance', created_at: new Date(),
    }).returning({ id: schema.workout_templates.id }).get()

    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Row')

    const r1 = await addExerciseSlot({ template_id: tmpl1.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl2.id, exercise_id: ex2.id, sets: 3, reps: 10 })

    if (!r1.success || !r2.success) throw new Error('setup failed')

    const result = await reorderExerciseSlots({
      template_id: tmpl1.id,
      slot_ids: [r1.data.id, r2.data.id],
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mismatch/i)
  })

  it('does not alter other slot fields after reorder', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Flyes')

    const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 4, reps: 8 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 12 })

    if (!r1.success || !r2.success) throw new Error('setup failed')

    await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [r2.data.id, r1.data.id],
    })

    const slots = getSlotsByTemplate(tmpl.id)
    // Flyes now first
    expect(slots[0].exercise_name).toBe('Flyes')
    expect(slots[0].sets).toBe(3)
    expect(slots[0].reps).toBe('12')
    // Bench now second
    expect(slots[1].exercise_name).toBe('Bench Press')
    expect(slots[1].sets).toBe(4)
    expect(slots[1].reps).toBe('8')
  })

  it('assigns contiguous sort_order values starting from 1', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')
    const ex3 = seedExercise('Flyes')

    const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
    const r3 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: 10 })

    if (!r1.success || !r2.success || !r3.success) throw new Error('setup failed')

    await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [r3.data.id, r1.data.id, r2.data.id],
    })

    const slots = getSlotsByTemplate(tmpl.id)
    expect(slots.map(s => s.order)).toEqual([1, 2, 3])
  })

  it('validates template_id is positive integer', async () => {
    const result = await reorderExerciseSlots({
      template_id: -1,
      slot_ids: [1, 2],
    })
    expect(result.success).toBe(false)
  })

  it('validates slot_ids are positive integers', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)

    const result = await reorderExerciseSlots({
      template_id: tmpl.id,
      slot_ids: [0, -1],
    })
    expect(result.success).toBe(false)
  })
})
