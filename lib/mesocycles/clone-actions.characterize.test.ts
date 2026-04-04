// Characterization test — captures current behavior for safe refactoring (T208 sync hooks, T224 rotation clone, T222 slot value inheritance)
// Focuses on return shapes, revalidation timing, absence of side effects beyond DB + cache,
// and exact weekly_schedule rotation field handling before T224 modifies clone logic
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

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { cloneMesocycle } from './clone-actions'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)

  testDb.run(sql`CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT, equipment TEXT, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
    notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL, section_name TEXT NOT NULL, "order" INTEGER NOT NULL,
    run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
    rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
    guidelines TEXT, "order" INTEGER NOT NULL, is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER REFERENCES workout_templates(id),
    week_type TEXT NOT NULL DEFAULT 'normal',
    period TEXT NOT NULL DEFAULT 'morning',
    time_slot TEXT NOT NULL DEFAULT '07:00',
    duration INTEGER NOT NULL DEFAULT 90,
    cycle_length INTEGER NOT NULL DEFAULT 1,
    cycle_position INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER
  )`)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
  )
}

function seedSource() {
  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Source Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'active',
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  const tmpl = testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: meso.id,
      name: 'Push A',
      canonical_name: 'push-a',
      modality: 'resistance',
    })
    .returning({ id: schema.workout_templates.id })
    .get()

  testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      week_type: 'normal',
      period: 'morning',
      time_slot: '07:00',
      duration: 90,
    })
    .run()

  return { mesoId: meso.id, tmplId: tmpl.id }
}

// Seeds a mesocycle whose Monday 07:00 slot has a 3-cycle rotation (positions 1, 2, 3)
function seedSourceWithRotation() {
  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Rotation Source',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'active',
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  const tmplA = testDb
    .insert(schema.workout_templates)
    .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
    .returning({ id: schema.workout_templates.id })
    .get()
  const tmplB = testDb
    .insert(schema.workout_templates)
    .values({ mesocycle_id: meso.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance' })
    .returning({ id: schema.workout_templates.id })
    .get()
  const tmplC = testDb
    .insert(schema.workout_templates)
    .values({ mesocycle_id: meso.id, name: 'Push C', canonical_name: 'push-c', modality: 'resistance' })
    .returning({ id: schema.workout_templates.id })
    .get()

  // Three rotation positions on the same slot (day 0, 07:00, normal)
  for (const [pos, tmplId] of [[1, tmplA.id], [2, tmplB.id], [3, tmplC.id]] as [number, number][]) {
    testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmplId,
        week_type: 'normal',
        period: 'morning',
        time_slot: '07:00',
        duration: 90,
        cycle_length: 3,
        cycle_position: pos,
      })
      .run()
  }

  return { mesoId: meso.id, tmplIds: [tmplA.id, tmplB.id, tmplC.id] }
}

// Seeds a mesocycle with cycle_length=3 but only position 1 (partial rotation data)
function seedSourceWithCycleLengthOnly() {
  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'CycleLen Source',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'active',
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  const tmpl = testDb
    .insert(schema.workout_templates)
    .values({ mesocycle_id: meso.id, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' })
    .returning({ id: schema.workout_templates.id })
    .get()

  testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: tmpl.id,
      week_type: 'normal',
      period: 'morning',
      time_slot: '07:00',
      duration: 90,
      cycle_length: 3,
      cycle_position: 1,
    })
    .run()

  return { mesoId: meso.id, tmplId: tmpl.id }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetTables()
})

