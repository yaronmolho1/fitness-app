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

import { createResistanceTemplate } from './actions'

function seedMesocycle(
  overrides: Partial<{
    id: number
    name: string
    status: string
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

describe('createResistanceTemplate', () => {
  beforeEach(() => {
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
        created_at INTEGER
      )
    `)
  })

  describe('validation', () => {
    it('rejects empty name', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects whitespace-only name', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '   ', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/name/i)
    })

    it('rejects name producing empty slug', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '!@#$%^&*()', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/canonical/i)
    })

    it('rejects non-existent mesocycle_id', async () => {
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: 999 })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/mesocycle/i)
    })
  })

  describe('completed mesocycle', () => {
    it('blocks creation on completed mesocycle', async () => {
      const meso = seedMesocycle({ status: 'completed' })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/completed/i)
    })

    it('allows creation on planned mesocycle', async () => {
      const meso = seedMesocycle({ status: 'planned' })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
    })

    it('allows creation on active mesocycle', async () => {
      const meso = seedMesocycle({ status: 'active' })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
    })
  })

  describe('canonical_name uniqueness', () => {
    it('rejects duplicate canonical_name within same mesocycle', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('rejects same slug from different display names within mesocycle', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      // "push-a" and "PUSH A" produce same canonical_name
      const result = await createResistanceTemplate({ name: 'PUSH A', mesocycle_id: meso.id })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error).toMatch(/duplicate|exists/i)
    })

    it('allows same canonical_name across different mesocycles', async () => {
      const meso1 = seedMesocycle({ name: 'Meso 1' })
      const meso2 = seedMesocycle({ name: 'Meso 2' })
      const r1 = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso1.id })
      const r2 = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso2.id })
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    })
  })

  describe('successful creation', () => {
    it('returns success with correct data', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: 'Push A (Main)', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBeDefined()
        expect(typeof result.data.id).toBe('number')
        expect(result.data.name).toBe('Push A (Main)')
        expect(result.data.canonical_name).toBe('push-a-main')
        expect(result.data.mesocycle_id).toBe(meso.id)
      }
    })

    it('always sets modality to resistance', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.modality).toBe('resistance')
      }
    })

    it('auto-generates canonical_name from name', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: 'Lower Body B', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.canonical_name).toBe('lower-body-b')
      }
    })

    it('trims name whitespace before storing', async () => {
      const meso = seedMesocycle()
      const result = await createResistanceTemplate({ name: '  Push A  ', mesocycle_id: meso.id })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Push A')
      }
    })

    it('returns auto-increment integer ids', async () => {
      const meso = seedMesocycle()
      const r1 = await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      const r2 = await createResistanceTemplate({ name: 'Pull A', mesocycle_id: meso.id })
      expect(r1.success && r1.data.id).toBe(1)
      expect(r2.success && r2.data.id).toBe(2)
    })

    it('persists template to database', async () => {
      const meso = seedMesocycle()
      await createResistanceTemplate({ name: 'Push A', mesocycle_id: meso.id })
      const rows = testDb.select().from(schema.workout_templates).all()
      expect(rows).toHaveLength(1)
      expect(rows[0].canonical_name).toBe('push-a')
      expect(rows[0].modality).toBe('resistance')
    })
  })
})
