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

import { cascadeSlotParams } from './cascade-slot-params'

// Seed helpers
function seedMesocycle(
  overrides: Partial<{
    id: number
    name: string
    status: string
    start_date: string
    end_date: string
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

function getSlot(id: number) {
  return testDb
    .select()
    .from(schema.exercise_slots)
    .where(sql`id = ${id}`)
    .get()
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
      planned_duration INTEGER, estimated_duration INTEGER, display_order INTEGER NOT NULL DEFAULT 0,
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

describe('cascadeSlotParams', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('this-only scope', () => {
    it('updates only the source slot', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'this-only',
        updates: { sets: 4, reps: 10, weight: 85 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
        expect(result.data.skipped).toBe(0)
        expect(result.data.skippedCompleted).toBe(0)
      }

      const slot = getSlot(s1.id)
      expect(slot?.sets).toBe(4)
      expect(slot?.reps).toBe('10')
      expect(slot?.weight).toBe(85)
    })

    it('does not affect slots in sibling templates', async () => {
      const meso1 = seedMesocycle({ status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })
      const s2 = seedSlot(t2.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })

      await cascadeSlotParams({
        slotId: s1.id,
        scope: 'this-only',
        updates: { sets: 5 },
      })

      // s2 should be unchanged
      const slot2 = getSlot(s2.id)
      expect(slot2?.sets).toBe(3)
    })
  })

  describe('all-phases scope', () => {
    it('updates matching slots across all active/planned mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })
      const s2 = seedSlot(t2.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 4, weight: 85 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
        expect(result.data.skipped).toBe(0)
      }

      const slot1 = getSlot(s1.id)
      const slot2 = getSlot(s2.id)
      expect(slot1?.sets).toBe(4)
      expect(slot1?.weight).toBe(85)
      expect(slot2?.sets).toBe(4)
      expect(slot2?.weight).toBe(85)
    })

    it('matches slots by exercise_id fallback when order differs', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')

      // t1: [Bench @ 0, Squat @ 1]
      const s1Bench = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8' })
      seedSlot(t1.id, squat.id, 1, { sets: 3, reps: '5' })

      // t2 (reordered): [Squat @ 0, Bench @ 1]
      const s2Bench = seedSlot(t2.id, bench.id, 1, { sets: 3, reps: '8' })
      seedSlot(t2.id, squat.id, 0, { sets: 3, reps: '5' })

      const result = await cascadeSlotParams({
        slotId: s1Bench.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
      }

      // Bench in t2 should be updated via fallback match
      const slot2Bench = getSlot(s2Bench.id)
      expect(slot2Bench?.sets).toBe(5)
    })

    it('skips slots with no match in diverged templates', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const deadlift = seedExercise('Deadlift')

      // t1: [Bench, Squat]
      seedSlot(t1.id, bench.id, 0)
      const s1Squat = seedSlot(t1.id, squat.id, 1, { sets: 3 })

      // t2 diverged: [Bench, Deadlift] — no Squat
      seedSlot(t2.id, bench.id, 0)
      const s2Deadlift = seedSlot(t2.id, deadlift.id, 1, { sets: 3 })

      const result = await cascadeSlotParams({
        slotId: s1Squat.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // Only source slot updated, t2 skipped (no matching squat slot)
        expect(result.data.updated).toBe(1)
        expect(result.data.skipped).toBe(0) // not "skipped" — just no match in t2
      }

      // Deadlift slot unchanged
      const deadliftSlot = getSlot(s2Deadlift.id)
      expect(deadliftSlot?.sets).toBe(3)
    })
  })

  describe('this-and-future scope', () => {
    it('updates source + future sibling slots, not past', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', start_date: '2026-03-01', end_date: '2026-03-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })
      const s2 = seedSlot(t2.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })
      const s3 = seedSlot(t3.id, bench.id, 0, { sets: 3, reps: '8', weight: 80 })

      // Cascade from t2 — should update t2 + t3 but not t1
      const result = await cascadeSlotParams({
        slotId: s2.id,
        scope: 'this-and-future',
        updates: { reps: 12, weight: 90 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t2 + t3
      }

      expect(getSlot(s1.id)?.reps).toBe('8')  // unchanged
      expect(getSlot(s1.id)?.weight).toBe(80)   // unchanged
      expect(getSlot(s2.id)?.reps).toBe('12')
      expect(getSlot(s2.id)?.weight).toBe(90)
      expect(getSlot(s3.id)?.reps).toBe('12')
      expect(getSlot(s3.id)?.weight).toBe(90)
    })
  })

  describe('skipping logged templates', () => {
    it('skips slots in templates with logged workouts', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', start_date: '2026-03-01', end_date: '2026-03-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })
      const s2 = seedSlot(t2.id, bench.id, 0, { sets: 3 })
      const s3 = seedSlot(t3.id, bench.id, 0, { sets: 3 })

      // t2 has logged workout — should be skipped
      seedLoggedWorkout(t2.id)

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1 + t3
        expect(result.data.skipped).toBe(1) // t2
      }

      expect(getSlot(s1.id)?.sets).toBe(5)
      expect(getSlot(s2.id)?.sets).toBe(3) // unchanged
      expect(getSlot(s3.id)?.sets).toBe(5)
    })

    it('skips source template if it has logged workouts', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })

      seedLoggedWorkout(t1.id)

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'this-only',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(0)
        expect(result.data.skipped).toBe(1)
      }

      expect(getSlot(s1.id)?.sets).toBe(3) // unchanged
    })
  })

  describe('skipping completed mesocycles', () => {
    it('reports skippedCompleted count', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', start_date: '2026-02-01', end_date: '2026-02-28' })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', start_date: '2026-03-01', end_date: '2026-03-28' })
      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })
      seedSlot(t3.id, bench.id, 0, { sets: 3 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1 + t3
        expect(result.data.skippedCompleted).toBe(1)
      }
    })

    it('reports both skipped (logged) and skippedCompleted in mixed scenario', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', start_date: '2026-02-01', end_date: '2026-02-28' })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', start_date: '2026-03-01', end_date: '2026-03-28' })
      const meso4 = seedMesocycle({ name: 'Phase 4', status: 'planned', start_date: '2026-04-01', end_date: '2026-04-28' })
      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id) // completed — skippedCompleted
      const t3 = seedTemplate(meso3.id)
      const t4 = seedTemplate(meso4.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })
      const s3 = seedSlot(t3.id, bench.id, 0, { sets: 3 })
      seedSlot(t4.id, bench.id, 0, { sets: 3 })

      seedLoggedWorkout(t3.id) // logged — skipped

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1 + t4
        expect(result.data.skipped).toBe(1) // t3 (logged)
        expect(result.data.skippedCompleted).toBe(1) // meso2
      }

      expect(getSlot(s3.id)?.sets).toBe(3) // unchanged
    })
  })

  describe('multi-field updates', () => {
    it('cascades reps + weight together as a unit', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8', weight: 80, rpe: 7 })
      const s2 = seedSlot(t2.id, bench.id, 0, { sets: 3, reps: '8', weight: 80, rpe: 7 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { reps: 10, weight: 85 },
      })

      expect(result.success).toBe(true)
      const slot2 = getSlot(s2.id)
      expect(slot2?.reps).toBe('10')
      expect(slot2?.weight).toBe(85)
      // Unchanged fields stay the same
      expect(slot2?.sets).toBe(3)
      expect(slot2?.rpe).toBe(7)
    })

    it('cascades RPE and rest_seconds', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { rpe: 7, rest_seconds: 120 })
      const s2 = seedSlot(t2.id, bench.id, 0, { rpe: 7, rest_seconds: 120 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { rpe: 8.5, rest_seconds: 180 },
      })

      expect(result.success).toBe(true)
      const slot2 = getSlot(s2.id)
      expect(slot2?.rpe).toBe(8.5)
      expect(slot2?.rest_seconds).toBe(180)
    })

    it('cascades guidelines field', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { guidelines: 'Pause at bottom' })
      const s2 = seedSlot(t2.id, bench.id, 0, { guidelines: 'Pause at bottom' })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { guidelines: 'Slow eccentric 3s' },
      })

      expect(result.success).toBe(true)
      const slot2 = getSlot(s2.id)
      expect(slot2?.guidelines).toBe('Slow eccentric 3s')
    })

    it('supports clearing nullable fields with null', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { weight: 80, rpe: 7, guidelines: 'Some notes' })
      const s2 = seedSlot(t2.id, bench.id, 0, { weight: 80, rpe: 7, guidelines: 'Some notes' })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { weight: null, rpe: null, guidelines: null },
      })

      expect(result.success).toBe(true)
      const slot2 = getSlot(s2.id)
      expect(slot2?.weight).toBeNull()
      expect(slot2?.rpe).toBeNull()
      expect(slot2?.guidelines).toBeNull()
    })
  })

  describe('validation', () => {
    it('returns error when slot not found', async () => {
      const result = await cascadeSlotParams({
        slotId: 999,
        scope: 'this-only',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/not found/i)
      }
    })

    it('rejects empty updates', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0)

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'this-only',
        updates: {},
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/nothing to update/i)
      }
    })
  })

  describe('edge cases', () => {
    it('handles template with no slots in target (empty template)', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id) // t2 has no slots
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        // Source updated, t2 had no matching slot — just no match, not skipped
        expect(result.data.updated).toBe(1)
      }

      expect(getSlot(s1.id)?.sets).toBe(5)
    })

    it('handles no siblings — only updates source', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id, { canonical_name: 'unique-template' })
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
      }

      expect(getSlot(s1.id)?.sets).toBe(5)
    })

    it('diverged template: Bench cascades correctly, Squat skips Phase 2', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const bench = seedExercise('Bench Press')
      const squat = seedExercise('Squat')
      const ohp = seedExercise('OHP')
      const deadlift = seedExercise('Deadlift')

      // Phase 1: [Bench, Squat, OHP]
      const s1Bench = seedSlot(t1.id, bench.id, 0, { sets: 3, reps: '8' })
      const s1Squat = seedSlot(t1.id, squat.id, 1, { sets: 3, reps: '5' })
      seedSlot(t1.id, ohp.id, 2, { sets: 3, reps: '10' })

      // Phase 2 diverged: [Bench, Deadlift, OHP]
      const s2Bench = seedSlot(t2.id, bench.id, 0, { sets: 3, reps: '8' })
      const s2Deadlift = seedSlot(t2.id, deadlift.id, 1, { sets: 3, reps: '5' })
      seedSlot(t2.id, ohp.id, 2, { sets: 3, reps: '10' })

      // Cascade Bench edit — should propagate to Phase 2
      const benchResult = await cascadeSlotParams({
        slotId: s1Bench.id,
        scope: 'all-phases',
        updates: { sets: 5 },
      })
      expect(benchResult.success).toBe(true)
      if (benchResult.success) {
        expect(benchResult.data.updated).toBe(2)
      }
      expect(getSlot(s2Bench.id)?.sets).toBe(5)

      // Cascade Squat edit — should skip Phase 2 (no Squat)
      const squatResult = await cascadeSlotParams({
        slotId: s1Squat.id,
        scope: 'all-phases',
        updates: { sets: 4 },
      })
      expect(squatResult.success).toBe(true)
      if (squatResult.success) {
        expect(squatResult.data.updated).toBe(1) // only source
      }
      expect(getSlot(s2Deadlift.id)?.sets).toBe(3) // unchanged
    })

    it('handles multiple templates across 3+ mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'P1', status: 'active', start_date: '2026-01-01', end_date: '2026-01-28' })
      const meso2 = seedMesocycle({ name: 'P2', status: 'planned', start_date: '2026-02-01', end_date: '2026-02-28' })
      const meso3 = seedMesocycle({ name: 'P3', status: 'planned', start_date: '2026-03-01', end_date: '2026-03-28' })
      const meso4 = seedMesocycle({ name: 'P4', status: 'planned', start_date: '2026-04-01', end_date: '2026-04-28' })
      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)
      const t4 = seedTemplate(meso4.id)
      const bench = seedExercise('Bench Press')
      const s1 = seedSlot(t1.id, bench.id, 0, { sets: 3 })
      const s2 = seedSlot(t2.id, bench.id, 0, { sets: 3 })
      const s3 = seedSlot(t3.id, bench.id, 0, { sets: 3 })
      const s4 = seedSlot(t4.id, bench.id, 0, { sets: 3 })

      const result = await cascadeSlotParams({
        slotId: s1.id,
        scope: 'all-phases',
        updates: { sets: 6 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(4)
      }

      expect(getSlot(s1.id)?.sets).toBe(6)
      expect(getSlot(s2.id)?.sets).toBe(6)
      expect(getSlot(s3.id)?.sets).toBe(6)
      expect(getSlot(s4.id)?.sets).toBe(6)
    })
  })
})