describe('cloneMesocycle — characterize for T208', () => {
  describe('return shape on success', () => {
    it('returns { success: true, id: number }', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.id).toBe('number')
        expect(result.id).toBeGreaterThan(mesoId)
        expect(Object.keys(result).sort()).toEqual(['id', 'success'])
      }
    })
  })

  describe('return shape on failure', () => {
    it('returns { success: false, error: string } for empty name', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: '   ',
        start_date: '2026-04-01',
      })
      expect(result).toEqual({ success: false, error: 'Name is required' })
    })

    it('returns { success: false, error: string } for invalid date', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: 'not-a-date',
      })
      expect(result).toEqual({
        success: false,
        error: 'Valid start date (YYYY-MM-DD) is required',
      })
    })

    it('returns { success: false, error: string } for non-existent source', async () => {
      const result = await cloneMesocycle({
        source_id: 999,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(result).toEqual({ success: false, error: 'Source mesocycle not found' })
    })

    it('returns { success: false, error: string } for source with no templates', async () => {
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Empty',
          start_date: '2026-03-01',
          end_date: '2026-03-28',
          work_weeks: 4,
          has_deload: false,
          status: 'planned',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(result).toEqual({
        success: false,
        error: 'Cannot clone a mesocycle with no templates',
      })
    })
  })

  describe('revalidation behavior', () => {
    it('calls revalidatePath("/mesocycles") on success', async () => {
      const { mesoId } = seedSource()
      await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/mesocycles')
      expect(mockRevalidatePath).toHaveBeenCalledTimes(1)
    })

    it('does NOT call revalidatePath on validation failure', async () => {
      await cloneMesocycle({
        source_id: 999,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(mockRevalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('cloned mesocycle properties', () => {
    it('creates mesocycle with status "planned" regardless of source status', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('setup failed')

      const cloned = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === result.id)
      expect(cloned!.status).toBe('planned')
    })

    it('uses provided work_weeks override', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
        work_weeks: 6,
      })
      if (!result.success) throw new Error('setup failed')

      const cloned = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === result.id)
      expect(cloned!.work_weeks).toBe(6)
    })

    it('clones schedule rows with remapped template IDs', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('setup failed')

      const schedRows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(schedRows).toHaveLength(1)
      // Template ID should be different from source
      const sourceSched = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === mesoId)
      expect(schedRows[0].template_id).not.toBe(sourceSched[0].template_id)
    })
  })

  describe('no external side effects', () => {
    it('does not modify source mesocycle', async () => {
      const { mesoId } = seedSource()
      const sourceBefore = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === mesoId)

      await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      const sourceAfter = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === mesoId)
      expect(sourceAfter).toEqual(sourceBefore)
    })
  })
})

describe('cloneMesocycle — characterize for T224 (rotation fields)', () => {
  // Captures CURRENT behavior before rotation-aware clone logic is introduced.
  // These tests document what happens to cycle_length / cycle_position during clone.
  // T224 will change this behavior — update these tests after the refactor.

  describe('non-rotation schedule row (cycle_length=1, cycle_position=1)', () => {
    it('cloned row has cycle_length=1', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('unexpected failure')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(rows).toHaveLength(1)
      // cycle_length is not written by clone — falls back to column default
      expect(rows[0].cycle_length).toBe(1)
    })

    it('cloned row has cycle_position=1', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('unexpected failure')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(rows[0].cycle_position).toBe(1)
    })
  })

  describe('single-row with cycle_length=3 (rotation declared but only one position seeded)', () => {
    it('clone succeeds', async () => {
      const { mesoId } = seedSourceWithCycleLengthOnly()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(result.success).toBe(true)
    })

    it('cloned row preserves cycle_length=3 from source (T224 fix)', async () => {
      const { mesoId } = seedSourceWithCycleLengthOnly()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('unexpected failure')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(rows).toHaveLength(1)
      // T224: cycle_length now preserved from source
      expect(rows[0].cycle_length).toBe(3)
    })

    it('cloned row has cycle_position=1', async () => {
      const { mesoId } = seedSourceWithCycleLengthOnly()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('unexpected failure')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(rows[0].cycle_position).toBe(1)
    })
  })

  describe('full rotation (cycle_length=3, positions 1/2/3 on same slot)', () => {
    it('clone succeeds with all rotation positions preserved (T224 fix)', async () => {
      // T224: cycle_position now preserved, so unique index is not violated
      const { mesoId } = seedSourceWithRotation()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('clone failed')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(rows).toHaveLength(3)
      expect(rows.map((r: { cycle_position: number }) => r.cycle_position).sort()).toEqual([1, 2, 3])
      expect(rows.every((r: { cycle_length: number }) => r.cycle_length === 3)).toBe(true)
    })

    it('source mesocycle is unchanged after clone', async () => {
      const { mesoId } = seedSourceWithRotation()
      const sourceBefore = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === mesoId)

      await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      const sourceAfter = testDb
        .select()
        .from(schema.mesocycles)
        .all()
        .find((m: { id: number }) => m.id === mesoId)
      expect(sourceAfter).toEqual(sourceBefore)
    })
  })

  describe('template ID remapping with rotation rows', () => {
    it('cloned single-position rotation row points to new template, not source template', async () => {
      const { mesoId, tmplId: srcTmplId } = seedSourceWithCycleLengthOnly()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('unexpected failure')

      const rows = testDb
        .select()
        .from(schema.weekly_schedule)
        .all()
        .filter((r: { mesocycle_id: number }) => r.mesocycle_id === result.id)
      expect(rows[0].template_id).not.toBe(srcTmplId)
      expect(typeof rows[0].template_id).toBe('number')
    })
  })
})

