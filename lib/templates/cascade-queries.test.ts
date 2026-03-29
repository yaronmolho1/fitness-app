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

import { getCascadeTargets, getCascadePreview } from './cascade-queries'

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
    created_at: Date
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
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER, estimated_duration INTEGER,
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

describe('getCascadeTargets', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('this-only scope', () => {
    it('returns only the source template', async () => {
      const meso = seedMesocycle()
      const t1 = seedTemplate(meso.id)
      seedTemplate(meso.id, { name: 'Pull A', canonical_name: 'pull-a' })

      const result = await getCascadeTargets(t1.id, 'this-only')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
        expect(result.skippedCompleted).toBe(0)
      }
    })
  })

  describe('this-and-future scope', () => {
    it('returns source + siblings in future active/planned mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)

      const result = await getCascadeTargets(t1.id, 'this-and-future')

      expect(result.success).toBe(true)
      if (result.success) {
        const ids = result.data.map((t) => t.id).sort()
        expect(ids).toEqual([t1.id, t2.id, t3.id].sort())
      }
    })

    it('excludes siblings in earlier mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'active', created_at: new Date(2000) })

      seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      // Query from meso2 — should not include meso1's template
      const result = await getCascadeTargets(t2.id, 'this-and-future')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t2.id)
      }
    })

    it('excludes completed mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)

      const result = await getCascadeTargets(t1.id, 'this-and-future')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
      }
    })

    it('reports skippedCompleted count for excluded completed mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'completed', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)
      seedTemplate(meso3.id)

      const result = await getCascadeTargets(t1.id, 'this-and-future')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.skippedCompleted).toBe(2)
      }
    })
  })

  describe('all-phases scope', () => {
    it('returns siblings across all active/planned mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)

      // Query from middle — all-phases includes all
      const result = await getCascadeTargets(t2.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        const ids = result.data.map((t) => t.id).sort()
        expect(ids).toEqual([t1.id, t2.id, t3.id].sort())
      }
    })

    it('excludes completed mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'completed', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'active', created_at: new Date(2000) })

      seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      const result = await getCascadeTargets(t2.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t2.id)
      }
    })

    it('reports skippedCompleted count for excluded completed mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'completed', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'active', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      seedTemplate(meso3.id)

      const result = await getCascadeTargets(t2.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
        expect(result.skippedCompleted).toBe(1)
      }
    })

    it('reports skippedCompleted=0 when no completed mesocycles exist', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)

      const result = await getCascadeTargets(t1.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.skippedCompleted).toBe(0)
      }
    })
  })

  describe('logged workout exclusion', () => {
    it('excludes templates with existing logged workouts', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      // Log a workout against t2
      seedLoggedWorkout(t2.id)

      const result = await getCascadeTargets(t1.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
      }
    })

    it('includes source template even if it has logged workouts (for this-only)', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)
      seedLoggedWorkout(t1.id)

      // this-only always returns just the source
      const result = await getCascadeTargets(t1.id, 'this-only')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
      }
    })

    it('keeps source in all-phases even when source has logged workouts', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)

      // Source has logged workouts — should still be included
      seedLoggedWorkout(t1.id)

      const result = await getCascadeTargets(t1.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        const ids = result.data.map((t) => t.id).sort()
        expect(ids).toEqual([t1.id, t2.id].sort())
      }
    })

    it('excludes logged siblings but keeps source in cascade scopes', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'planned', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      const t2 = seedTemplate(meso2.id)
      const t3 = seedTemplate(meso3.id)

      seedLoggedWorkout(t2.id)

      const result = await getCascadeTargets(t1.id, 'this-and-future')

      expect(result.success).toBe(true)
      if (result.success) {
        const ids = result.data.map((t) => t.id).sort()
        expect(ids).toEqual([t1.id, t3.id].sort())
      }
    })
  })

  describe('edge cases', () => {
    it('returns error for non-existent template', async () => {
      const result = await getCascadeTargets(999, 'this-only')
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/not found/i)
    })

    it('only matches same canonical_name', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

      const t1 = seedTemplate(meso1.id, { canonical_name: 'push-a' })
      seedTemplate(meso2.id, { canonical_name: 'pull-a', name: 'Pull A' })

      const result = await getCascadeTargets(t1.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
      }
    })

    it('no siblings — returns only current template without error', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const t1 = seedTemplate(meso.id)

      const result = await getCascadeTargets(t1.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
      }
    })

    it('all siblings completed — returns only source, skippedCompleted = sibling count', async () => {
      const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
      const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })
      const meso3 = seedMesocycle({ name: 'Phase 3', status: 'completed', created_at: new Date(3000) })

      const t1 = seedTemplate(meso1.id)
      seedTemplate(meso2.id)
      seedTemplate(meso3.id)

      const result = await getCascadeTargets(t1.id, 'all-phases')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
        expect(result.skippedCompleted).toBe(2)
      }
    })

    it('source template always included even when its mesocycle is completed (for this-only)', async () => {
      // Edge: source is in a completed meso. this-only still returns it.
      // The caller (T036 SA) decides whether to block the edit.
      const meso = seedMesocycle({ status: 'completed' })
      const t1 = seedTemplate(meso.id)

      const result = await getCascadeTargets(t1.id, 'this-only')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(t1.id)
      }
    })
  })
})

