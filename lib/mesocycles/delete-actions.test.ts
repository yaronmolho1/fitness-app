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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { deleteMesocycle } from './delete-actions'
import { getMesocycleCascadeSummary } from './queries'

// Each table as separate SQL statement (better-sqlite3 requires single-statement)
const CREATE_MESOCYCLES = sql`
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
`

const CREATE_WORKOUT_TEMPLATES = sql`
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
    target_distance REAL,
    target_duration INTEGER,
    target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER,
    created_at INTEGER
  )
`

const CREATE_TEMPLATE_SECTIONS = sql`
  CREATE TABLE template_sections (
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
  )
`

const CREATE_EXERCISE_SLOTS = sql`
  CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL,
    section_id INTEGER,
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
  )
`

const CREATE_WEEKLY_SCHEDULE = sql`
  CREATE TABLE weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER,
    week_type TEXT NOT NULL DEFAULT 'normal',
    period TEXT NOT NULL DEFAULT 'morning',
    time_slot TEXT NOT NULL DEFAULT '07:00',
    duration INTEGER NOT NULL DEFAULT 90,
    created_at INTEGER
  )
`

const CREATE_ROUTINE_ITEMS = sql`
  CREATE TABLE routine_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    has_weight INTEGER NOT NULL DEFAULT 0,
    has_length INTEGER NOT NULL DEFAULT 0,
    has_duration INTEGER NOT NULL DEFAULT 0,
    has_sets INTEGER NOT NULL DEFAULT 0,
    has_reps INTEGER NOT NULL DEFAULT 0,
    frequency_target INTEGER NOT NULL,
    scope TEXT NOT NULL,
    mesocycle_id INTEGER REFERENCES mesocycles(id),
    start_date TEXT,
    end_date TEXT,
    skip_on_deload INTEGER NOT NULL DEFAULT 0,
    frequency_mode TEXT NOT NULL DEFAULT 'weekly_target',
    frequency_days TEXT,
    created_at INTEGER
  )
`

function createAllTables() {
  testDb.run(CREATE_MESOCYCLES)
  testDb.run(CREATE_WORKOUT_TEMPLATES)
  testDb.run(CREATE_TEMPLATE_SECTIONS)
  testDb.run(CREATE_EXERCISE_SLOTS)
  testDb.run(CREATE_WEEKLY_SCHEDULE)
  testDb.run(CREATE_ROUTINE_ITEMS)
}

function dropAllTables() {
  testDb.run(sql`DROP TABLE IF EXISTS routine_items`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
}

function insertMeso(
  overrides: Partial<{
    name: string
    start_date: string
    end_date: string
    work_weeks: number
    has_deload: boolean
    status: string
  }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: overrides.name ?? 'Test Meso',
      start_date: overrides.start_date ?? '2026-03-01',
      end_date: overrides.end_date ?? '2026-03-28',
      work_weeks: overrides.work_weeks ?? 4,
      has_deload: overrides.has_deload ?? false,
      status: overrides.status ?? 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function insertTemplate(mesocycleId: number, name = 'Push Day') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: 'resistance',
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function insertSection(templateId: number, name = 'Main') {
  return testDb
    .insert(schema.template_sections)
    .values({
      template_id: templateId,
      modality: 'resistance',
      section_name: name,
      order: 1,
    })
    .returning({ id: schema.template_sections.id })
    .get()
}

function insertSlot(templateId: number, exerciseId = 1) {
  return testDb
    .insert(schema.exercise_slots)
    .values({
      template_id: templateId,
      exercise_id: exerciseId,
      sets: 3,
      reps: '8-10',
      order: 1,
    })
    .returning({ id: schema.exercise_slots.id })
    .get()
}

function insertSchedule(mesocycleId: number, dayOfWeek = 0, templateId?: number) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesocycleId,
      day_of_week: dayOfWeek,
      template_id: templateId ?? null,
      week_type: 'normal',
      period: 'morning',
    })
    .returning({ id: schema.weekly_schedule.id })
    .get()
}

function insertRoutineItem(mesocycleId: number | null, name = 'Stretching') {
  return testDb
    .insert(schema.routine_items)
    .values({
      name,
      frequency_target: 3,
      scope: mesocycleId ? 'mesocycle' : 'global',
      mesocycle_id: mesocycleId,
      frequency_mode: 'weekly_target',
    })
    .returning({ id: schema.routine_items.id })
    .get()
}

