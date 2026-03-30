// T208: Verify sync hook in updateMesocycle (date range change triggers syncMesocycle)
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

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

const mockSyncMesocycle = vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0, failed: 0, errors: [] })
vi.mock('@/lib/google/sync', () => ({
  syncMesocycle: (...args: unknown[]) => mockSyncMesocycle(...args),
}))

import { updateMesocycle } from './actions'

function createTable() {
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
}

function insertMeso(overrides: Partial<{ status: string; start_date: string; end_date: string; work_weeks: number }> = {}) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-02',
      end_date: '2026-03-29',
      work_weeks: 4,
      has_deload: false,
      status: 'planned',
      ...overrides,
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    fd.set(k, v)
  }
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  createTable()
})

describe('updateMesocycle — sync hooks (T208)', () => {
  it('AC18: calls syncMesocycle(id) after successful date range change', async () => {
    const { id } = insertMeso()
    const fd = makeFormData({
      name: 'Updated Meso',
      start_date: '2026-03-09', // shifted start date
      work_weeks: '4',
      has_deload: 'false',
    })

    const result = await updateMesocycle(id, fd)
    expect(result.success).toBe(true)
    expect(mockSyncMesocycle).toHaveBeenCalledTimes(1)
    expect(mockSyncMesocycle).toHaveBeenCalledWith(id)
  })

  it('AC18: calls syncMesocycle(id) after work_weeks change', async () => {
    const { id } = insertMeso()
    const fd = makeFormData({
      name: 'Test Meso',
      start_date: '2026-03-02',
      work_weeks: '6', // changed
      has_deload: 'false',
    })

    const result = await updateMesocycle(id, fd)
    expect(result.success).toBe(true)
    expect(mockSyncMesocycle).toHaveBeenCalledTimes(1)
    expect(mockSyncMesocycle).toHaveBeenCalledWith(id)
  })

  it('does NOT call syncMesocycle when only name changes (no date change)', async () => {
    const { id } = insertMeso()
    const fd = makeFormData({
      name: 'New Name',
      start_date: '2026-03-02',
      work_weeks: '4',
      has_deload: 'false',
    })

    const result = await updateMesocycle(id, fd)
    expect(result.success).toBe(true)
    expect(mockSyncMesocycle).not.toHaveBeenCalled()
  })

  it('AC19: sync failure does not affect update result', async () => {
    mockSyncMesocycle.mockRejectedValueOnce(new Error('API failed'))
    const { id } = insertMeso()
    const fd = makeFormData({
      name: 'Test Meso',
      start_date: '2026-03-09',
      work_weeks: '4',
      has_deload: 'false',
    })

    const result = await updateMesocycle(id, fd)
    expect(result.success).toBe(true)
  })

  it('does NOT call syncMesocycle on validation failure', async () => {
    const { id } = insertMeso()
    const fd = makeFormData({
      name: '',
      start_date: '2026-03-09',
      work_weeks: '4',
      has_deload: 'false',
    })

    await updateMesocycle(id, fd)
    expect(mockSyncMesocycle).not.toHaveBeenCalled()
  })

  it('does NOT call syncMesocycle when mesocycle not found', async () => {
    const fd = makeFormData({
      name: 'Name',
      start_date: '2026-03-09',
      work_weeks: '4',
      has_deload: 'false',
    })

    await updateMesocycle(999, fd)
    expect(mockSyncMesocycle).not.toHaveBeenCalled()
  })
})
