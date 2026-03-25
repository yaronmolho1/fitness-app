import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql, eq, asc } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

type SlotRow = typeof schema.exercise_slots.$inferSelect

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

import { createSuperset, breakSuperset, updateGroupRest } from './superset-actions'

function seedMesocycle(
  overrides: Partial<{ id: number; name: string; status: string }> = {}
) {
  const defaults = {
    name: 'Test Meso',
    start_date: '2026-03-01',
    end_date: '2026-03-28',
    work_weeks: 4,
    has_deload: false,
    status: 'planned',
  }
  const row = { ...defaults, ...overrides }
  return testDb
    .insert(schema.mesocycles)
    .values(row)
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

function seedSlot(
  templateId: number,
  exerciseId: number,
  order: number,
  overrides: Partial<{ group_id: number; group_rest_seconds: number }> = {}
) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      sets: 3,
      reps: '10',
      order,
      is_main: false,
      created_at: new Date(),
      ...overrides,
    })
    .returning()
    .get()
}

function getSlots(templateId: number) {
  return testDb
    .select()
    .from(schema.exercise_slots)
    .where(eq(schema.exercise_slots.template_id, templateId))
    .orderBy(asc(schema.exercise_slots.order))
    .all()
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
      rest_seconds INTEGER,
      duration INTEGER,
      group_id INTEGER,
      group_rest_seconds INTEGER,
      guidelines TEXT,
      "order" INTEGER NOT NULL,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
})

// ============================================================================
// createSuperset
// ============================================================================

