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

// Mock next/cache for revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createMesocycle, activateMesocycle, completeMesocycle } from './actions'

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

// Helper: insert a mesocycle row directly
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
  const vals = {
    name: overrides.name ?? 'Test Meso',
    start_date: overrides.start_date ?? '2026-03-01',
    end_date: overrides.end_date ?? '2026-03-28',
    work_weeks: overrides.work_weeks ?? 4,
    has_deload: overrides.has_deload ?? false,
    status: overrides.status ?? 'planned',
  }
  return testDb
    .insert(schema.mesocycles)
    .values(vals)
    .returning({ id: schema.mesocycles.id })
    .get()
}

describe('activateMesocycle', () => {
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

  it('activates a planned mesocycle when no other is active', async () => {
    const { id } = insertMeso()
    const result = await activateMesocycle(id)
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows[0].status).toBe('active')
  })

  it('rejects when another mesocycle is already active', async () => {
    insertMeso({ name: 'Active One', status: 'active' })
    const { id } = insertMeso({ name: 'Planned One' })

    const result = await activateMesocycle(id)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/active/i)
    }
  })

  it('rejects if mesocycle is already active', async () => {
    const { id } = insertMeso({ status: 'active' })
    const result = await activateMesocycle(id)
    expect(result.success).toBe(false)
  })

  it('rejects if mesocycle is completed', async () => {
    const { id } = insertMeso({ status: 'completed' })
    const result = await activateMesocycle(id)
    expect(result.success).toBe(false)
  })

  it('rejects non-existent mesocycle', async () => {
    const result = await activateMesocycle(999)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/not found/i)
    }
  })

  it('persists status=active in DB after activation', async () => {
    const { id } = insertMeso()
    await activateMesocycle(id)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows[0].status).toBe('active')
  })

  it('enforces only-one-active across sequential requests', async () => {
    const { id: id1 } = insertMeso({ name: 'First' })
    const { id: id2 } = insertMeso({ name: 'Second' })

    const r1 = await activateMesocycle(id1)
    expect(r1.success).toBe(true)

    const r2 = await activateMesocycle(id2)
    expect(r2.success).toBe(false)

    const rows = testDb.select().from(schema.mesocycles).all()
    const activeCount = rows.filter((r: { status: string }) => r.status === 'active').length
    expect(activeCount).toBe(1)
  })
})

describe('completeMesocycle', () => {
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

  it('completes an active mesocycle', async () => {
    const { id } = insertMeso({ status: 'active' })
    const result = await completeMesocycle(id)
    expect(result.success).toBe(true)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows[0].status).toBe('completed')
  })

  it('rejects if mesocycle is planned (no skip to completed)', async () => {
    const { id } = insertMeso({ status: 'planned' })
    const result = await completeMesocycle(id)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeDefined()
    }
  })

  it('rejects if mesocycle is already completed', async () => {
    const { id } = insertMeso({ status: 'completed' })
    const result = await completeMesocycle(id)
    expect(result.success).toBe(false)
  })

  it('rejects non-existent mesocycle', async () => {
    const result = await completeMesocycle(999)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/not found/i)
    }
  })

  it('persists status=completed as terminal in DB', async () => {
    const { id } = insertMeso({ status: 'active' })
    await completeMesocycle(id)

    const rows = testDb.select().from(schema.mesocycles).all()
    expect(rows[0].status).toBe('completed')

    // Attempting to revert should fail
    const result = await activateMesocycle(id)
    expect(result.success).toBe(false)
  })
})