describe('getCascadePreview', () => {
  beforeEach(() => {
    resetTables()
  })

  it('returns preview with mesocycle names for all-phases scope', async () => {
    const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
    const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

    const t1 = seedTemplate(meso1.id)
    seedTemplate(meso2.id)

    const result = await getCascadePreview(t1.id, 'all-phases')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalTargets).toBe(2)
      expect(result.data.targets).toHaveLength(2)
      // Each target includes mesocycle name
      const mesoNames = result.data.targets.map((t) => t.mesocycleName).sort()
      expect(mesoNames).toEqual(['Phase 1', 'Phase 2'])
    }
  })

  it('marks templates with logged workouts as hasLoggedWorkouts', async () => {
    const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
    const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

    const t1 = seedTemplate(meso1.id)
    const t2 = seedTemplate(meso2.id)
    seedLoggedWorkout(t2.id)

    const result = await getCascadePreview(t1.id, 'all-phases')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalTargets).toBe(2)
      expect(result.data.skippedCount).toBe(1)
      const logged = result.data.targets.find((t) => t.id === t2.id)
      expect(logged?.hasLoggedWorkouts).toBe(true)
      const notLogged = result.data.targets.find((t) => t.id === t1.id)
      expect(notLogged?.hasLoggedWorkouts).toBe(false)
    }
  })

  it('returns single target for this-only scope', async () => {
    const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
    const meso2 = seedMesocycle({ name: 'Phase 2', status: 'planned', created_at: new Date(2000) })

    const t1 = seedTemplate(meso1.id)
    seedTemplate(meso2.id)

    const result = await getCascadePreview(t1.id, 'this-only')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalTargets).toBe(1)
      expect(result.data.skippedCount).toBe(0)
      expect(result.data.targets[0].id).toBe(t1.id)
    }
  })

  it('returns error for non-existent template', async () => {
    const result = await getCascadePreview(999, 'all-phases')
    expect(result.success).toBe(false)
  })

  it('excludes completed mesocycles from preview', async () => {
    const meso1 = seedMesocycle({ name: 'Phase 1', status: 'active', created_at: new Date(1000) })
    const meso2 = seedMesocycle({ name: 'Phase 2', status: 'completed', created_at: new Date(2000) })

    const t1 = seedTemplate(meso1.id)
    seedTemplate(meso2.id)

    const result = await getCascadePreview(t1.id, 'all-phases')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalTargets).toBe(1)
      expect(result.data.targets[0].mesocycleName).toBe('Phase 1')
    }
  })
})