describe('createSuperset', () => {
  describe('validation', () => {
    it('rejects fewer than 2 slot IDs', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex = seedExercise()
      const s1 = seedSlot(tmpl.id, ex.id, 1)

      const result = await createSuperset({ slot_ids: [s1.id], group_rest_seconds: 60 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/2/)
    })

    it('rejects empty slot IDs', async () => {
      const result = await createSuperset({ slot_ids: [], group_rest_seconds: 60 })
      expect(result.success).toBe(false)
    })

    it('rejects non-existent slot IDs', async () => {
      const result = await createSuperset({ slot_ids: [999, 1000], group_rest_seconds: 60 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/not found/i)
    })

    it('rejects slots from different templates', async () => {
      const meso = seedMesocycle()
      const tmpl1 = seedTemplate(meso.id)
      // Second template needs different canonical_name
      const tmpl2 = testDb
        .insert(schema.workout_templates)
        .values({
          mesocycle_id: meso.id,
          name: 'Pull A',
          canonical_name: 'pull-a',
          modality: 'resistance',
          created_at: new Date(),
        })
        .returning({ id: schema.workout_templates.id })
        .get()

      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Row')

      const s1 = seedSlot(tmpl1.id, ex1.id, 1)
      const s2 = seedSlot(tmpl2.id, ex2.id, 1)

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/same template/i)
    })

    it('rejects non-contiguous slots', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')
      const ex3 = seedExercise('Flyes')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      seedSlot(tmpl.id, ex2.id, 2) // gap
      const s3 = seedSlot(tmpl.id, ex3.id, 3)

      const result = await createSuperset({ slot_ids: [s1.id, s3.id], group_rest_seconds: 60 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/contiguous/i)
    })

    it('rejects slots already in a group', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1, { group_id: 1, group_rest_seconds: 60 })
      const s2 = seedSlot(tmpl.id, ex2.id, 2, { group_id: 1, group_rest_seconds: 60 })

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 90 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/already.*group/i)
    })

    it('rejects negative group_rest_seconds', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: -10 })
      expect(result.success).toBe(false)
    })

    it('rejects on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      // Flip to completed
      testDb
        .update(schema.mesocycles)
        .set({ status: 'completed' })
        .where(eq(schema.mesocycles.id, meso.id))
        .run()

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })
  })

  describe('happy path', () => {
    it('groups 2 contiguous slots into a superset', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 90 })
      expect(result.success).toBe(true)

      const slots = getSlots(tmpl.id)
      // Both should share same group_id
      expect(slots[0].group_id).not.toBeNull()
      expect(slots[0].group_id).toBe(slots[1].group_id)
      expect(slots[0].group_rest_seconds).toBe(90)
      expect(slots[1].group_rest_seconds).toBe(90)
    })

    it('groups 3 contiguous slots (tri-set)', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')
      const ex3 = seedExercise('Flyes')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)
      const s3 = seedSlot(tmpl.id, ex3.id, 3)

      const result = await createSuperset({
        slot_ids: [s1.id, s2.id, s3.id],
        group_rest_seconds: 120,
      })
      expect(result.success).toBe(true)

      const slots = getSlots(tmpl.id)
      const groupId = slots[0].group_id
      expect(groupId).not.toBeNull()
      expect(slots.every((s: SlotRow) => s.group_id === groupId)).toBe(true)
      expect(slots.every((s: SlotRow) => s.group_rest_seconds === 120)).toBe(true)
    })

    it('allows group_rest_seconds = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 0 })
      expect(result.success).toBe(true)

      const slots = getSlots(tmpl.id)
      expect(slots[0].group_rest_seconds).toBe(0)
    })

    it('assigns unique group_id for multiple supersets in same template', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')
      const ex3 = seedExercise('Flyes')
      const ex4 = seedExercise('Cable Crossover')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)
      const s3 = seedSlot(tmpl.id, ex3.id, 3)
      const s4 = seedSlot(tmpl.id, ex4.id, 4)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      await createSuperset({ slot_ids: [s3.id, s4.id], group_rest_seconds: 90 })

      const slots = getSlots(tmpl.id)
      expect(slots[0].group_id).not.toBe(slots[2].group_id)
    })

    it('works on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      const result = await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================================
// breakSuperset
// ============================================================================

describe('breakSuperset', () => {
  describe('validation', () => {
    it('rejects non-existent group_id', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)

      const result = await breakSuperset({ group_id: 999, template_id: tmpl.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/not found|no slots/i)
    })

    it('rejects on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slots = getSlots(tmpl.id)
      const groupId = slots[0].group_id!

      // Flip to completed
      testDb
        .update(schema.mesocycles)
        .set({ status: 'completed' })
        .where(eq(schema.mesocycles.id, meso.id))
        .run()

      const result = await breakSuperset({ group_id: groupId, template_id: tmpl.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })
  })

  describe('happy path', () => {
    it('nulls group_id and group_rest_seconds on all members', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slotsAfterCreate = getSlots(tmpl.id)
      const groupId = slotsAfterCreate[0].group_id!

      const result = await breakSuperset({ group_id: groupId, template_id: tmpl.id })
      expect(result.success).toBe(true)

      const slots = getSlots(tmpl.id)
      expect(slots[0].group_id).toBeNull()
      expect(slots[0].group_rest_seconds).toBeNull()
      expect(slots[1].group_id).toBeNull()
      expect(slots[1].group_rest_seconds).toBeNull()
    })

    it('preserves rest_seconds on individual slots', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      // Set individual rest
      testDb
        .update(schema.exercise_slots)
        .set({ rest_seconds: 90 })
        .where(eq(schema.exercise_slots.id, s1.id))
        .run()
      testDb
        .update(schema.exercise_slots)
        .set({ rest_seconds: 120 })
        .where(eq(schema.exercise_slots.id, s2.id))
        .run()

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slotsAfterCreate = getSlots(tmpl.id)
      const groupId = slotsAfterCreate[0].group_id!

      await breakSuperset({ group_id: groupId, template_id: tmpl.id })

      const slots = getSlots(tmpl.id)
      expect(slots[0].rest_seconds).toBe(90)
      expect(slots[1].rest_seconds).toBe(120)
    })

    it('does not affect other supersets in same template', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')
      const ex3 = seedExercise('Flyes')
      const ex4 = seedExercise('Cable Crossover')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)
      const s3 = seedSlot(tmpl.id, ex3.id, 3)
      const s4 = seedSlot(tmpl.id, ex4.id, 4)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      await createSuperset({ slot_ids: [s3.id, s4.id], group_rest_seconds: 90 })

      const slotsAfterCreate = getSlots(tmpl.id)
      const group1 = slotsAfterCreate[0].group_id!
      const group2 = slotsAfterCreate[2].group_id!

      await breakSuperset({ group_id: group1, template_id: tmpl.id })

      const slots = getSlots(tmpl.id)
      // Group 1 broken
      expect(slots[0].group_id).toBeNull()
      expect(slots[1].group_id).toBeNull()
      // Group 2 intact
      expect(slots[2].group_id).toBe(group2)
      expect(slots[3].group_id).toBe(group2)
      expect(slots[2].group_rest_seconds).toBe(90)
    })
  })
})

