// Characterization test — captures current behavior for safe refactoring
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
    target_elevation_gain INTEGER,
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
    target_elevation_gain INTEGER,
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
    elevation_gain INTEGER,
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

describe('T155 characterize: copyTemplateToMesocycle', () => {
  beforeEach(() => {
    resetTables()
  })

  // Post-T155: overrides ARE now copied with remapped slot IDs
  it('copies slot_week_overrides with remapped slot IDs (post-T155)', async () => {
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
      .values({
        exercise_slot_id: slot.id,
        week_number: 2,
        weight: 85,
        is_deload: 0,
      })
      .run()

    testDb
      .insert(schema.slot_week_overrides)
      .values({
        exercise_slot_id: slot.id,
        week_number: 4,
        weight: 48,
        sets: 2,
        is_deload: 1,
      })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    // Overrides on source slot still exist
    const sourceOverrides = testDb
      .select()
      .from(schema.slot_week_overrides)
      .where(sql`exercise_slot_id = ${slot.id}`)
      .all()
    expect(sourceOverrides).toHaveLength(2)

    // Overrides ARE copied to the new template's slots (post-T155)
    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots).toHaveLength(1)

    const newOverrides = testDb
      .select()
      .from(schema.slot_week_overrides)
      .where(sql`exercise_slot_id = ${newSlots[0].id}`)
      .all()
    expect(newOverrides).toHaveLength(2)
  })

  it('preserves canonical_name on copy', async () => {
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

  it('remaps section_id on copied slots', async () => {
    const source = seedMeso({ name: 'Source' })
    const target = seedMeso({ name: 'Target' })
    const ex = seedExercise('Deadlift')

    const tmpl = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: source.id,
        name: 'Mixed',
        canonical_name: 'mixed',
        modality: 'mixed',
      })
      .returning()
      .get()

    const sec = testDb
      .insert(schema.template_sections)
      .values({
        template_id: tmpl.id,
        modality: 'resistance',
        section_name: 'Strength',
        order: 1,
      })
      .returning()
      .get()

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex.id,
        section_id: sec.id,
        sets: 5,
        reps: '5',
        order: 1,
        is_main: true,
      })
      .run()

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()

    // section_id is remapped — NOT the same as source
    expect(newSlots[0].section_id).not.toBe(sec.id)
    expect(newSlots[0].section_id).not.toBeNull()

    // The new section_id points to a section in the new template
    const newSections = testDb
      .select()
      .from(schema.template_sections)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSections).toHaveLength(1)
    expect(newSlots[0].section_id).toBe(newSections[0].id)
  })

  it('assigns new IDs to copied template and slots', async () => {
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

    const sourceSlot = testDb
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

    const result = await copyTemplateToMesocycle(tmpl.id, target.id)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.id).not.toBe(tmpl.id)

    const newSlots = testDb
      .select()
      .from(schema.exercise_slots)
      .where(sql`template_id = ${result.data.id}`)
      .all()
    expect(newSlots[0].id).not.toBe(sourceSlot.id)
  })
})
