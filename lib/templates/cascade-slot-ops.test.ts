import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql, eq, asc } from 'drizzle-orm'
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

import { cascadeAddSlot, cascadeRemoveSlot } from './cascade-slot-ops'

// Seed helpers
function seedMesocycle(
  overrides: Partial<{
    id: number
    name: string
    status: string
    created_at: Date
  }> = {}
) {
  const defaults = {
    name: 'Test Meso',
    start_date: '2026-03-01',
    end_date: '2026-03-28',
    work_weeks: 4,
    has_deload: 0,
    status: 'planned',
  }
  const row = { ...defaults, ...overrides }
  return testDb
    .insert(schema.mesocycles)
    .values(row)
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(
  mesocycleId: number,
  overrides: Partial<{
    name: string
    canonical_name: string
    modality: string
  }> = {}
) {
  const defaults = {
    mesocycle_id: mesocycleId,
    name: 'Push A',
    canonical_name: 'push-a',
    modality: 'resistance',
  }
  const row = { ...defaults, ...overrides }
  return testDb
    .insert(schema.workout_templates)
    .values(row)
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedExercise(name: string) {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance' })
    .returning({ id: schema.exercises.id })
    .get()
}

function seedSlot(
  templateId: number,
  exerciseId: number,
  order: number,
  overrides: Partial<{
    sets: number
    reps: string
    weight: number | null
    rpe: number | null
    rest_seconds: number | null
    guidelines: string | null
  }> = {}
) {
  const defaults = {
    template_id: templateId,
    exercise_id: exerciseId,
    order,
    sets: 3,
    reps: '10',
    weight: null as number | null,
    rpe: null as number | null,
    rest_seconds: null as number | null,
    guidelines: null as string | null,
    is_main: false,
  }
  const row = { ...defaults, ...overrides }
  return testDb
    .insert(schema.exercise_slots)
    .values(row)
    .returning({ id: schema.exercise_slots.id })
    .get()
}

function seedLoggedWorkout(templateId: number) {
  return testDb
    .insert(schema.logged_workouts)
    .values({
      template_id: templateId,
      canonical_name: 'push-a',
      log_date: '2026-03-15',
      logged_at: new Date(),
      template_snapshot: { version: 1 },
    })
    .returning({ id: schema.logged_workouts.id })
    .get()
}

type SlotRow = typeof schema.exercise_slots.$inferSelect

function getSlots(templateId: number): SlotRow[] {
  return testDb
    .select()
    .from(schema.exercise_slots)
    .where(eq(schema.exercise_slots.template_id, templateId))
    .orderBy(asc(schema.exercise_slots.order))
    .all()
}

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
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

describe('cascadeAddSlot', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('basic cascade', () => {
    it('adds the same slot to sibling templates (all-phases)', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      // Both templates start with Bench at order 1
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t2.id, bench.id, 1)

      // Add OHP to t1 at order 2
      const newSlot = seedSlot(t1.id, ohp.id, 2, { sets: 4, reps: '8', weight: 40, rpe: 7, rest_seconds: 90 })

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // t2 got the new slot
        expect(result.data.skipped).toBe(0)
      }

      // Verify t2 now has OHP at order 2
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(2)
      const addedSlot = t2Slots.find(s => s.exercise_id === ohp.id)
      expect(addedSlot).toBeDefined()
      expect(addedSlot?.order).toBe(2)
      expect(addedSlot?.sets).toBe(4)
      expect(addedSlot?.reps).toBe('8')
      expect(addedSlot?.weight).toBe(40)
      expect(addedSlot?.rpe).toBe(7)
      expect(addedSlot?.rest_seconds).toBe(90)
    })

    it('adds slot to this-and-future siblings only', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t3.id, bench.id, 1)

      // Add OHP to t2
      const newSlot = seedSlot(t2.id, ohp.id, 2, { sets: 3, reps: '10' })

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'this-and-future',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // only t3
      }

      // t1 should NOT get the slot (it's in the past)
      const t1Slots = getSlots(t1.id)
      expect(t1Slots).toHaveLength(1)

      // t3 SHOULD get the slot
      const t3Slots = getSlots(t3.id)
      expect(t3Slots).toHaveLength(2)
      expect(t3Slots.some(s => s.exercise_id === ohp.id)).toBe(true)
    })
  })

  describe('order conflict handling', () => {
    it('appends at end when target already has a slot at that order position', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const ohp = seedExercise('OHP')

      // t1: [Bench@1, OHP@2] (OHP just added at order 2)
      seedSlot(t1.id, bench.id, 1)
      const newSlot = seedSlot(t1.id, ohp.id, 2, { sets: 3, reps: '10' })

      // t2: [Bench@1, Squat@2] — already has order 2 occupied
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, squat.id, 2)

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
      }

      // OHP should be appended at order 3 in t2
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(3)
      const addedOhp = t2Slots.find(s => s.exercise_id === ohp.id)
      expect(addedOhp).toBeDefined()
      expect(addedOhp?.order).toBe(3)
    })
  })

  describe('diverged template structure', () => {
    it('appends when target has different slot structure', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const deadlift = seedExercise('Deadlift')
      const ohp = seedExercise('OHP')

      // t1: [Bench@1, Squat@2, OHP@3] — OHP just added
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, squat.id, 2)
      const newSlot = seedSlot(t1.id, ohp.id, 3, { sets: 3, reps: '10' })

      // t2 diverged: [Bench@1, Deadlift@2] — different structure
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, deadlift.id, 2)

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
      }

      // OHP should be appended at end (order 3)
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(3)
      const addedOhp = t2Slots.find(s => s.exercise_id === ohp.id)
      expect(addedOhp).toBeDefined()
      expect(addedOhp?.order).toBe(3)
    })
  })

  describe('skipping', () => {
    it('skips templates with logged workouts', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t3.id, bench.id, 1)

      // t2 has logged workouts
      seedLoggedWorkout(t2.id)

      const newSlot = seedSlot(t1.id, ohp.id, 2, { sets: 3, reps: '10' })

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // only t3
        expect(result.data.skipped).toBe(1) // t2 skipped (logged)
      }

      // t2 should still have only 1 slot
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(1)

      // t3 should have the new slot
      const t3Slots = getSlots(t3.id)
      expect(t3Slots).toHaveLength(2)
    })

    it('skips completed mesocycles and reports count', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id) // completed meso
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t3.id, bench.id, 1)

      const newSlot = seedSlot(t1.id, ohp.id, 2, { sets: 3, reps: '10' })

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // t3
        expect(result.data.skippedCompleted).toBe(1)
      }
    })
  })

  describe('validation', () => {
    it('returns error when source slot not found', async () => {
      const result = await cascadeAddSlot({
        sourceSlotId: 999,
        scope: 'all-phases',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/not found/i)
      }
    })
  })

  describe('this-only scope', () => {
    it('does not cascade — returns 0 updated', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t2.id, bench.id, 1)

      const newSlot = seedSlot(t1.id, ohp.id, 2, { sets: 3, reps: '10' })

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'this-only',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // this-only means the slot was already added to the source template,
        // so cascade should report 0 sibling updates
        expect(result.data.updated).toBe(0)
        expect(result.data.skipped).toBe(0)
      }

      // t2 should not have OHP
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(1)
    })
  })

  describe('slot parameters are copied', () => {
    it('copies all slot parameters including guidelines', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t2.id, bench.id, 1)

      const newSlot = seedSlot(t1.id, ohp.id, 2, {
        sets: 4,
        reps: '8',
        weight: 50,
        rpe: 8,
        rest_seconds: 120,
        guidelines: 'Slow eccentric 3s',
      })

      const result = await cascadeAddSlot({
        sourceSlotId: newSlot.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)

      const t2Slots = getSlots(t2.id)
      const addedSlot = t2Slots.find(s => s.exercise_id === ohp.id)
      expect(addedSlot).toBeDefined()
      expect(addedSlot?.sets).toBe(4)
      expect(addedSlot?.reps).toBe('8')
      expect(addedSlot?.weight).toBe(50)
      expect(addedSlot?.rpe).toBe(8)
      expect(addedSlot?.rest_seconds).toBe(120)
      expect(addedSlot?.guidelines).toBe('Slow eccentric 3s')
    })
  })
})

