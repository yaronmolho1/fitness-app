// Characterization test — captures current behavior for safe refactoring
// Focus: order field semantics and getSlotsByTemplate query, pre-T029

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

import { addExerciseSlot, removeExerciseSlot, toggleSlotRole, updateExerciseSlot } from './slot-actions'
import { getSlotsByTemplate } from './slot-queries'

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

function seedExercise(name = 'Bench Press', modality: 'resistance' | 'running' | 'mma' = 'resistance') {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality, created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
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
      week_number INTEGER NOT NULL, weight REAL, reps TEXT, sets INTEGER,
      rpe REAL, distance REAL, duration INTEGER, pace TEXT,
      planned_duration INTEGER,
      interval_count INTEGER,
      interval_rest INTEGER,
      is_deload INTEGER NOT NULL DEFAULT 0, created_at INTEGER
    )
  `)
})

describe('getSlotsByTemplate — characterize', () => {
  it('returns empty array for template with no slots', () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = getSlotsByTemplate(tmpl.id)
    expect(result).toEqual([])
  })

  it('returns slots ordered by order ASC', () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')
    const ex3 = seedExercise('Flyes')

    // Insert out of order via raw DB to verify ordering
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: '10',
      order: 3, is_main: false, created_at: new Date(),
    }).run()
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: '10',
      order: 1, is_main: false, created_at: new Date(),
    }).run()
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: '10',
      order: 2, is_main: false, created_at: new Date(),
    }).run()

    const result = getSlotsByTemplate(tmpl.id)
    expect(result.map(r => r.order)).toEqual([1, 2, 3])
    expect(result.map(r => r.exercise_name)).toEqual(['Bench Press', 'Incline Press', 'Flyes'])
  })

  it('includes exercise_name from joined exercises table', () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise('Lat Pulldown')

    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id, exercise_id: ex.id, sets: 4, reps: '12',
      order: 1, is_main: true, created_at: new Date(),
    }).run()

    const result = getSlotsByTemplate(tmpl.id)
    expect(result).toHaveLength(1)
    expect(result[0].exercise_name).toBe('Lat Pulldown')
    expect(result[0].sets).toBe(4)
    expect(result[0].reps).toBe('12')
    expect(result[0].is_main).toBe(true)
  })

  it('only returns slots for the specified template', () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id)
    // Second template needs different canonical name
    const tmpl2 = testDb.insert(schema.workout_templates).values({
      mesocycle_id: meso.id, name: 'Pull A', canonical_name: 'pull-a',
      modality: 'resistance', created_at: new Date(),
    }).returning({ id: schema.workout_templates.id }).get()

    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Barbell Row')

    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl1.id, exercise_id: ex1.id, sets: 3, reps: '10',
      order: 1, is_main: false, created_at: new Date(),
    }).run()
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl2.id, exercise_id: ex2.id, sets: 3, reps: '10',
      order: 1, is_main: false, created_at: new Date(),
    }).run()

    const result1 = getSlotsByTemplate(tmpl1.id)
    const result2 = getSlotsByTemplate(tmpl2.id)
    expect(result1).toHaveLength(1)
    expect(result1[0].exercise_name).toBe('Bench Press')
    expect(result2).toHaveLength(1)
    expect(result2[0].exercise_name).toBe('Barbell Row')
  })

  it('handles gaps in order values', () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Flyes')

    // Simulate gap: orders 1, 3 (slot 2 was removed)
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: '10',
      order: 1, is_main: false, created_at: new Date(),
    }).run()
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: '10',
      order: 3, is_main: false, created_at: new Date(),
    }).run()

    const result = getSlotsByTemplate(tmpl.id)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.order)).toEqual([1, 3])
  })
})

describe('order field behavior across operations — characterize', () => {
  it('addExerciseSlot uses max(order)+1, not count+1', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')
    const ex3 = seedExercise('Flyes')

    // Add 3 slots: orders 1, 2, 3
    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: 10 })

    // Remove middle slot (order=2), leaving [1, 3]
    if (r2.success) await removeExerciseSlot(r2.data.id)

    // Add new slot — should get order=4 (max=3, +1), NOT order=3 (count=2, +1)
    const ex4 = seedExercise('Cable Crossover')
    const r4 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex4.id, sets: 3, reps: 10 })

    expect(r4.success).toBe(true)
    if (r4.success) expect(r4.data.order).toBe(4)
  })

  it('removeExerciseSlot does NOT re-compact remaining orders', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')
    const ex3 = seedExercise('Flyes')

    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: 10 })

    if (r2.success) await removeExerciseSlot(r2.data.id)

    const slots = getSlotsByTemplate(tmpl.id)
    expect(slots.map(s => s.order)).toEqual([1, 3])
  })

  it('updateExerciseSlot does not change order', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise('Bench Press')

    const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
    if (!added.success) throw new Error('setup failed')

    const updated = await updateExerciseSlot({ id: added.data.id, sets: 5 })
    expect(updated.success).toBe(true)
    if (updated.success) expect(updated.data.order).toBe(1)
  })

  it('toggleSlotRole does not change order', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise('Bench Press')

    const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
    if (!added.success) throw new Error('setup failed')

    const toggled = await toggleSlotRole(added.data.id)
    expect(toggled.success).toBe(true)
    if (toggled.success) expect(toggled.data.order).toBe(1)
  })

  it('order is scoped per template', async () => {
    const meso = seedMesocycle()
    const tmpl1 = seedTemplate(meso.id)
    const tmpl2 = testDb.insert(schema.workout_templates).values({
      mesocycle_id: meso.id, name: 'Pull A', canonical_name: 'pull-a',
      modality: 'resistance', created_at: new Date(),
    }).returning({ id: schema.workout_templates.id }).get()

    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Barbell Row')

    const r1 = await addExerciseSlot({ template_id: tmpl1.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl2.id, exercise_id: ex2.id, sets: 3, reps: 10 })

    // Both should start at order=1 since they're in different templates
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    if (r1.success) expect(r1.data.order).toBe(1)
    if (r2.success) expect(r2.data.order).toBe(1)
  })

  it('reorderExerciseSlots is exported from slot-actions (added in T029)', async () => {
    const slotActions = await import('./slot-actions')
    expect('reorderExerciseSlots' in slotActions).toBe(true)
  })
})

describe('updateExerciseSlot — no-op returns existing data', () => {
  it('returns existing slot when no fields provided', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()
    const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
    if (!added.success) throw new Error('setup failed')

    const result = await updateExerciseSlot({ id: added.data.id })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(added.data.id)
      expect(result.data.sets).toBe(3)
    }
  })
})

// ============================================================================
// T140 pre-change characterization: section_id not in addExerciseSlot
// ============================================================================

describe('addExerciseSlot — section_id behavior (pre-T140)', () => {
  it('input type does NOT include section_id', async () => {
    // The addSlotSchema only has: template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines
    // Passing section_id as extra property is stripped by zod .object() (strip mode)
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()

    const result = await addExerciseSlot({
      template_id: tmpl.id,
      exercise_id: ex.id,
      sets: 3,
      reps: 10,
    } as AddExerciseSlotInput)

    expect(result.success).toBe(true)
    if (result.success) {
      // NOTE: section_id column exists in DB but addExerciseSlot never sets it
      expect(result.data.section_id).toBeNull()
    }
  })

  it('created slot has section_id = null in database', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()

    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })

    const rows = testDb.select().from(schema.exercise_slots).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].section_id).toBeNull()
  })

  it('order auto-increment is global per template, not per section', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Squat')

    // Manually insert a slot with section_id set (simulating future behavior)
    testDb.insert(schema.exercise_slots).values({
      template_id: tmpl.id,
      exercise_id: ex1.id,
      section_id: 999, // hypothetical section
      sets: 3,
      reps: '10',
      order: 1,
      is_main: false,
      created_at: new Date(),
    }).run()

    // addExerciseSlot computes max(order) across ALL slots in template, regardless of section
    const result = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      // Should be 2, not 1 — order is template-scoped
      expect(result.data.order).toBe(2)
    }
  })

  it('is_main is always hardcoded to false', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()

    const result = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.is_main).toBe(false)
  })

  it('reps is stored as text (String(reps))', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()

    const result = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 12 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.data.reps).toBe('string')
      expect(result.data.reps).toBe('12')
    }
  })
})

// Re-export type for use in section_id test above
type AddExerciseSlotInput = {
  template_id: number
  exercise_id: number
  sets: number
  reps: number
  weight?: number
  rpe?: number
  rest_seconds?: number
  guidelines?: string
}
