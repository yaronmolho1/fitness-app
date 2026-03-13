import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

// Create in-memory db in hoisted scope so vi.mock factory can reference it
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

// Mock next/headers since Server Actions may use it
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

import { createMesocycle } from './actions'

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.append(key, value)
  }
  return fd
}

describe('createMesocycle', () => {
  beforeEach(() => {
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
  })

  describe('validation', () => {
    it('rejects missing name', async () => {
      const fd = makeFormData({
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.name).toBeDefined()
      }
    })

    it('rejects empty/whitespace name', async () => {
      const fd = makeFormData({
        name: '   ',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.name).toBeDefined()
      }
    })

    it('rejects missing start_date', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        work_weeks: '4',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.start_date).toBeDefined()
      }
    })

    it('rejects invalid start_date format', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '03/01/2026',
        work_weeks: '4',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.start_date).toBeDefined()
      }
    })

    it('rejects work_weeks <= 0', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '2026-03-01',
        work_weeks: '0',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.work_weeks).toBeDefined()
      }
    })

    it('rejects negative work_weeks', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '2026-03-01',
        work_weeks: '-2',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.work_weeks).toBeDefined()
      }
    })

    it('rejects non-integer work_weeks', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '2026-03-01',
        work_weeks: '3.5',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.work_weeks).toBeDefined()
      }
    })

    it('rejects missing work_weeks', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '2026-03-01',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.work_weeks).toBeDefined()
      }
    })
  })

  describe('successful creation', () => {
    it('inserts a mesocycle with status "planned"', async () => {
      const fd = makeFormData({
        name: 'Hypertrophy Block',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.id).toBeDefined()
        expect(typeof result.id).toBe('number')
      }

      const rows = testDb
        .select()
        .from(schema.mesocycles)
        .all()
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe('planned')
      expect(rows[0].name).toBe('Hypertrophy Block')
    })

    it('defaults has_deload to false', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      await createMesocycle(fd)

      const rows = testDb.select().from(schema.mesocycles).all()
      expect(rows[0].has_deload).toBe(false)
    })

    it('accepts has_deload = true', async () => {
      const fd = makeFormData({
        name: 'Test Meso',
        start_date: '2026-03-01',
        work_weeks: '4',
        has_deload: 'true',
      })
      await createMesocycle(fd)

      const rows = testDb.select().from(schema.mesocycles).all()
      expect(rows[0].has_deload).toBe(true)
    })

    it('returns auto-increment integer id', async () => {
      const fd1 = makeFormData({
        name: 'First',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      const fd2 = makeFormData({
        name: 'Second',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      const r1 = await createMesocycle(fd1)
      const r2 = await createMesocycle(fd2)

      expect(r1.success && r1.id).toBe(1)
      expect(r2.success && r2.id).toBe(2)
    })

    it('computes correct end_date without deload', async () => {
      const fd = makeFormData({
        name: 'Test',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      await createMesocycle(fd)

      const rows = testDb.select().from(schema.mesocycles).all()
      expect(rows[0].end_date).toBe('2026-03-28')
    })

    it('computes correct end_date with deload', async () => {
      const fd = makeFormData({
        name: 'Test',
        start_date: '2026-03-01',
        work_weeks: '4',
        has_deload: 'true',
      })
      await createMesocycle(fd)

      const rows = testDb.select().from(schema.mesocycles).all()
      expect(rows[0].end_date).toBe('2026-04-04')
    })

    it('stores end_date as YYYY-MM-DD text', async () => {
      const fd = makeFormData({
        name: 'Test',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      await createMesocycle(fd)

      const rows = testDb.select().from(schema.mesocycles).all()
      expect(rows[0].end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('trims name whitespace', async () => {
      const fd = makeFormData({
        name: '  Hypertrophy Block  ',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      await createMesocycle(fd)

      const rows = testDb.select().from(schema.mesocycles).all()
      expect(rows[0].name).toBe('Hypertrophy Block')
    })

    it('allows duplicate names', async () => {
      const fd1 = makeFormData({
        name: 'Same Name',
        start_date: '2026-03-01',
        work_weeks: '4',
      })
      const fd2 = makeFormData({
        name: 'Same Name',
        start_date: '2026-04-01',
        work_weeks: '4',
      })
      const r1 = await createMesocycle(fd1)
      const r2 = await createMesocycle(fd2)
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    })

    it('allows past start dates', async () => {
      const fd = makeFormData({
        name: 'Past Meso',
        start_date: '2020-01-01',
        work_weeks: '4',
      })
      const result = await createMesocycle(fd)
      expect(result.success).toBe(true)
    })
  })
})
