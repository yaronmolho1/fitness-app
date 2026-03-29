// Characterization test — captures current behavior for safe refactoring
// T179 will add target_elevation_gain to running template create/update + cascade

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
    planned_duration INTEGER, estimated_duration INTEGER,
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
// createRunningTemplate — current input shape does NOT include target_elevation_gain
// ============================================================================

describe('T179 characterization: createRunningTemplate input shape', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(CREATE_TABLE_MESOCYCLES)
    testDb.run(CREATE_TABLE_TEMPLATES)
    testDb.run(CREATE_TABLE_LOGGED_WORKOUTS)
  })

  it('accepts target_elevation_gain and stores it (T179)', async () => {
    const meso = seedMesocycle()
    const input: CreateRunningTemplateInput = {
      name: 'Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_elevation_gain: 350,
    }
    const result = await createRunningTemplate(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_elevation_gain).toBe(350)
    }
  })

  it('stores all current running fields correctly', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Full Run',
      mesocycle_id: meso.id,
      run_type: 'interval',
      target_pace: '4:30/km',
      hr_zone: 4,
      interval_count: 8,
      interval_rest: 60,
      coaching_cues: 'Push hard',
      target_distance: 10.0,
      target_duration: 45,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.modality).toBe('running')
      expect(result.data.run_type).toBe('interval')
      expect(result.data.target_pace).toBe('4:30/km')
      expect(result.data.hr_zone).toBe(4)
      expect(result.data.interval_count).toBe(8)
      expect(result.data.interval_rest).toBe(60)
      expect(result.data.coaching_cues).toBe('Push hard')
      expect(result.data.target_distance).toBe(10.0)
      expect(result.data.target_duration).toBe(45)
      expect(result.data.target_elevation_gain).toBeNull()
    }
  })

  it('minimal running template has null for all optional fields', async () => {
    const meso = seedMesocycle()
    const result = await createRunningTemplate({
      name: 'Bare Run',
      mesocycle_id: meso.id,
      run_type: 'easy',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.target_pace).toBeNull()
      expect(result.data.hr_zone).toBeNull()
      expect(result.data.interval_count).toBeNull()
      expect(result.data.interval_rest).toBeNull()
      expect(result.data.coaching_cues).toBeNull()
      expect(result.data.target_distance).toBeNull()
      expect(result.data.target_duration).toBeNull()
      expect(result.data.target_elevation_gain).toBeNull()
    }
  })
})

// ============================================================================
// cascadeUpdateTemplates — current CascadeUpdates type does NOT include target_elevation_gain
// ============================================================================

describe('T179 characterization: cascade update running fields', () => {
  beforeEach(() => {
    testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
    testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
    testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
    testDb.run(CREATE_TABLE_MESOCYCLES)
    testDb.run(CREATE_TABLE_TEMPLATES)
    testDb.run(CREATE_TABLE_LOGGED_WORKOUTS)
  })

  it('cascades current running fields (target_pace, hr_zone, etc.)', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Easy Run',
      mesocycle_id: meso.id,
      run_type: 'easy',
      target_pace: '6:00/km',
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    const updates: CascadeUpdates = {
      target_pace: '5:30/km',
      hr_zone: 3,
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

    // Verify DB
    const row = testDb
      .select()
      .from(schema.workout_templates)
      .all()[0]
    expect(row.target_pace).toBe('5:30/km')
    expect(row.hr_zone).toBe(3)
  })

  it('cascade handles target_elevation_gain field (T179)', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Hill Run',
      mesocycle_id: meso.id,
      run_type: 'long',
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    const updates: CascadeUpdates = {
      target_elevation_gain: 500,
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
  })

  it('cascades target_distance and target_duration', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Long Run',
      mesocycle_id: meso.id,
      run_type: 'long',
      target_distance: 15.0,
      target_duration: 90,
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    const updates: CascadeUpdates = {
      target_distance: 20.0,
      target_duration: 120,
    }
    const result = await cascadeUpdateTemplates({
      templateId: tmpl.data.id,
      scope: 'this-only',
      updates,
    })
    expect(result.success).toBe(true)

    const row = testDb.select().from(schema.workout_templates).all()[0]
    expect(row.target_distance).toBe(20.0)
    expect(row.target_duration).toBe(120)
    // elevation gain unaffected
    expect(row.target_elevation_gain).toBeNull()
  })

  it('skips templates with logged workouts', async () => {
    const meso = seedMesocycle()
    const tmpl = await createRunningTemplate({
      name: 'Easy Run',
      mesocycle_id: meso.id,
      run_type: 'easy',
      target_pace: '6:00/km',
    })
    expect(tmpl.success).toBe(true)
    if (!tmpl.success) return

    // Add a logged workout for this template
    testDb
      .insert(schema.logged_workouts)
      .values({
        template_id: tmpl.data.id,
        log_date: '2026-03-15',
        logged_at: new Date(),
        template_snapshot: { version: 1 },
        created_at: new Date(),
      })
      .run()

    const result = await cascadeUpdateTemplates({
      templateId: tmpl.data.id,
      scope: 'this-only',
      updates: { target_pace: '5:00/km' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.updated).toBe(0)
      expect(result.data.skipped).toBe(1)
    }

    // Original value unchanged
    const row = testDb.select().from(schema.workout_templates).all()[0]
    expect(row.target_pace).toBe('6:00/km')
  })
})
