// T179: createRunningTemplate + cascade should handle target_elevation_gain

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

import {
  createRunningTemplate,
  type CreateRunningTemplateInput,
} from './actions'
import { cascadeUpdateTemplates } from './cascade-actions'
import type { CascadeUpdates } from './cascade-types'

const CREATE_TABLE_MESOCYCLES = sql`
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

const CREATE_TABLE_TEMPLATES = sql`
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
    planned_duration INTEGER,
    created_at INTEGER
  )
`

const CREATE_TABLE_LOGGED_WORKOUTS = sql`
  CREATE TABLE logged_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    canonical_name TEXT,
    log_date TEXT NOT NULL,
    logged_at INTEGER NOT NULL,
    rating INTEGER,
    notes TEXT,
    template_snapshot TEXT NOT NULL DEFAULT '{"version":1}',
    created_at INTEGER
  )
`

function seedMesocycle(
  overrides: Partial<{ id: number; name: string; status: string }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: 0,
      status: 'planned',
      ...overrides,
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

// ============================================================================
// createRunningTemplate — target_elevation_gain
// ============================================================================

describe('T179: createRunningTemplate with target_elevation_gain', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(CREATE_TABLE_MESOCYCLES)
    testDb.run(CREATE_TABLE_TEMPLATES)
    testDb.run(CREATE_TABLE_LOGGED_WORKOUTS)
  })

  it('stores target_elevation_gain when provided', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_elevation_gain: 350,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_elevation_gain).toBe(350)
    }
  })

  it('stores target_elevation_gain as null when omitted', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Flat Run',
      mesocycle_id: meso.id,
      run_type: 'easy',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_elevation_gain).toBeNull()
    }
  })

  it('stores zero elevation gain', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Flat Route',
      mesocycle_id: meso.id,
      run_type: 'easy',
      target_elevation_gain: 0,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_elevation_gain).toBe(0)
    }
  })

  it('rejects negative elevation gain', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Bad Run',
      mesocycle_id: meso.id,
      run_type: 'easy',
      target_elevation_gain: -10,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/elevation gain/i)
    }
  })

  it('stores elevation gain alongside distance and duration', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Full Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_distance: 15.0,
      target_duration: 90,
      target_elevation_gain: 500,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_distance).toBe(15.0)
      expect(result.data.target_duration).toBe(90)
      expect(result.data.target_elevation_gain).toBe(500)
    }
  })
})

// ============================================================================
// cascadeUpdateTemplates — target_elevation_gain
// ============================================================================

describe('T179: cascade update with target_elevation_gain', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(CREATE_TABLE_MESOCYCLES)
    testDb.run(CREATE_TABLE_TEMPLATES)
    testDb.run(CREATE_TABLE_LOGGED_WORKOUTS)
  })

  it('cascades target_elevation_gain update', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_elevation_gain: 200,
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    const updates: CascadeUpdates = {
      target_elevation_gain: 400,
    }
    const result = await cascadeUpdateTemplates({
      templateId: tmpl.data.id,
      scope: 'this-only',
      updates,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.updated).toBe(1)
    }

    const row = testDb.select().from(schema.workout_templates).all()[0]
    expect(row.target_elevation_gain).toBe(400)
  })

  it('cascades elevation gain to null', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_elevation_gain: 300,
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    const updates: CascadeUpdates = {
      target_elevation_gain: null,
    }
    const result = await cascadeUpdateTemplates({
      templateId: tmpl.data.id,
      scope: 'this-only',
      updates,
    })
    expect(result.success).toBe(true)

    const row = testDb.select().from(schema.workout_templates).all()[0]
    expect(row.target_elevation_gain).toBeNull()
  })

  it('cascades elevation gain alongside other fields', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_distance: 10,
      target_elevation_gain: 200,
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    const updates: CascadeUpdates = {
      target_distance: 15,
      target_elevation_gain: 500,
    }
    const result = await cascadeUpdateTemplates({
      templateId: tmpl.data.id,
      scope: 'this-only',
      updates,
    })
    expect(result.success).toBe(true)

    const row = testDb.select().from(schema.workout_templates).all()[0]
    expect(row.target_distance).toBe(15)
    expect(row.target_elevation_gain).toBe(500)
  })
})
