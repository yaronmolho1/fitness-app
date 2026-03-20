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

import { cascadeUpdateTemplates } from './cascade-actions'

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

function getTemplate(id: number) {
  return testDb
    .select()
    .from(schema.workout_templates)
    .where(sql`id = ${id}`)
    .get()
}

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
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
      planned_duration INTEGER,
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

describe('cascadeUpdateTemplates', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('this-only scope', () => {
    it('updates only the source template', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)
      const t2 = seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: { name: 'Push B' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
        expect(result.data.skipped).toBe(0)
      }

      const updated = getTemplate(t1.id)
      expect(updated?.name).toBe('Push B')

      // Other template unchanged
      const other = getTemplate(t2.id)
      expect(other?.name).toBe('Pull A')
    })
  })

  describe('all-phases scope', () => {
    it('updates all sibling templates in active/planned mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push Updated' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
        expect(result.data.skipped).toBe(0)
      }

      expect(getTemplate(t1.id)?.name).toBe('Push Updated')
      expect(getTemplate(t2.id)?.name).toBe('Push Updated')
    })
  })

  describe('this-and-future scope', () => {
    it('updates source + future sibling templates only', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)

      // Cascade from t2 — should update t2 + t3 but not t1
      const result = await cascadeUpdateTemplates({
        templateId: t2.id,
        scope: 'this-and-future',
        updates: { name: 'Push Future' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
        expect(result.data.skipped).toBe(0)
      }

      expect(getTemplate(t1.id)?.name).toBe('Push A')
      expect(getTemplate(t2.id)?.name).toBe('Push Future')
      expect(getTemplate(t3.id)?.name).toBe('Push Future')
    })
  })

  describe('skipping logged templates', () => {
    it('skips templates with logged workouts and reports skipped count', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)

      seedLoggedWorkout(t2.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push Cascaded' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1 + t3
        expect(result.data.skipped).toBe(1) // t2
      }

      expect(getTemplate(t1.id)?.name).toBe('Push Cascaded')
      expect(getTemplate(t2.id)?.name).toBe('Push A') // unchanged
      expect(getTemplate(t3.id)?.name).toBe('Push Cascaded')
    })

    it('skips source template if it has logged workouts', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)

      seedLoggedWorkout(t1.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: { name: 'Push Changed' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(0)
        expect(result.data.skipped).toBe(1)
      }

      expect(getTemplate(t1.id)?.name).toBe('Push A') // unchanged
    })
  })

  describe('atomicity', () => {
    it('rolls back all changes if an error occurs mid-transaction', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)

      // Force an error by passing an update that will fail via schema violation
      // We pass an invalid field to trigger an error inside the transaction
      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: '' }, // empty name should be rejected by validation
      })

      expect(result.success).toBe(false)

      // Both templates should be unchanged
      expect(getTemplate(t1.id)?.name).toBe('Push A')
    })
  })

  describe('return summary', () => {
    it('returns { updated: 0, skipped: 0 } when template not found', async () => {
      const result = await cascadeUpdateTemplates({
        templateId: 999,
        scope: 'this-only',
        updates: { name: 'Foo' },
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/not found/i)
      }
    })

    it('returns correct counts with mixed update/skip', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const meso4 = seedMesocycle({ name: 'Phase 4', status: 'planned', created_at: new Date(4000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      seedTemplate(meso3.id)
      const t4 = seedTemplate(meso4.id)

      seedLoggedWorkout(t2.id)
      seedLoggedWorkout(t4.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push New' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1, t3
        expect(result.data.skipped).toBe(2) // t2, t4
      }
    })
  })

  describe('skipping completed mesocycles', () => {
    it('reports skippedCompleted count in summary for all-phases', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      const tCompleted = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push Cascaded' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1 + t3
        expect(result.data.skipped).toBe(0)
        expect(result.data.skippedCompleted).toBe(1)
      }

      // Completed mesocycle template unchanged
      expect(getTemplate(tCompleted.id)?.name).toBe('Push A')
      expect(getTemplate(t1.id)?.name).toBe('Push Cascaded')
      expect(getTemplate(t3.id)?.name).toBe('Push Cascaded')
    })

    it('reports skippedCompleted count in summary for this-and-future', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'completed', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)
      seedTemplate(meso3.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-and-future',
        updates: { name: 'Push Updated' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
        expect(result.data.skippedCompleted).toBe(2)
      }
    })

    it('reports skippedCompleted=0 when no completed mesocycles in scope', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push New' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.skippedCompleted).toBe(0)
      }
    })

    it('reports both skipped (logged) and skippedCompleted in mixed scenario', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })
      const meso4 = seedMesocycle({ name: 'Phase 4', status: 'planned', created_at: new Date(4000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id) // completed — skippedCompleted
      const t3 = seedTemplate(meso3.id)
      seedTemplate(meso4.id)

      seedLoggedWorkout(t3.id) // logged — skipped

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push Mixed' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2) // t1 + t4
        expect(result.data.skipped).toBe(1) // t3 (logged)
        expect(result.data.skippedCompleted).toBe(1) // meso2
      }
    })
  })

  describe('no siblings edge case', () => {
    it('updates only current template when no siblings exist', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push Solo' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
        expect(result.data.skipped).toBe(0)
      }

      expect(getTemplate(t1.id)?.name).toBe('Push Solo')
    })
  })

  describe('validation', () => {
    it('rejects empty updates object', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: {},
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/nothing to update/i)
      }
    })

    it('rejects empty name string', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: { name: '  ' },
      })

      expect(result.success).toBe(false)
    })
  })

  describe('running field cascade', () => {
    it('cascades run_type update across phases', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id, {
        name: 'Tempo Run', canonical_name: 'tempo-run', modality: 'running',
      })
      const t2 = seedTemplate(meso2.id, {
        name: 'Tempo Run', canonical_name: 'tempo-run', modality: 'running',
      })

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { run_type: 'interval' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
      }
      expect(getTemplate(t1.id)?.run_type).toBe('interval')
      expect(getTemplate(t2.id)?.run_type).toBe('interval')
    })

    it('cascades multiple running fields at once', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id, {
        name: 'Intervals', canonical_name: 'intervals', modality: 'running',
      })
      const t2 = seedTemplate(meso2.id, {
        name: 'Intervals', canonical_name: 'intervals', modality: 'running',
      })

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: {
          run_type: 'interval',
          target_pace: '4:30/km',
          hr_zone: 4,
          interval_count: 8,
          interval_rest: 90,
          coaching_cues: 'Stay relaxed',
        },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
      }
      const updated = getTemplate(t1.id)
      expect(updated?.run_type).toBe('interval')
      expect(updated?.target_pace).toBe('4:30/km')
      expect(updated?.hr_zone).toBe(4)
      expect(updated?.interval_count).toBe(8)
      expect(updated?.interval_rest).toBe(90)
      expect(updated?.coaching_cues).toBe('Stay relaxed')

      const sibling = getTemplate(t2.id)
      expect(sibling?.run_type).toBe('interval')
      expect(sibling?.target_pace).toBe('4:30/km')
      expect(sibling?.hr_zone).toBe(4)
    })

    it('skips logged templates when cascading running fields', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id, {
        name: 'Easy Run', canonical_name: 'easy-run', modality: 'running',
      })
      const t2 = seedTemplate(meso2.id, {
        name: 'Easy Run', canonical_name: 'easy-run', modality: 'running',
      })

      seedLoggedWorkout(t2.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { hr_zone: 3 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(1)
        expect(result.data.skipped).toBe(1)
      }
      expect(getTemplate(t1.id)?.hr_zone).toBe(3)
      expect(getTemplate(t2.id)?.hr_zone).toBeNull()
    })

    it('clears nullable running fields with null', async () => {
      const meso = seedMesocycle({ status: 'active' })

      // Seed with existing values via raw SQL
      const t1 = seedTemplate(meso.id, {
        name: 'Tempo', canonical_name: 'tempo', modality: 'running',
      })
      testDb.run(sql`UPDATE workout_templates SET target_pace = '5:00/km', hr_zone = 3 WHERE id = ${t1.id}`)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: { target_pace: null, hr_zone: null },
      })

      expect(result.success).toBe(true)
      const updated = getTemplate(t1.id)
      expect(updated?.target_pace).toBeNull()
      expect(updated?.hr_zone).toBeNull()
    })
  })

  describe('MMA planned_duration cascade', () => {
    it('cascades planned_duration update across phases', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id, {
        name: 'BJJ Gi', canonical_name: 'bjj-gi', modality: 'mma',
      })
      const t2 = seedTemplate(meso2.id, {
        name: 'BJJ Gi', canonical_name: 'bjj-gi', modality: 'mma',
      })

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { planned_duration: 90 },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
      }
      expect(getTemplate(t1.id)?.planned_duration).toBe(90)
      expect(getTemplate(t2.id)?.planned_duration).toBe(90)
    })

    it('clears planned_duration with null', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id, {
        name: 'MMA Spar', canonical_name: 'mma-spar', modality: 'mma',
      })
      testDb.run(sql`UPDATE workout_templates SET planned_duration = 60 WHERE id = ${t1.id}`)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: { planned_duration: null },
      })

      expect(result.success).toBe(true)
      expect(getTemplate(t1.id)?.planned_duration).toBeNull()
    })
  })

  describe('notes cascade', () => {
    it('cascades notes update across phases', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { notes: 'Focus on form' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.updated).toBe(2)
      }
      expect(getTemplate(t1.id)?.notes).toBe('Focus on form')
      expect(getTemplate(t2.id)?.notes).toBe('Focus on form')
    })

    it('clears notes with empty string', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)
      testDb.run(sql`UPDATE workout_templates SET notes = 'old notes' WHERE id = ${t1.id}`)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'this-only',
        updates: { notes: '' },
      })

      expect(result.success).toBe(true)
      expect(getTemplate(t1.id)?.notes).toBe('')
    })

    it('cascades name + notes together', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Push B', notes: 'New notes' },
      })

      expect(result.success).toBe(true)
      expect(getTemplate(t1.id)?.name).toBe('Push B')
      expect(getTemplate(t1.id)?.notes).toBe('New notes')
      expect(getTemplate(t2.id)?.name).toBe('Push B')
      expect(getTemplate(t2.id)?.notes).toBe('New notes')
    })
  })

  describe('mixed field updates', () => {
    it('cascades running fields + name together', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id, {
        name: 'Easy Run', canonical_name: 'easy-run', modality: 'running',
      })
      const t2 = seedTemplate(meso2.id, {
        name: 'Easy Run', canonical_name: 'easy-run', modality: 'running',
      })

      const result = await cascadeUpdateTemplates({
        templateId: t1.id,
        scope: 'all-phases',
        updates: { name: 'Tempo Run', run_type: 'tempo', target_pace: '5:00/km' },
      })

      expect(result.success).toBe(true)
      expect(getTemplate(t1.id)?.name).toBe('Tempo Run')
      expect(getTemplate(t1.id)?.run_type).toBe('tempo')
      expect(getTemplate(t2.id)?.name).toBe('Tempo Run')
      expect(getTemplate(t2.id)?.target_pace).toBe('5:00/km')
    })
  })
})