describe('cascadeRemoveSlot', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('basic cascade', () => {
    it('removes matching slot from sibling templates (all-phases)', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      // Both templates: [Bench@1, OHP@2]
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, ohp.id, 2)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, ohp.id, 2)

      // Remove Bench from sibling (t2), using source slot from t1
      const result = await cascadeRemoveSlot({
        sourceExerciseId: bench.id,
        sourceOrder: 1,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // t2 had its Bench removed
        expect(result.data.skipped).toBe(0)
      }

      // t2 should only have OHP left, re-ordered to 1
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(1)
      expect(t2Slots[0].exercise_id).toBe(ohp.id)
      expect(t2Slots[0].order).toBe(1)
    })

    it('removes slot from this-and-future siblings only', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      // All templates: [Bench@1, OHP@2]
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, ohp.id, 2)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, ohp.id, 2)
      seedSlot(t3.id, bench.id, 1)
      seedSlot(t3.id, ohp.id, 2)

      // Remove Bench from siblings starting at t2
      const result = await cascadeRemoveSlot({
        sourceExerciseId: bench.id,
        sourceOrder: 1,
        templateId: t2.id,
        scope: 'this-and-future',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // only t3
      }

      // t1 should be untouched (in the past)
      const t1Slots = getSlots(t1.id)
      expect(t1Slots).toHaveLength(2)

      // t3 should have Bench removed
      const t3Slots = getSlots(t3.id)
      expect(t3Slots).toHaveLength(1)
      expect(t3Slots[0].exercise_id).toBe(ohp.id)
    })
  })

  describe('re-ordering after removal', () => {
    it('re-orders remaining slots to fill gaps', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const ohp = seedExercise('OHP')

      // Both templates: [Bench@1, Squat@2, OHP@3]
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, squat.id, 2)
      seedSlot(t1.id, ohp.id, 3)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, squat.id, 2)
      seedSlot(t2.id, ohp.id, 3)

      // Remove Squat (middle) from siblings
      const result = await cascadeRemoveSlot({
        sourceExerciseId: squat.id,
        sourceOrder: 2,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)

      // t2: Bench@1, OHP@2 (re-ordered from 3 to 2)
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(2)
      expect(t2Slots[0].exercise_id).toBe(bench.id)
      expect(t2Slots[0].order).toBe(1)
      expect(t2Slots[1].exercise_id).toBe(ohp.id)
      expect(t2Slots[1].order).toBe(2)
    })
  })

  describe('diverged template handling', () => {
    it('skips target when no matching slot (diverged)', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const deadlift = seedExercise('Deadlift')

      // t1: [Bench@1, Squat@2]
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, squat.id, 2)

      // t2 diverged: [Bench@1, Deadlift@2] — no Squat
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, deadlift.id, 2)

      // Remove Squat from siblings — t2 should be skipped
      const result = await cascadeRemoveSlot({
        sourceExerciseId: squat.id,
        sourceOrder: 2,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(0)
        expect(result.data.skipped).toBe(0)
        expect(result.data.skippedNoMatch).toBe(1) // t2 diverged, no matching slot
      }

      // t2 should be untouched
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(2)
    })

    it('matches by exercise_id fallback when order differs', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const ohp = seedExercise('OHP')

      // t1: [Bench@1, Squat@2]
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, squat.id, 2)

      // t2 reordered: [Squat@1, Bench@2, OHP@3]
      seedSlot(t2.id, squat.id, 1)
      seedSlot(t2.id, bench.id, 2)
      seedSlot(t2.id, ohp.id, 3)

      // Remove Squat (order 2 in t1), should match Squat in t2 via fallback
      const result = await cascadeRemoveSlot({
        sourceExerciseId: squat.id,
        sourceOrder: 2,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // t2 removed via fallback
      }

      // t2: [Bench@1, OHP@2] — re-ordered
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(2)
      expect(t2Slots[0].exercise_id).toBe(bench.id)
      expect(t2Slots[0].order).toBe(1)
      expect(t2Slots[1].exercise_id).toBe(ohp.id)
      expect(t2Slots[1].order).toBe(2)
    })
  })

  describe('skipping', () => {
    it('skips templates with logged workouts', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      // All templates: [Bench@1, OHP@2]
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, ohp.id, 2)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, ohp.id, 2)
      seedSlot(t3.id, bench.id, 1)
      seedSlot(t3.id, ohp.id, 2)

      // t2 has logged workouts
      seedLoggedWorkout(t2.id)

      const result = await cascadeRemoveSlot({
        sourceExerciseId: bench.id,
        sourceOrder: 1,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // only t3
        expect(result.data.skipped).toBe(1) // t2 (logged)
      }

      // t2 untouched
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(2)

      // t3 had Bench removed
      const t3Slots = getSlots(t3.id)
      expect(t3Slots).toHaveLength(1)
      expect(t3Slots[0].exercise_id).toBe(ohp.id)
    })

    it('skips completed mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id) // completed
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, ohp.id, 2)
      seedSlot(t3.id, bench.id, 1)
      seedSlot(t3.id, ohp.id, 2)

      const result = await cascadeRemoveSlot({
        sourceExerciseId: bench.id,
        sourceOrder: 1,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1) // t3
        expect(result.data.skippedCompleted).toBe(1)
      }
    })
  })

  describe('edge cases', () => {
    it('removing the last slot in a template via cascade is allowed', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')

      // Both templates: [Bench@1] only
      seedSlot(t1.id, bench.id, 1)
      seedSlot(t2.id, bench.id, 1)

      const result = await cascadeRemoveSlot({
        sourceExerciseId: bench.id,
        sourceOrder: 1,
        templateId: t1.id,
        scope: 'all-phases',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
      }

      // t2 is now empty
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(0)
    })

    it('returns error when template not found', async () => {
      const result = await cascadeRemoveSlot({
        sourceExerciseId: 1,
        sourceOrder: 1,
        templateId: 999,
        scope: 'all-phases',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/not found/i)
      }
    })
  })

  describe('this-only scope', () => {
    it('does not cascade — returns 0 updated', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const ohp = seedExercise('OHP')

      seedSlot(t1.id, bench.id, 1)
      seedSlot(t1.id, ohp.id, 2)
      seedSlot(t2.id, bench.id, 1)
      seedSlot(t2.id, ohp.id, 2)

      const result = await cascadeRemoveSlot({
        sourceExerciseId: bench.id,
        sourceOrder: 1,
        templateId: t1.id,
        scope: 'this-only',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(0)
        expect(result.data.skipped).toBe(0)
      }

      // t2 should be untouched
      const t2Slots = getSlots(t2.id)
      expect(t2Slots).toHaveLength(2)
    })
  })
})