describe('cloneMesocycle — T222 slot value inheritance characterization', () => {
  // Captures CURRENT behavior before T222 introduces override-aware slot inheritance.
  // Current: slot base values copied as-is; slot_week_overrides are never consulted.
  // T222 will change this: last-week override values are merged into new slot base.

  function resetWithOverrides() {
    resetTables()
    testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
    testDb.run(sql`CREATE TABLE slot_week_overrides (
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
      elevation_gain INTEGER,
      is_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER,
      UNIQUE(exercise_slot_id, week_number)
    )`)
  }

  // Seeds a 4-work-week meso with one template containing one slot (base: 3x10 @ 100kg, RPE 8).
  // Also inserts a slot_week_override at week 4 with 4x8 @ 110kg, RPE 9.
  function seedWithSlotAndOverride() {
    resetWithOverrides()

    const exercise = testDb
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance' })
      .returning({ id: schema.exercises.id })
      .get()

    const meso = testDb
      .insert(schema.mesocycles)
      .values({
        name: 'Source',
        start_date: '2026-03-01',
        end_date: '2026-03-28',
        work_weeks: 4,
        has_deload: false,
        status: 'active',
      })
      .returning({ id: schema.mesocycles.id })
      .get()

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({ mesocycle_id: meso.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
      .returning({ id: schema.workout_templates.id })
      .get()

    const slot = testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: exercise.id,
        sets: 3,
        reps: '10',
        weight: 100,
        rpe: 8,
        order: 1,
      })
      .returning({ id: schema.exercise_slots.id })
      .get()

    // Override at week 4 (the last work week) — bumps weight, sets, reps, RPE
    testDb.run(sql`INSERT INTO slot_week_overrides
      (exercise_slot_id, week_number, weight, reps, sets, rpe)
      VALUES (${slot.id}, 4, 110, '8', 4, 9)`)

    testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        week_type: 'normal',
        period: 'morning',
        time_slot: '07:00',
        duration: 90,
      })
      .run()

    return { mesoId: meso.id, tmplId: tmpl.id, slotId: slot.id }
  }

  // Seeds a meso where the override is at week 2 (not the last week) — verifies
  // that even mid-meso overrides are ignored by current clone logic.
  function seedWithMidWeekOverride() {
    resetWithOverrides()

    const exercise = testDb
      .insert(schema.exercises)
      .values({ name: 'Squat', modality: 'resistance' })
      .returning({ id: schema.exercises.id })
      .get()

    const meso = testDb
      .insert(schema.mesocycles)
      .values({
        name: 'Source Mid',
        start_date: '2026-03-01',
        end_date: '2026-03-28',
        work_weeks: 4,
        has_deload: false,
        status: 'active',
      })
      .returning({ id: schema.mesocycles.id })
      .get()

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({ mesocycle_id: meso.id, name: 'Leg A', canonical_name: 'leg-a', modality: 'resistance' })
      .returning({ id: schema.workout_templates.id })
      .get()

    const slot = testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: exercise.id,
        sets: 4,
        reps: '6',
        weight: 140,
        rpe: 8,
        order: 1,
      })
      .returning({ id: schema.exercise_slots.id })
      .get()

    // Override at week 2 only — not the last week
    testDb.run(sql`INSERT INTO slot_week_overrides
      (exercise_slot_id, week_number, weight, reps, sets, rpe)
      VALUES (${slot.id}, 2, 150, '5', 5, 9)`)

    testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 1,
        template_id: tmpl.id,
        week_type: 'normal',
        period: 'morning',
        time_slot: '07:00',
        duration: 90,
      })
      .run()

    return { mesoId: meso.id, slotId: slot.id }
  }

  describe('slot values reflect last-week overrides (T222 behavior)', () => {
    it('cloned slot weight equals last-week override weight', async () => {
      const { mesoId } = seedWithSlotAndOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      expect(clonedSlots).toHaveLength(1)
      // T222: override weight (110) merged into cloned slot base
      expect(clonedSlots[0].weight).toBe(110)
    })

    it('cloned slot sets equals last-week override sets', async () => {
      const { mesoId } = seedWithSlotAndOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      // T222: override sets (4) merged into cloned slot base
      expect(clonedSlots[0].sets).toBe(4)
    })

    it('cloned slot reps equals last-week override reps', async () => {
      const { mesoId } = seedWithSlotAndOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      // T222: override reps ('8') merged into cloned slot base
      expect(clonedSlots[0].reps).toBe('8')
    })

    it('cloned slot rpe equals last-week override rpe', async () => {
      const { mesoId } = seedWithSlotAndOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      // T222: override rpe (9) merged into cloned slot base
      expect(clonedSlots[0].rpe).toBe(9)
    })
  })

  describe('slot_week_overrides table is not modified during clone', () => {
    it('override row count is unchanged after clone', async () => {
      const { mesoId } = seedWithSlotAndOverride()

      const overridesBefore = testDb.all(sql`SELECT * FROM slot_week_overrides`)

      await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })

      const overridesAfter = testDb.all(sql`SELECT * FROM slot_week_overrides`)
      // Current behavior: no new override rows created for cloned slots
      expect(overridesAfter).toHaveLength(overridesBefore.length)
    })

    it('cloned slot has no associated slot_week_overrides rows', async () => {
      const { mesoId } = seedWithSlotAndOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      const clonedSlotId = clonedSlots[0].id
      const overrides = testDb.all(
        sql`SELECT * FROM slot_week_overrides WHERE exercise_slot_id = ${clonedSlotId}`
      )
      expect(overrides).toHaveLength(0)
    })
  })

  describe('mid-meso override also ignored (not just last-week override)', () => {
    it('cloned slot weight equals source base weight when override is at non-last week', async () => {
      const { mesoId } = seedWithMidWeekOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      // Current behavior: base weight (140), not week-2 override weight (150)
      expect(clonedSlots[0].weight).toBe(140)
    })

    it('cloned slot sets equals source base sets when override is at non-last week', async () => {
      const { mesoId } = seedWithMidWeekOverride()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      // Current behavior: base sets (4), not week-2 override sets (5)
      expect(clonedSlots[0].sets).toBe(4)
    })
  })

  describe('slot with no overrides at all — base values still copied verbatim', () => {
    it('clone copies weight from base slot when no overrides exist', async () => {
      resetWithOverrides()

      const exercise = testDb
        .insert(schema.exercises)
        .values({ name: 'OHP', modality: 'resistance' })
        .returning({ id: schema.exercises.id })
        .get()

      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'No-override Source',
          start_date: '2026-03-01',
          end_date: '2026-03-28',
          work_weeks: 4,
          has_deload: false,
          status: 'active',
        })
        .returning({ id: schema.mesocycles.id })
        .get()

      const tmpl = testDb
        .insert(schema.workout_templates)
        .values({ mesocycle_id: meso.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance' })
        .returning({ id: schema.workout_templates.id })
        .get()

      testDb
        .insert(schema.exercise_slots)
        .values({
          template_id: tmpl.id,
          exercise_id: exercise.id,
          sets: 5,
          reps: '5',
          weight: 80,
          rpe: 7,
          order: 1,
        })
        .run()

      testDb
        .insert(schema.weekly_schedule)
        .values({
          mesocycle_id: meso.id,
          day_of_week: 2,
          template_id: tmpl.id,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 60,
        })
        .run()

      const result = await cloneMesocycle({
        source_id: meso.id,
        name: 'Clone',
        start_date: '2026-04-01',
      })
      if (!result.success) throw new Error('clone failed')

      const clonedTmpl = testDb
        .select()
        .from(schema.workout_templates)
        .all()
        .find((t: { mesocycle_id: number }) => t.mesocycle_id === result.id)!

      const clonedSlots = testDb
        .select()
        .from(schema.exercise_slots)
        .all()
        .filter((s: { template_id: number }) => s.template_id === clonedTmpl.id)

      expect(clonedSlots).toHaveLength(1)
      expect(clonedSlots[0].weight).toBe(80)
      expect(clonedSlots[0].sets).toBe(5)
      expect(clonedSlots[0].reps).toBe('5')
      expect(clonedSlots[0].rpe).toBe(7)
    })
  })
})
