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

import { addExerciseSlot, updateExerciseSlot, removeExerciseSlot } from './slot-actions'

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
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      sets INTEGER,
      reps TEXT,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER,
      guidelines TEXT,
      "order" INTEGER NOT NULL,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
})

describe('addExerciseSlot', () => {
  describe('validation', () => {
    it('rejects missing template_id', async () => {
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: 0,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing exercise_id', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: 0,
        sets: 3,
        reps: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects sets = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 0,
        reps: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative sets', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: -1,
        reps: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects reps = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative reps', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: -5,
      })
      expect(result.success).toBe(false)
    })

    it('rejects rpe below 1', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        rpe: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects rpe above 10', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        rpe: 11,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative weight', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        weight: -1,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative rest_seconds', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        rest_seconds: -10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-existent template', async () => {
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: 999,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/template/i)
    })

    it('rejects non-existent exercise', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: 999,
        sets: 3,
        reps: 10,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/exercise/i)
    })
  })

  describe('sort_order auto-assignment', () => {
    it('assigns order=1 for first slot', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.order).toBe(1)
    })

    it('assigns max+1 for subsequent slots', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
      const result = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 4, reps: 8 })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.order).toBe(2)
    })

    it('handles gaps after removal', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')
      const ex3 = seedExercise('Flyes')

      const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
      const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
      // Remove slot 2
      if (r2.success) await removeExerciseSlot(r2.data.id)
      // Add slot 3 — should be max(existing)+1 = 1+1 = 2
      const r3 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: 10 })

      expect(r1.success).toBe(true)
      expect(r3.success).toBe(true)
      if (r3.success) expect(r3.data.order).toBe(2)
    })
  })

  describe('successful creation', () => {
    it('returns slot with all fields', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 4,
        reps: 8,
        weight: 80.5,
        rpe: 8,
        rest_seconds: 120,
        guidelines: 'Slow eccentric',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBeDefined()
        expect(result.data.template_id).toBe(tmpl.id)
        expect(result.data.exercise_id).toBe(ex.id)
        expect(result.data.sets).toBe(4)
        expect(result.data.reps).toBe('8')
        expect(result.data.weight).toBe(80.5)
        expect(result.data.rpe).toBe(8)
        expect(result.data.rest_seconds).toBe(120)
        expect(result.data.guidelines).toBe('Slow eccentric')
      }
    })

    it('accepts optional fields as undefined', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.weight).toBeNull()
        expect(result.data.rpe).toBeNull()
        expect(result.data.rest_seconds).toBeNull()
        expect(result.data.guidelines).toBeNull()
      }
    })

    it('allows same exercise added multiple times', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()

      const r1 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 4, reps: 8 })

      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      if (r1.success && r2.success) {
        expect(r1.data.id).not.toBe(r2.data.id)
        expect(r1.data.order).toBe(1)
        expect(r2.data.order).toBe(2)
      }
    })

    it('accepts weight = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        weight: 0,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.weight).toBe(0)
    })

    it('accepts rest_seconds = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const result = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        rest_seconds: 0,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.rest_seconds).toBe(0)
    })
  })
})

describe('updateExerciseSlot', () => {
  describe('validation', () => {
    it('rejects non-existent slot', async () => {
      const result = await updateExerciseSlot({ id: 999, sets: 3 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/slot/i)
    })

    it('rejects sets = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, sets: 0 })
      expect(result.success).toBe(false)
    })

    it('rejects negative reps', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, reps: -1 })
      expect(result.success).toBe(false)
    })

    it('rejects rpe outside 1-10', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const r1 = await updateExerciseSlot({ id: added.data.id, rpe: 0 })
      expect(r1.success).toBe(false)

      const r2 = await updateExerciseSlot({ id: added.data.id, rpe: 11 })
      expect(r2.success).toBe(false)
    })

    it('rejects negative weight', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, weight: -5 })
      expect(result.success).toBe(false)
    })

    it('rejects negative rest_seconds', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, rest_seconds: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('successful update', () => {
    it('updates individual fields', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, sets: 5, rpe: 9 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sets).toBe(5)
        expect(result.data.rpe).toBe(9)
        expect(result.data.reps).toBe('10') // unchanged
      }
    })

    it('updates reps stored as text', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, reps: 12 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.reps).toBe('12')
    })

    it('clears optional fields with null', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const added = await addExerciseSlot({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        weight: 100,
        rpe: 8,
      })
      if (!added.success) throw new Error('setup failed')

      const result = await updateExerciseSlot({ id: added.data.id, weight: null, rpe: null })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.weight).toBeNull()
        expect(result.data.rpe).toBeNull()
      }
    })
  })
})

describe('removeExerciseSlot', () => {
  it('removes existing slot', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()
    const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
    if (!added.success) throw new Error('setup failed')

    const result = await removeExerciseSlot(added.data.id)
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.exercise_slots).all()
    expect(rows).toHaveLength(0)
  })

  it('returns error for non-existent slot', async () => {
    const result = await removeExerciseSlot(999)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/slot/i)
  })

  it('rejects invalid ID', async () => {
    const result = await removeExerciseSlot(0)
    expect(result.success).toBe(false)
  })

  it('remaining slots keep their sort_order', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Incline Press')
    const ex3 = seedExercise('Flyes')

    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: 10 })
    const r2 = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: 10 })
    await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex3.id, sets: 3, reps: 10 })

    if (!r2.success) throw new Error('setup failed')
    await removeExerciseSlot(r2.data.id)

    const rows = testDb.select().from(schema.exercise_slots).all()
    expect(rows).toHaveLength(2)
    // Gaps are acceptable per spec
    expect(rows.map((r: { order: number }) => r.order).sort()).toEqual([1, 3])
  })

  it('removing last slot leaves empty container', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise()
    const added = await addExerciseSlot({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: 10 })
    if (!added.success) throw new Error('setup failed')

    await removeExerciseSlot(added.data.id)

    const rows = testDb.select().from(schema.exercise_slots).all()
    expect(rows).toHaveLength(0)
    // Template still exists
    const templates = testDb.select().from(schema.workout_templates).all()
    expect(templates).toHaveLength(1)
  })
})
