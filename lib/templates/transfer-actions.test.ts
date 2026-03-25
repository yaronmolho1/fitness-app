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

import { copyExerciseSlots, moveExerciseSlots } from './transfer-actions'

function resetTables() {
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

function seedTemplate(
  mesoId: number,
  overrides: Partial<{ name: string; canonical_name: string; modality: string }> = {}
) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesoId,
      name: overrides.name ?? 'Push A',
      canonical_name: overrides.canonical_name ?? 'push-a',
      modality: overrides.modality ?? 'resistance',
    })
    .returning()
    .get()
}

function seedSection(
  templateId: number,
  overrides: Partial<{ modality: string; section_name: string; order: number }> = {}
) {
  return testDb
    .insert(schema.template_sections)
    .values({
      template_id: templateId,
      modality: overrides.modality ?? 'resistance',
      section_name: overrides.section_name ?? 'Strength',
      order: overrides.order ?? 1,
    })
    .returning()
    .get()
}

function seedSlot(
  templateId: number,
  exerciseId: number,
  overrides: Partial<{
    section_id: number | null
    sets: number
    reps: string
    weight: number
    rpe: number
    rest_seconds: number
    group_id: number | null
    group_rest_seconds: number
    guidelines: string
    order: number
    is_main: boolean
  }> = {}
) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      section_id: overrides.section_id ?? null,
      sets: overrides.sets ?? 3,
      reps: overrides.reps ?? '8',
      weight: overrides.weight ?? null,
      rpe: overrides.rpe ?? null,
      rest_seconds: overrides.rest_seconds ?? null,
      group_id: overrides.group_id ?? null,
      group_rest_seconds: overrides.group_rest_seconds ?? null,
      guidelines: overrides.guidelines ?? null,
      order: overrides.order ?? 1,
      is_main: overrides.is_main ?? false,
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