describe('deleteMesocycle', () => {
  beforeEach(() => {
    dropAllTables()
    createAllTables()
  })

  it('deletes a planned mesocycle', async () => {
    const { id } = insertMeso({ status: 'planned' })
    const result = await deleteMesocycle(id)
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows).toHaveLength(0)
  })

  it('deletes a completed mesocycle', async () => {
    const { id } = insertMeso({ status: 'completed' })
    const result = await deleteMesocycle(id)
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows).toHaveLength(0)
  })

  it('blocks deletion of an active mesocycle', async () => {
    const { id } = insertMeso({ status: 'active' })
    const result = await deleteMesocycle(id)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/active/i)
    }

    // Mesocycle still exists
    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows).toHaveLength(1)
  })

  it('returns error for non-existent mesocycle', async () => {
    const result = await deleteMesocycle(999)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/not found/i)
    }
  })

  it('returns error for invalid ID', async () => {
    const result = await deleteMesocycle(-1)
    expect(result.success).toBe(false)
  })

  it('cascade-deletes workout templates', async () => {
    const { id } = insertMeso()
    insertTemplate(id, 'Push')
    insertTemplate(id, 'Pull')

    await deleteMesocycle(id)

    const templates = testDb.select().from(schema.workout_templates).all()
    expect(templates).toHaveLength(0)
  })

  it('cascade-deletes exercise slots via templates', async () => {
    const { id } = insertMeso()
    const { id: tplId } = insertTemplate(id)
    insertSlot(tplId)
    insertSlot(tplId, 2)

    await deleteMesocycle(id)

    const slots = testDb.select().from(schema.exercise_slots).all()
    expect(slots).toHaveLength(0)
  })

  it('cascade-deletes template sections via templates', async () => {
    const { id } = insertMeso()
    const { id: tplId } = insertTemplate(id)
    insertSection(tplId, 'Warmup')
    insertSection(tplId, 'Main')

    await deleteMesocycle(id)

    const sections = testDb.select().from(schema.template_sections).all()
    expect(sections).toHaveLength(0)
  })

  it('cascade-deletes weekly schedule entries', async () => {
    const { id } = insertMeso()
    const { id: tplId } = insertTemplate(id)
    insertSchedule(id, 0, tplId)
    insertSchedule(id, 2, tplId)

    await deleteMesocycle(id)

    const schedules = testDb.select().from(schema.weekly_schedule).all()
    expect(schedules).toHaveLength(0)
  })

  it('promotes mesocycle-scoped routine items to global', async () => {
    const { id } = insertMeso()
    const { id: riId } = insertRoutineItem(id, 'Foam Rolling')

    await deleteMesocycle(id)

    const items = testDb.select().from(schema.routine_items).all()
    expect(items).toHaveLength(1)
    expect(items[0].mesocycle_id).toBeNull()
    expect(items[0].scope).toBe('global')
  })

  it('does not affect routine items from other mesocycles', async () => {
    const { id: meso1 } = insertMeso({ name: 'Meso 1' })
    const { id: meso2 } = insertMeso({ name: 'Meso 2' })
    insertRoutineItem(meso1, 'Item A')
    insertRoutineItem(meso2, 'Item B')

    await deleteMesocycle(meso1)

    const items = testDb.select().from(schema.routine_items).all()
    expect(items).toHaveLength(2)
    // Item A promoted to global
    const itemA = items.find((i: { name: string }) => i.name === 'Item A')
    expect(itemA?.mesocycle_id).toBeNull()
    expect(itemA?.scope).toBe('global')
    // Item B unchanged
    const itemB = items.find((i: { name: string }) => i.name === 'Item B')
    expect(itemB?.mesocycle_id).toBe(meso2)
    expect(itemB?.scope).toBe('mesocycle')
  })

  it('does not affect global routine items', async () => {
    const { id } = insertMeso()
    insertRoutineItem(null, 'Global Item')

    await deleteMesocycle(id)

    const items = testDb.select().from(schema.routine_items).all()
    expect(items).toHaveLength(1)
    expect(items[0].scope).toBe('global')
    expect(items[0].mesocycle_id).toBeNull()
  })

  it('handles mesocycle with zero templates', async () => {
    const { id } = insertMeso()
    const result = await deleteMesocycle(id)
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows).toHaveLength(0)
  })

  it('does not delete other mesocycles', async () => {
    const { id: id1 } = insertMeso({ name: 'Delete Me' })
    insertMeso({ name: 'Keep Me' })

    await deleteMesocycle(id1)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Keep Me')
  })
})

describe('getMesocycleCascadeSummary', () => {
  beforeEach(() => {
    dropAllTables()
    createAllTables()
  })

  it('returns counts for a mesocycle with data', async () => {
    const { id } = insertMeso()
    const { id: tplId } = insertTemplate(id, 'Push')
    insertTemplate(id, 'Pull')
    insertSchedule(id, 0, tplId)
    insertSchedule(id, 1)
    insertSchedule(id, 2, tplId)
    insertRoutineItem(id, 'Stretching')
    insertRoutineItem(id, 'Foam Roll')

    const summary = await getMesocycleCascadeSummary(id)
    expect(summary).toEqual({
      templates: 2,
      schedules: 3,
      routineItems: 2,
    })
  })

  it('returns zeros for mesocycle with no related data', async () => {
    const { id } = insertMeso()

    const summary = await getMesocycleCascadeSummary(id)
    expect(summary).toEqual({
      templates: 0,
      schedules: 0,
      routineItems: 0,
    })
  })

  it('does not count data from other mesocycles', async () => {
    const { id: meso1 } = insertMeso({ name: 'Meso 1' })
    const { id: meso2 } = insertMeso({ name: 'Meso 2' })
    insertTemplate(meso1, 'Push')
    insertTemplate(meso2, 'Pull')
    insertRoutineItem(meso1, 'Item A')
    insertRoutineItem(meso2, 'Item B')

    const summary = await getMesocycleCascadeSummary(meso1)
    expect(summary).toEqual({
      templates: 1,
      schedules: 0,
      routineItems: 1,
    })
  })
})