// ============================================================================
// updateGroupRest
// ============================================================================

describe('updateGroupRest', () => {
  describe('validation', () => {
    it('rejects non-existent group', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)

      const result = await updateGroupRest({
        group_id: 999,
        template_id: tmpl.id,
        group_rest_seconds: 120,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/not found|no slots/i)
    })

    it('rejects negative group_rest_seconds', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slots = getSlots(tmpl.id)
      const groupId = slots[0].group_id!

      const result = await updateGroupRest({
        group_id: groupId,
        template_id: tmpl.id,
        group_rest_seconds: -10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slots = getSlots(tmpl.id)
      const groupId = slots[0].group_id!

      testDb
        .update(schema.mesocycles)
        .set({ status: 'completed' })
        .where(eq(schema.mesocycles.id, meso.id))
        .run()

      const result = await updateGroupRest({
        group_id: groupId,
        template_id: tmpl.id,
        group_rest_seconds: 120,
      })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })
  })

  describe('happy path', () => {
    it('updates group_rest_seconds on all member slots', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slots = getSlots(tmpl.id)
      const groupId = slots[0].group_id!

      const result = await updateGroupRest({
        group_id: groupId,
        template_id: tmpl.id,
        group_rest_seconds: 120,
      })
      expect(result.success).toBe(true)

      const updated = getSlots(tmpl.id)
      expect(updated[0].group_rest_seconds).toBe(120)
      expect(updated[1].group_rest_seconds).toBe(120)
    })

    it('allows group_rest_seconds = 0', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      const slots = getSlots(tmpl.id)
      const groupId = slots[0].group_id!

      const result = await updateGroupRest({
        group_id: groupId,
        template_id: tmpl.id,
        group_rest_seconds: 0,
      })
      expect(result.success).toBe(true)

      const updated = getSlots(tmpl.id)
      expect(updated[0].group_rest_seconds).toBe(0)
    })

    it('does not affect other supersets', async () => {
      const meso = seedMesocycle()
      const tmpl = seedTemplate(meso.id)
      const ex1 = seedExercise('Bench Press')
      const ex2 = seedExercise('Incline Press')
      const ex3 = seedExercise('Flyes')
      const ex4 = seedExercise('Cable Crossover')

      const s1 = seedSlot(tmpl.id, ex1.id, 1)
      const s2 = seedSlot(tmpl.id, ex2.id, 2)
      const s3 = seedSlot(tmpl.id, ex3.id, 3)
      const s4 = seedSlot(tmpl.id, ex4.id, 4)

      await createSuperset({ slot_ids: [s1.id, s2.id], group_rest_seconds: 60 })
      await createSuperset({ slot_ids: [s3.id, s4.id], group_rest_seconds: 90 })

      const slots = getSlots(tmpl.id)
      const group1 = slots[0].group_id!

      await updateGroupRest({
        group_id: group1,
        template_id: tmpl.id,
        group_rest_seconds: 180,
      })

      const updated = getSlots(tmpl.id)
      expect(updated[0].group_rest_seconds).toBe(180)
      expect(updated[1].group_rest_seconds).toBe(180)
      expect(updated[2].group_rest_seconds).toBe(90) // unchanged
      expect(updated[3].group_rest_seconds).toBe(90) // unchanged
    })
  })
})
