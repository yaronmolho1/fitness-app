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

import { getTransferTargets } from './transfer-queries'

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
    .returning({ id: schema.mesocycles.id, name: schema.mesocycles.name, status: schema.mesocycles.status })
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

describe('getTransferTargets', () => {
  beforeEach(() => resetTables())

  it('returns active and planned mesocycles with their templates', () => {
    const active = seedMeso({ name: 'Active Block', status: 'active' })
    const planned = seedMeso({ name: 'Planned Block', status: 'planned' })
    seedTemplate(active.id, { name: 'Push A', canonical_name: 'push-a' })
    seedTemplate(planned.id, { name: 'Pull A', canonical_name: 'pull-a' })

    const result = getTransferTargets()
    expect(result).toHaveLength(2)
    expect(result.map(m => m.name)).toContain('Active Block')
    expect(result.map(m => m.name)).toContain('Planned Block')
    expect(result[0].templates.length).toBeGreaterThan(0)
  })

  it('excludes completed mesocycles', () => {
    seedMeso({ name: 'Completed', status: 'completed' })
    const active = seedMeso({ name: 'Active', status: 'active' })
    seedTemplate(active.id, { name: 'Push A', canonical_name: 'push-a' })

    const result = getTransferTargets()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Active')
  })

  it('filters to resistance and mixed (with resistance sections) templates only', () => {
    const meso = seedMeso({ name: 'Block', status: 'active' })
    seedTemplate(meso.id, { name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
    seedTemplate(meso.id, { name: 'Run', canonical_name: 'run', modality: 'running' })
    seedTemplate(meso.id, { name: 'MMA', canonical_name: 'mma', modality: 'mma' })
    const mixed = seedTemplate(meso.id, { name: 'Mixed', canonical_name: 'mixed', modality: 'mixed' })
    seedSection(mixed.id, { modality: 'resistance', section_name: 'Strength', order: 1 })

    const result = getTransferTargets()
    expect(result).toHaveLength(1)
    const templateNames = result[0].templates.map(t => t.name)
    expect(templateNames).toContain('Push A')
    expect(templateNames).toContain('Mixed')
    expect(templateNames).not.toContain('Run')
    expect(templateNames).not.toContain('MMA')
  })

  it('includes resistance sections for mixed templates', () => {
    const meso = seedMeso({ name: 'Block', status: 'active' })
    const mixed = seedTemplate(meso.id, { name: 'Mixed Day', canonical_name: 'mixed-day', modality: 'mixed' })
    seedSection(mixed.id, { modality: 'resistance', section_name: 'Strength', order: 1 })
    seedSection(mixed.id, { modality: 'running', section_name: 'Cardio', order: 2 })

    const result = getTransferTargets()
    const mixedTpl = result[0].templates.find(t => t.name === 'Mixed Day')
    expect(mixedTpl).toBeDefined()
    // Only resistance sections included
    expect(mixedTpl!.sections).toHaveLength(1)
    expect(mixedTpl!.sections[0].section_name).toBe('Strength')
  })

  it('returns empty sections array for pure resistance templates', () => {
    const meso = seedMeso({ name: 'Block', status: 'active' })
    seedTemplate(meso.id, { name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })

    const result = getTransferTargets()
    expect(result[0].templates[0].sections).toEqual([])
  })

  it('returns empty array when no active/planned mesocycles', () => {
    seedMeso({ name: 'Completed', status: 'completed' })
    const result = getTransferTargets()
    expect(result).toEqual([])
  })

  it('excludes mesocycles with no compatible templates', () => {
    const meso = seedMeso({ name: 'Running Only', status: 'active' })
    seedTemplate(meso.id, { name: 'Easy Run', canonical_name: 'easy-run', modality: 'running' })

    const result = getTransferTargets()
    expect(result).toEqual([])
  })

  it('excludes mixed templates with no resistance sections', () => {
    const meso = seedMeso({ name: 'Block', status: 'active' })
    seedTemplate(meso.id, { name: 'Push A', canonical_name: 'push-a', modality: 'resistance' })
    const mixed = seedTemplate(meso.id, { name: 'Run Mix', canonical_name: 'run-mix', modality: 'mixed' })
    // Only non-resistance sections
    seedSection(mixed.id, { modality: 'running', section_name: 'Cardio', order: 1 })

    const result = getTransferTargets()
    expect(result).toHaveLength(1)
    const templateNames = result[0].templates.map(t => t.name)
    expect(templateNames).toContain('Push A')
    expect(templateNames).not.toContain('Run Mix')
  })

  it('excludes mesocycle if only template is a mixed with no resistance sections', () => {
    const meso = seedMeso({ name: 'Mixed Only', status: 'active' })
    const mixed = seedTemplate(meso.id, { name: 'Run Mix', canonical_name: 'run-mix', modality: 'mixed' })
    seedSection(mixed.id, { modality: 'running', section_name: 'Cardio', order: 1 })

    const result = getTransferTargets()
    expect(result).toEqual([])
  })
})
