import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql, eq, and } from 'drizzle-orm'
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

import { cloneMesocycle } from './clone-actions'
import { getCascadeTargets } from '@/lib/templates/cascade-queries'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
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
    planned_duration INTEGER,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER,
    sets INTEGER NOT NULL,
    reps TEXT NOT NULL,
    weight REAL,
    rpe REAL,
    rest_seconds INTEGER,
    guidelines TEXT,
    "order" INTEGER NOT NULL,
    is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE weekly_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    template_id INTEGER REFERENCES workout_templates(id),
    week_type TEXT NOT NULL DEFAULT 'normal',
    created_at INTEGER,
    UNIQUE(mesocycle_id, day_of_week, week_type)
  )`)
  testDb.run(sql`CREATE TABLE logged_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    canonical_name TEXT,
    logged_at INTEGER NOT NULL,
    rating INTEGER,
    notes TEXT,
    template_snapshot TEXT NOT NULL,
    created_at INTEGER
  )`)
}

function seedSource(opts?: {
  status?: string
  templates?: Array<{ name: string; canonical_name: string; modality?: string }>
}) {
  const status = opts?.status ?? 'completed'
  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Source Meso',
      start_date: '2026-01-05',
      end_date: '2026-02-01',
      work_weeks: 4,
      has_deload: false,
      status,
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  const templates = opts?.templates ?? [
    { name: 'Push A', canonical_name: 'push-a' },
    { name: 'Pull A', canonical_name: 'pull-a' },
  ]

  const templateIds: number[] = []
  for (const tmpl of templates) {
    const t = testDb
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: tmpl.name,
        canonical_name: tmpl.canonical_name,
        modality: tmpl.modality ?? 'resistance',
      })
      .returning({ id: schema.workout_templates.id })
      .get()
    templateIds.push(t.id)
  }

  return { mesoId: meso.id, templateIds }
}

describe('T042: Canonical name preservation', () => {
  beforeEach(() => {
    resetTables()
  })

  describe('clone copies canonical_name verbatim', () => {
    it('copies canonical_name identically from source to cloned templates', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const sourceTemplates = testDb
        .select({ canonical_name: schema.workout_templates.canonical_name })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, mesoId))
        .all()
        .map((t: { canonical_name: string }) => t.canonical_name)
        .sort()

      const clonedTemplates = testDb
        .select({ canonical_name: schema.workout_templates.canonical_name })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, result.id))
        .all()
        .map((t: { canonical_name: string }) => t.canonical_name)
        .sort()

      expect(clonedTemplates).toEqual(sourceTemplates)
    })

    it('assigns new auto-increment IDs to cloned templates', async () => {
      const { mesoId, templateIds } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedIds = testDb
        .select({ id: schema.workout_templates.id })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, result.id))
        .all()
        .map((t: { id: number }) => t.id)

      for (const id of clonedIds) {
        expect(templateIds).not.toContain(id)
      }
    })

    it('does not modify canonical_name on source templates', async () => {
      const { mesoId } = seedSource()

      // Snapshot source canonical names before clone
      const before = testDb
        .select({
          id: schema.workout_templates.id,
          canonical_name: schema.workout_templates.canonical_name,
        })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, mesoId))
        .all()

      await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })

      // Verify source unchanged
      const after = testDb
        .select({
          id: schema.workout_templates.id,
          canonical_name: schema.workout_templates.canonical_name,
        })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, mesoId))
        .all()

      expect(after).toEqual(before)
    })

    it('byte-for-byte identical canonical_name (no whitespace/case changes)', async () => {
      const { mesoId } = seedSource({
        templates: [{ name: 'Push A (Main)', canonical_name: 'push-a-main' }],
      })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const cloned = testDb
        .select({ canonical_name: schema.workout_templates.canonical_name })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, result.id))
        .get()

      expect(cloned!.canonical_name).toBe('push-a-main')
    })
  })

  describe('cross-phase query returns both source + clone', () => {
    it('SELECT WHERE canonical_name returns templates from both mesocycles', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      // Cross-phase query for 'push-a'
      const matches = testDb
        .select({
          id: schema.workout_templates.id,
          mesocycle_id: schema.workout_templates.mesocycle_id,
        })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.canonical_name, 'push-a'))
        .all()

      expect(matches).toHaveLength(2)
      const mesoIds = matches.map((m: { mesocycle_id: number }) => m.mesocycle_id).sort()
      expect(mesoIds).toEqual([mesoId, result.id].sort())
    })

    it('cross-phase query works for all canonical names in cloned meso', async () => {
      const { mesoId } = seedSource()
      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      for (const slug of ['push-a', 'pull-a']) {
        const matches = testDb
          .select({ mesocycle_id: schema.workout_templates.mesocycle_id })
          .from(schema.workout_templates)
          .where(eq(schema.workout_templates.canonical_name, slug))
          .all()

        expect(matches).toHaveLength(2)
      }
    })
  })

  describe('cascade query includes cloned template', () => {
    it('all-phases cascade includes cloned template when its meso is planned', async () => {
      const { mesoId } = seedSource({ status: 'active' })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      // Cloned meso is 'planned' by default
      const sourceTemplate = testDb
        .select({ id: schema.workout_templates.id })
        .from(schema.workout_templates)
        .where(
          and(
            eq(schema.workout_templates.mesocycle_id, mesoId),
            eq(schema.workout_templates.canonical_name, 'push-a')
          )
        )
        .get()

      const cascadeResult = await getCascadeTargets(sourceTemplate!.id, 'all-phases')

      expect(cascadeResult.success).toBe(true)
      if (!cascadeResult.success) return

      // Should include both source + cloned template
      expect(cascadeResult.data).toHaveLength(2)
      const mesoIds = cascadeResult.data.map((t) => t.mesocycle_id).sort()
      expect(mesoIds).toEqual([mesoId, result.id].sort())
    })

    it('cascade excludes cloned template when its meso is completed', async () => {
      const { mesoId } = seedSource({ status: 'active' })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      // Mark cloned meso as completed
      testDb
        .update(schema.mesocycles)
        .set({ status: 'completed' })
        .where(eq(schema.mesocycles.id, result.id))
        .run()

      const sourceTemplate = testDb
        .select({ id: schema.workout_templates.id })
        .from(schema.workout_templates)
        .where(
          and(
            eq(schema.workout_templates.mesocycle_id, mesoId),
            eq(schema.workout_templates.canonical_name, 'push-a')
          )
        )
        .get()

      const cascadeResult = await getCascadeTargets(sourceTemplate!.id, 'all-phases')

      expect(cascadeResult.success).toBe(true)
      if (!cascadeResult.success) return

      // Only source, cloned excluded (completed)
      expect(cascadeResult.data).toHaveLength(1)
      expect(cascadeResult.data[0].mesocycle_id).toBe(mesoId)
    })

    it('this-and-future cascade includes cloned template', async () => {
      // Source needs created_at for this-and-future ordering
      const meso = testDb
        .insert(schema.mesocycles)
        .values({
          name: 'Source Meso',
          start_date: '2026-01-05',
          end_date: '2026-02-01',
          work_weeks: 4,
          has_deload: false,
          status: 'active',
          created_at: new Date(1000),
        })
        .returning({ id: schema.mesocycles.id })
        .get()
      const mesoId = meso.id

      testDb
        .insert(schema.workout_templates)
        .values([
          { mesocycle_id: mesoId, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' },
          { mesocycle_id: mesoId, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' },
        ])
        .run()

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const sourceTemplate = testDb
        .select({ id: schema.workout_templates.id })
        .from(schema.workout_templates)
        .where(
          and(
            eq(schema.workout_templates.mesocycle_id, mesoId),
            eq(schema.workout_templates.canonical_name, 'push-a')
          )
        )
        .get()

      const cascadeResult = await getCascadeTargets(sourceTemplate!.id, 'this-and-future')

      expect(cascadeResult.success).toBe(true)
      if (!cascadeResult.success) return

      expect(cascadeResult.data.length).toBeGreaterThanOrEqual(2)
      const mesoIds = cascadeResult.data.map((t) => t.mesocycle_id)
      expect(mesoIds).toContain(mesoId)
      expect(mesoIds).toContain(result.id)
    })
  })

  describe('edge cases', () => {
    it('non-standard canonical_name is copied verbatim (no normalization)', async () => {
      const { mesoId } = seedSource({
        templates: [{ name: 'Weird One', canonical_name: 'WeIrD--OnE__123' }],
      })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const cloned = testDb
        .select({ canonical_name: schema.workout_templates.canonical_name })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, result.id))
        .get()

      expect(cloned!.canonical_name).toBe('WeIrD--OnE__123')
    })

    it('duplicate canonical_names in source are both cloned with same value', async () => {
      const { mesoId } = seedSource({
        templates: [
          { name: 'Push A', canonical_name: 'push-a' },
          { name: 'Push A v2', canonical_name: 'push-a' },
        ],
      })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const clonedNames = testDb
        .select({ canonical_name: schema.workout_templates.canonical_name })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, result.id))
        .all()
        .map((t: { canonical_name: string }) => t.canonical_name)

      expect(clonedNames).toHaveLength(2)
      expect(clonedNames).toEqual(['push-a', 'push-a'])
    })

    it('empty string canonical_name is copied as-is', async () => {
      const { mesoId } = seedSource({
        templates: [{ name: 'No Slug', canonical_name: '' }],
      })

      const result = await cloneMesocycle({
        source_id: mesoId,
        name: 'Phase 2',
        start_date: '2026-03-01',
      })
      expect(result.success).toBe(true)
      if (!result.success) return

      const cloned = testDb
        .select({ canonical_name: schema.workout_templates.canonical_name })
        .from(schema.workout_templates)
        .where(eq(schema.workout_templates.mesocycle_id, result.id))
        .get()

      expect(cloned!.canonical_name).toBe('')
    })
  })
})
