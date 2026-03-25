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

import { copyTemplateToMesocycle } from './copy-actions'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)

  testDb.run(sql`CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
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
    target_distance REAL,
    target_duration INTEGER,
    planned_duration INTEGER,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE template_sections (
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
    planned_duration INTEGER,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
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
  )`)
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
    planned_duration INTEGER,
    interval_count INTEGER,
    interval_rest INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`)
}

function seedMeso(overrides: Partial<{ name: string; status: string }> = {}) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: overrides.name ?? 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: overrides.status ?? 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedExercise(name: string) {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance' })
    .returning({ id: schema.exercises.id })
    .get()
}

type SectionRow = typeof schema.template_sections.$inferSelect
type SlotRow = typeof schema.exercise_slots.$inferSelect
type OverrideRow = typeof schema.slot_week_overrides.$inferSelect

describe('copyTemplateToMesocycle', () => {
  beforeEach(() => {
    resetTables()
  })

  // === Validation ===

  it('rejects non-existent source template', async () => {
    const target = seedMeso()
    const result = await copyTemplateToMesocycle(999, target.id)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/source template not found/i)
  })

  it('rejects non-existent target mesocycle', async () => {
    const source = seedMeso({ name: 'Source' })
    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning({ id: schema.workout_templates.id })
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, 999)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/target mesocycle not found/i)
  })

  it('rejects if target mesocycle is completed', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target', status: 'completed' })
    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning({ id: schema.workout_templates.id })
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })

  it('rejects duplicate canonical_name in target meso', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    // Source template
    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning({ id: schema.workout_templates.id })
      .get()

    // Existing template with same canonical_name in target
    testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: target.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/canonical.name.*already exists/i)
  })

  // === Resistance template copy ===

  it('copies resistance template with new IDs', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex = seedExercise('Bench Press')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
        notes: 'chest focus',
      })
      .returning()
      .get()

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: '8-10',
        weight: 80,
        rpe: 8,
        rest_seconds: 120,
        guidelines: 'slow eccentric',
        order: 1,
        is_main: true,
      })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    // New template has different ID, belongs to target meso
    expect(result.data.id).not.toBe(tmpl.id)
    expect(result.data.mesocycle_id).toBe(target.id)
    expect(result.data.name).toBe('Push A')
    expect(result.data.canonical_name).toBe('push-a')
    expect(result.data.modality).toBe('resistance')
    expect(result.data.notes).toBe('chest focus')

    // Slots copied with new IDs
    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(1)
    expect(newSlots[0].exercise_id).toBe(ex.id)
    expect(newSlots[0].sets).toBe(3)
    expect(newSlots[0].reps).toBe('8-10')
    expect(newSlots[0].weight).toBe(80)
    expect(newSlots[0].rpe).toBe(8)
    expect(newSlots[0].rest_seconds).toBe(120)
    expect(newSlots[0].guidelines).toBe('slow eccentric')
    expect(newSlots[0].order).toBe(1)
    expect(newSlots[0].is_main).toBeTruthy()
  })

  it('preserves canonical_name for cross-phase linking', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.canonical_name).toBe('push-a')
  })

  // === Running template copy ===

  it('copies running template with all running-specific fields', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Tempo Run',
        canonical_name: 'tempo-run',
        modality: 'running',
        run_type: 'tempo',
        target_pace: '5:00',
        hr_zone: 3,
        coaching_cues: 'stay relaxed',
        target_distance: 8.5,
        target_duration: 45,
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.modality).toBe('running')
    expect(result.data.run_type).toBe('tempo')
    expect(result.data.target_pace).toBe('5:00')
    expect(result.data.hr_zone).toBe(3)
    expect(result.data.coaching_cues).toBe('stay relaxed')
    expect(result.data.target_distance).toBe(8.5)
    expect(result.data.target_duration).toBe(45)
  })

  it('copies interval running template with interval fields', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Interval Session',
        canonical_name: 'interval-session',
        modality: 'running',
        run_type: 'interval',
        interval_count: 6,
        interval_rest: 90,
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.interval_count).toBe(6)
    expect(result.data.interval_rest).toBe(90)
  })

  // === MMA template copy ===

  it('copies MMA template with planned_duration', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'BJJ Class',
        canonical_name: 'bjj-class',
        modality: 'mma',
        planned_duration: 90,
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.modality).toBe('mma')
    expect(result.data.planned_duration).toBe(90)
  })

  // === Mixed template copy ===

  it('copies mixed template with sections and their modality-specific fields', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex = seedExercise('Deadlift')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Full Body Mix',
        canonical_name: 'full-body-mix',
        modality: 'mixed',
      })
      .returning()
      .get()

    // Resistance section
    const sec1 = testDb
      .insert(schema.template_sections)
      .values({
        template_id: tmpl.id,
        modality: 'resistance',
        section_name: 'Strength',
        order: 1,
      })
      .returning()
      .get()

    // Running section
    const sec2 = testDb
      .insert(schema.template_sections)
      .values({
        template_id: tmpl.id,
        modality: 'running',
        section_name: 'Cardio',
        order: 2,
        run_type: 'easy',
        target_pace: '6:00',
        hr_zone: 2,
        target_distance: 3.0,
        target_duration: 20,
      })
      .returning()
      .get()

    // MMA section
    testDb
      .insert(schema.template_sections)
      .values({
        template_id: tmpl.id,
        modality: 'mma',
        section_name: 'Grappling',
        order: 3,
        planned_duration: 30,
      })
      .run()

    // Slot in resistance section
    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex.id,
        section_id: sec1.id,
        sets: 5,
        reps: '5',
        weight: 120,
        order: 1,
        is_main: true,
      })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.modality).toBe('mixed')

    // Verify sections copied with new IDs
    const newSections = testDb
      .select()
      .from(schema.template_sections)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSections).toHaveLength(3)

    const resistSec = newSections.find((s: SectionRow) => s.modality === 'resistance')
    const runningSec = newSections.find((s: SectionRow) => s.modality === 'running')
    const mmaSec = newSections.find((s: SectionRow) => s.modality === 'mma')

    expect(resistSec).toBeDefined()
    expect(resistSec!.section_name).toBe('Strength')
    expect(resistSec!.order).toBe(1)
    expect(resistSec!.id).not.toBe(sec1.id)

    expect(runningSec).toBeDefined()
    expect(runningSec!.section_name).toBe('Cardio')
    expect(runningSec!.run_type).toBe('easy')
    expect(runningSec!.target_pace).toBe('6:00')
    expect(runningSec!.hr_zone).toBe(2)
    expect(runningSec!.target_distance).toBe(3.0)
    expect(runningSec!.target_duration).toBe(20)
    expect(runningSec!.id).not.toBe(sec2.id)

    expect(mmaSec).toBeDefined()
    expect(mmaSec!.planned_duration).toBe(30)

    // Verify slot copied with remapped section_id
    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(1)
    expect(newSlots[0].section_id).toBe(resistSec!.id)
    expect(newSlots[0].section_id).not.toBe(sec1.id)
  })

  // === Superset groups ===

  it('copies superset groups with remapped group_ids', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Dumbbell Fly')
    const ex3 = seedExercise('Tricep Pushdown')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push Supersets',
        canonical_name: 'push-supersets',
        modality: 'resistance',
      })
      .returning()
      .get()

    // Superset group 1: exercises 1 and 2
    testDb
      .insert(schema.exercise_slots)
      .values([
        {
          template_id: tmpl.id,
          exercise_id: ex1.id,
          sets: 3,
          reps: '8',
          order: 1,
          group_id: 1,
          group_rest_seconds: 90,
          is_main: false,
        },
        {
          template_id: tmpl.id,
          exercise_id: ex2.id,
          sets: 3,
          reps: '12',
          order: 2,
          group_id: 1,
          group_rest_seconds: 90,
          is_main: false,
        },
        {
          template_id: tmpl.id,
          exercise_id: ex3.id,
          sets: 3,
          reps: '15',
          order: 3,
          group_id: null,
          is_main: false,
        },
      ])
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(3)

    // Grouped slots should share the same group_id (but potentially different from source)
    const grouped = newSlots.filter((s: SlotRow) => s.group_id !== null)
    const ungrouped = newSlots.filter((s: SlotRow) => s.group_id === null)
    expect(grouped).toHaveLength(2)
    expect(ungrouped).toHaveLength(1)
    expect(grouped[0].group_id).toBe(grouped[1].group_id)
    expect(grouped[0].group_rest_seconds).toBe(90)
    expect(grouped[1].group_rest_seconds).toBe(90)
  })

  // === Completed source meso is valid ===

  it('allows copying from completed mesocycle', async () => {
    const source = seedMeso({ name: 'Source', status: 'completed' })
    const target = seedMeso({ name: 'Target' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Legacy Push',
        canonical_name: 'legacy-push',
        modality: 'resistance',
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
  })

  // === Template with no slots ===

  it('copies template with no exercise slots', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Easy Run',
        canonical_name: 'easy-run',
        modality: 'running',
        run_type: 'easy',
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(0)
  })

  // === Atomicity ===

  it('rolls back on failure (atomic transaction)', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })

    // Create template referencing a non-existent exercise to force FK error during slot copy
    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Bad Template',
        canonical_name: 'bad-template',
        modality: 'resistance',
      })
      .returning()
      .get()

    // Insert slot with FK checks disabled so we can create invalid data
    testDb.run(sql`PRAGMA foreign_keys = OFF`)
    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: 9999, // non-existent
        sets: 3,
        reps: '8',
        order: 1,
        is_main: false,
      })
      .run()
    testDb.run(sql`PRAGMA foreign_keys = ON`)

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(false)

    // No template should have been created in target meso
    const targetTemplates = testDb
      .select()
      .from(schema.workout_templates)
      .where(sql`mesocycle_id = ${target.id}`)
      .all()
    expect(targetTemplates).toHaveLength(0)
  })

  // === Active target meso is valid ===

  it('allows copying to active mesocycle', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target', status: 'active' })

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning()
      .get()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
  })

  // === Multiple superset groups ===

  it('handles multiple superset groups correctly', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex1 = seedExercise('Ex A')
    const ex2 = seedExercise('Ex B')
    const ex3 = seedExercise('Ex C')
    const ex4 = seedExercise('Ex D')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Multi Groups',
        canonical_name: 'multi-groups',
        modality: 'resistance',
      })
      .returning()
      .get()

    testDb
      .insert(schema.exercise_slots)
      .values([
        { template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: '8', order: 1, group_id: 1, group_rest_seconds: 60, is_main: false },
        { template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: '10', order: 2, group_id: 1, group_rest_seconds: 60, is_main: false },
        { template_id: tmpl.id, exercise_id: ex3.id, sets: 4, reps: '12', order: 3, group_id: 2, group_rest_seconds: 45, is_main: false },
        { template_id: tmpl.id, exercise_id: ex4.id, sets: 4, reps: '15', order: 4, group_id: 2, group_rest_seconds: 45, is_main: false },
      ])
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(4)

    // Group membership preserved: 2 groups of 2
    const groupIds = [...new Set(newSlots.filter((s: SlotRow) => s.group_id !== null).map((s: SlotRow) => s.group_id))]
    expect(groupIds).toHaveLength(2)

    const group1 = newSlots.filter((s: SlotRow) => s.group_id === groupIds[0])
    const group2 = newSlots.filter((s: SlotRow) => s.group_id === groupIds[1])
    expect(group1).toHaveLength(2)
    expect(group2).toHaveLength(2)
  })

  // === T155: Week override copying (AC16) ===

  it('copies slot_week_overrides with remapped slot IDs (AC16)', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex = seedExercise('Bench Press')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning()
      .get()

    const slot = testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: '8',
        weight: 80,
        order: 1,
        is_main: true,
      })
      .returning()
      .get()

    // Create overrides on the source slot
    testDb
      .insert(schema.slot_week_overrides)
      .values([
        { exercise_slot_id: slot.id, week_number: 2, weight: 85, is_deload: 0 },
        { exercise_slot_id: slot.id, week_number: 3, weight: 90, reps: '6', is_deload: 0 },
        { exercise_slot_id: slot.id, week_number: 4, weight: 48, sets: 2, is_deload: 1 },
      ])
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    // Get the new slot
    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(1)
    const newSlotId = newSlots[0].id

    // Overrides should be copied to the new slot
    const newOverrides = testDb
      .select()
      .from(schema.slot_week_overrides)
      .where(sql`exercise_slot_id = ${newSlotId}`)
      .all()
    expect(newOverrides).toHaveLength(3)

    // Verify override data preserved
    const week2 = newOverrides.find((o: OverrideRow) => o.week_number === 2)!
    expect(week2.weight).toBe(85)
    expect(week2.exercise_slot_id).toBe(newSlotId)

    const week3 = newOverrides.find((o: OverrideRow) => o.week_number === 3)!
    expect(week3.weight).toBe(90)
    expect(week3.reps).toBe('6')

    const week4 = newOverrides.find((o: OverrideRow) => o.week_number === 4)!
    expect(week4.weight).toBe(48)
    expect(week4.sets).toBe(2)
    expect(week4.is_deload).toBe(1)

    // Source overrides untouched
    const sourceOverrides = testDb
      .select()
      .from(schema.slot_week_overrides)
      .where(sql`exercise_slot_id = ${slot.id}`)
      .all()
    expect(sourceOverrides).toHaveLength(3)
  })

  it('copies overrides for multiple slots with correct remapping', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('OHP')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push',
        canonical_name: 'push',
        modality: 'resistance',
      })
      .returning()
      .get()

    const slot1 = testDb
      .insert(schema.exercise_slots)
      .values({ template_id: tmpl.id, exercise_id: ex1.id, sets: 3, reps: '8', order: 1, is_main: true })
      .returning()
      .get()

    const slot2 = testDb
      .insert(schema.exercise_slots)
      .values({ template_id: tmpl.id, exercise_id: ex2.id, sets: 3, reps: '10', order: 2, is_main: false })
      .returning()
      .get()

    // Override on slot1 week 2
    testDb.insert(schema.slot_week_overrides)
      .values({ exercise_slot_id: slot1.id, week_number: 2, weight: 85, is_deload: 0 })
      .run()

    // Override on slot2 week 2
    testDb.insert(schema.slot_week_overrides)
      .values({ exercise_slot_id: slot2.id, week_number: 2, weight: 45, is_deload: 0 })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(2)

    // Each new slot should have its own override
    for (const newSlot of newSlots) {
      const overrides = testDb
        .select()
        .from(schema.slot_week_overrides)
        .where(sql`exercise_slot_id = ${newSlot.id}`)
        .all()
      expect(overrides).toHaveLength(1)
      expect(overrides[0].week_number).toBe(2)
    }
  })

  it('copies template with no overrides (no crash)', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex = seedExercise('Bench')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Push',
        canonical_name: 'push',
        modality: 'resistance',
      })
      .returning()
      .get()

    testDb.insert(schema.exercise_slots)
      .values({ template_id: tmpl.id, exercise_id: ex.id, sets: 3, reps: '8', order: 1, is_main: true })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()

    const newOverrides = testDb
      .select()
      .from(schema.slot_week_overrides)
      .where(sql`exercise_slot_id = ${newSlots[0].id}`)
      .all()
    expect(newOverrides).toHaveLength(0)
  })
})