describe('copyExerciseSlots', () => {
  beforeEach(() => resetTables())

  // AC4: copied slot retains all field values
  it('copies slot with all fields preserved', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const slot = seedSlot(source.id, ex.id, {
      sets: 4,
      reps: '8-10',
      weight: 80,
      rpe: 8,
      rest_seconds: 120,
      guidelines: 'slow eccentric',
      order: 1,
      is_main: true,
    })

    const result = await copyExerciseSlots({
      slotIds: [slot.id],
      targetTemplateId: target.id,
    })

    expect(result.success).toBe(true)
    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(1)
    expect(targetSlots[0].exercise_id).toBe(ex.id)
    expect(targetSlots[0].sets).toBe(4)
    expect(targetSlots[0].reps).toBe('8-10')
    expect(targetSlots[0].weight).toBe(80)
    expect(targetSlots[0].rpe).toBe(8)
    expect(targetSlots[0].rest_seconds).toBe(120)
    expect(targetSlots[0].guidelines).toBe('slow eccentric')
    expect(targetSlots[0].is_main).toBeTruthy()
  })

  // AC5: source slot unchanged after copy
  it('leaves source slot unchanged', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const slot = seedSlot(source.id, ex.id, { sets: 3, reps: '10', order: 1 })

    await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })

    const sourceSlots = getSlots(source.id)
    expect(sourceSlots).toHaveLength(1)
    expect(sourceSlots[0].id).toBe(slot.id)
    expect(sourceSlots[0].sets).toBe(3)
    expect(sourceSlots[0].reps).toBe('10')
  })

  // AC6: copied slot appended at max order + 1
  it('appends copied slot after existing slots in target', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Squat')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    // Target already has a slot at order 3
    seedSlot(target.id, ex1.id, { order: 3 })
    const slot = seedSlot(source.id, ex2.id, { order: 1 })

    await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })

    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(2)
    expect(targetSlots[1].order).toBe(4) // max existing (3) + 1
  })

  // AC13: copy to completed meso rejected
  it('rejects copy to completed mesocycle', async () => {
    const sourceMeso = seedMeso({ name: 'Source' })
    const targetMeso = seedMeso({ name: 'Target', status: 'completed' })
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(sourceMeso.id)
    const target = seedTemplate(targetMeso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })

  // AC14: copy FROM completed meso is allowed
  it('allows copy from completed mesocycle', async () => {
    const sourceMeso = seedMeso({ name: 'Source', status: 'completed' })
    const targetMeso = seedMeso({ name: 'Target' })
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(sourceMeso.id)
    const target = seedTemplate(targetMeso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })
    expect(result.success).toBe(true)
  })

  // AC16: cross-meso copy references same global exercise
  it('cross-meso copy references same exercise', async () => {
    const mesoA = seedMeso({ name: 'Meso A' })
    const mesoB = seedMeso({ name: 'Meso B' })
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(mesoA.id)
    const target = seedTemplate(mesoB.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })

    const targetSlots = getSlots(target.id)
    expect(targetSlots[0].exercise_id).toBe(ex.id)
  })

  // AC17: slot copied to non-sectioned template → null section_id
  it('sets section_id to null when target has no sections', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const sourceT = seedTemplate(meso.id, { modality: 'mixed' })
    const section = seedSection(sourceT.id)
    const targetT = seedTemplate(meso.id, {
      name: 'Pull A',
      canonical_name: 'pull-a',
      modality: 'resistance',
    })
    const slot = seedSlot(sourceT.id, ex.id, { section_id: section.id, order: 1 })

    await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: targetT.id })

    const targetSlots = getSlots(targetT.id)
    expect(targetSlots[0].section_id).toBeNull()
  })

  // AC18: slot copied to mixed template section → correct section_id
  it('sets section_id when targetSectionId provided', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, {
      name: 'Mixed',
      canonical_name: 'mixed',
      modality: 'mixed',
    })
    const section = seedSection(target.id, { section_name: 'Strength' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    await copyExerciseSlots({
      slotIds: [slot.id],
      targetTemplateId: target.id,
      targetSectionId: section.id,
    })

    const targetSlots = getSlots(target.id)
    expect(targetSlots[0].section_id).toBe(section.id)
  })

  // AC11: entire superset transferred with new group_id
  it('copies superset group with new shared group_id', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Fly')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    // Existing slot in target with group_id 1
    const ex3 = seedExercise('Row')
    seedSlot(target.id, ex3.id, { group_id: 1, order: 1 })

    const s1 = seedSlot(source.id, ex1.id, { group_id: 1, group_rest_seconds: 90, order: 1 })
    const s2 = seedSlot(source.id, ex2.id, { group_id: 1, group_rest_seconds: 90, order: 2 })

    await copyExerciseSlots({
      slotIds: [s1.id, s2.id],
      targetTemplateId: target.id,
    })

    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(3)

    // The two copied slots should share a new group_id, different from target's existing 1
    const copiedSlots = targetSlots.filter((s: { exercise_id: number }) => s.exercise_id === ex1.id || s.exercise_id === ex2.id)
    expect(copiedSlots).toHaveLength(2)
    expect(copiedSlots[0].group_id).toBe(copiedSlots[1].group_id)
    expect(copiedSlots[0].group_id).not.toBe(1) // not conflicting with existing
    expect(copiedSlots[0].group_rest_seconds).toBe(90)
  })

  // AC12: single slot from superset transferred without group_id
  it('copies single slot from superset without group_id', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Fly')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const s1 = seedSlot(source.id, ex1.id, { group_id: 1, group_rest_seconds: 90, order: 1 })
    seedSlot(source.id, ex2.id, { group_id: 1, group_rest_seconds: 90, order: 2 })

    // Only copy s1 (not the full group)
    await copyExerciseSlots({
      slotIds: [s1.id],
      targetTemplateId: target.id,
    })

    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(1)
    expect(targetSlots[0].group_id).toBeNull()
    expect(targetSlots[0].group_rest_seconds).toBeNull()
  })

  // Edge: copy to same template creates duplicate
  it('allows copy to same template', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const tmpl = seedTemplate(meso.id)
    const slot = seedSlot(tmpl.id, ex.id, { order: 1 })

    await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: tmpl.id })

    const slots = getSlots(tmpl.id)
    expect(slots).toHaveLength(2)
    expect(slots[1].order).toBe(2)
  })

  // Cross-template validation: all slots must belong to same template
  it('rejects slots from different templates', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Squat')
    const t1 = seedTemplate(meso.id)
    const t2 = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const target = seedTemplate(meso.id, { name: 'Target', canonical_name: 'target' })

    const s1 = seedSlot(t1.id, ex1.id, { order: 1 })
    const s2 = seedSlot(t2.id, ex2.id, { order: 1 })

    const result = await copyExerciseSlots({
      slotIds: [s1.id, s2.id],
      targetTemplateId: target.id,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/same template/i)
  })

  // Validation: non-existent slot
  it('rejects non-existent slot', async () => {
    const meso = seedMeso()
    const target = seedTemplate(meso.id)

    const result = await copyExerciseSlots({ slotIds: [999], targetTemplateId: target.id })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  // Validation: non-existent target template
  it('rejects non-existent target template', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await copyExerciseSlots({ slotIds: [slot.id], targetTemplateId: 999 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  // Validation: invalid section for target template
  it('rejects targetSectionId that does not belong to target template', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const other = seedTemplate(meso.id, { name: 'Other', canonical_name: 'other', modality: 'mixed' })
    const section = seedSection(other.id)
    const target = seedTemplate(meso.id, { name: 'Target', canonical_name: 'target', modality: 'mixed' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await copyExerciseSlots({
      slotIds: [slot.id],
      targetTemplateId: target.id,
      targetSectionId: section.id,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/section/i)
  })
})

describe('moveExerciseSlots', () => {
  beforeEach(() => resetTables())

  // AC8: source slot removed, remaining reordered
  it('removes source slot and reorders remaining', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Squat')
    const ex3 = seedExercise('Row')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    seedSlot(source.id, ex1.id, { order: 1 })
    const s2 = seedSlot(source.id, ex2.id, { order: 2 })
    seedSlot(source.id, ex3.id, { order: 3 })

    await moveExerciseSlots({ slotIds: [s2.id], targetTemplateId: target.id })

    // Source: 2 slots left, orders 1,2
    const sourceSlots = getSlots(source.id)
    expect(sourceSlots).toHaveLength(2)
    expect(sourceSlots[0].order).toBe(1)
    expect(sourceSlots[1].order).toBe(2)
    expect(sourceSlots[0].exercise_id).toBe(ex1.id)
    expect(sourceSlots[1].exercise_id).toBe(ex3.id)

    // Target: 1 slot
    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(1)
    expect(targetSlots[0].exercise_id).toBe(ex2.id)
  })

  // AC9: moved slot has all original config preserved
  it('preserves all fields in target', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const slot = seedSlot(source.id, ex.id, {
      sets: 4,
      reps: '8-10',
      weight: 80,
      rpe: 8,
      rest_seconds: 120,
      guidelines: 'slow eccentric',
      is_main: true,
      order: 1,
    })

    await moveExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })

    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(1)
    expect(targetSlots[0].exercise_id).toBe(ex.id)
    expect(targetSlots[0].sets).toBe(4)
    expect(targetSlots[0].reps).toBe('8-10')
    expect(targetSlots[0].weight).toBe(80)
    expect(targetSlots[0].rpe).toBe(8)
    expect(targetSlots[0].rest_seconds).toBe(120)
    expect(targetSlots[0].guidelines).toBe('slow eccentric')
    expect(targetSlots[0].is_main).toBeTruthy()
  })

  // AC14: move FROM completed meso rejected
  it('rejects move from completed mesocycle', async () => {
    const sourceMeso = seedMeso({ name: 'Source', status: 'completed' })
    const targetMeso = seedMeso({ name: 'Target' })
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(sourceMeso.id)
    const target = seedTemplate(targetMeso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await moveExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })

  // AC14: move TO completed meso rejected
  it('rejects move to completed mesocycle', async () => {
    const sourceMeso = seedMeso({ name: 'Source' })
    const targetMeso = seedMeso({ name: 'Target', status: 'completed' })
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(sourceMeso.id)
    const target = seedTemplate(targetMeso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await moveExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/completed/i)
  })

  // Cross-template validation: all slots must belong to same template
  it('rejects slots from different templates', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Squat')
    const t1 = seedTemplate(meso.id)
    const t2 = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const target = seedTemplate(meso.id, { name: 'Target', canonical_name: 'target' })

    const s1 = seedSlot(t1.id, ex1.id, { order: 1 })
    const s2 = seedSlot(t2.id, ex2.id, { order: 1 })

    const result = await moveExerciseSlots({
      slotIds: [s1.id, s2.id],
      targetTemplateId: target.id,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/same template/i)
  })

  // Edge: moving last slot from template leaves it empty
  it('allows moving last slot from template', async () => {
    const meso = seedMeso()
    const ex = seedExercise('Bench Press')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })
    const slot = seedSlot(source.id, ex.id, { order: 1 })

    const result = await moveExerciseSlots({ slotIds: [slot.id], targetTemplateId: target.id })
    expect(result.success).toBe(true)

    const sourceSlots = getSlots(source.id)
    expect(sourceSlots).toHaveLength(0)
  })

  // Superset: move entire group
  it('moves superset group with new shared group_id', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Fly')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const s1 = seedSlot(source.id, ex1.id, { group_id: 1, group_rest_seconds: 90, order: 1 })
    const s2 = seedSlot(source.id, ex2.id, { group_id: 1, group_rest_seconds: 90, order: 2 })

    await moveExerciseSlots({ slotIds: [s1.id, s2.id], targetTemplateId: target.id })

    expect(getSlots(source.id)).toHaveLength(0)
    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(2)
    expect(targetSlots[0].group_id).toBe(targetSlots[1].group_id)
    expect(targetSlots[0].group_id).not.toBeNull()
    expect(targetSlots[0].group_rest_seconds).toBe(90)
  })

  // Single slot from superset → standalone
  it('moves single slot from superset without group_id', async () => {
    const meso = seedMeso()
    const ex1 = seedExercise('Bench Press')
    const ex2 = seedExercise('Fly')
    const source = seedTemplate(meso.id)
    const target = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const s1 = seedSlot(source.id, ex1.id, { group_id: 1, group_rest_seconds: 90, order: 1 })
    seedSlot(source.id, ex2.id, { group_id: 1, group_rest_seconds: 90, order: 2 })

    await moveExerciseSlots({ slotIds: [s1.id], targetTemplateId: target.id })

    const targetSlots = getSlots(target.id)
    expect(targetSlots).toHaveLength(1)
    expect(targetSlots[0].group_id).toBeNull()
    expect(targetSlots[0].group_rest_seconds).toBeNull()
  })
})
