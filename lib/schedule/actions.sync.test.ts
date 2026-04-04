// T208: Verify sync hooks are called fire-and-forget after successful mutations
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

const mockSyncScheduleChange = vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0, failed: 0, errors: [] })
vi.mock('@/lib/google/sync', () => ({
  syncScheduleChange: (...args: unknown[]) => mockSyncScheduleChange(...args),
}))

import { assignTemplate, removeAssignment } from './actions'

function seedMesocycle(
  overrides: Partial<{ name: string; status: string; has_deload: number; start_date: string; end_date: string; work_weeks: number }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-02',
      end_date: '2026-03-29',
      work_weeks: 4,
      has_deload: 0,
      status: 'planned',
      ...overrides,
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(mesocycleId: number, name = 'Push A') {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name,
      canonical_name: name.toLowerCase().replace(/\s+/g, '-'),
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

beforeEach(() => {
  vi.clearAllMocks()
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
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
      notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
      interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
      target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER, estimated_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE weekly_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      week_type TEXT NOT NULL DEFAULT 'normal',
      period TEXT NOT NULL DEFAULT 'morning',
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      cycle_length INTEGER NOT NULL DEFAULT 1,
      cycle_position INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
  )
})

describe('assignTemplate — sync hooks (T208)', () => {
  it('AC8: calls syncScheduleChange("assign", mesoId, dates) after successful assignment', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 1, // Tuesday
      template_id: tmpl.id,
      time_slot: '14:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
    expect(mockSyncScheduleChange).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduleChange).toHaveBeenCalledWith(
      'assign',
      meso.id,
      expect.any(Array)
    )
    // Dates should be all Tuesdays (day_of_week=1) in the meso date range
    const dates = mockSyncScheduleChange.mock.calls[0][2] as string[]
    expect(dates.length).toBeGreaterThan(0)
    // Each date should be a Tuesday
    for (const d of dates) {
      const day = new Date(d + 'T00:00:00Z')
      // day_of_week 1 in our system = Tuesday = JS getUTCDay() 2
      expect(day.getUTCDay()).toBe(2)
    }
  })

  it('AC19: sync failure does not affect local mutation result', async () => {
    mockSyncScheduleChange.mockRejectedValueOnce(new Error('API failed'))
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const result = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 1,
      template_id: tmpl.id,
      time_slot: '14:00',
      duration: 60,
    })
    expect(result.success).toBe(true)
  })

  it('does NOT call sync on validation failure', async () => {
    await assignTemplate({
      mesocycle_id: -1,
      day_of_week: 0,
      template_id: 1,
      time_slot: '07:00',
      duration: 60,
    })
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })

  it('does NOT call sync when mesocycle not found', async () => {
    await assignTemplate({
      mesocycle_id: 999,
      day_of_week: 0,
      template_id: 1,
      time_slot: '07:00',
      duration: 60,
    })
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })

  it('does NOT call sync when mesocycle is completed', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const tmpl = seedTemplate(meso.id)
    await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 60,
    })
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })
})

describe('removeAssignment — sync hooks (T208)', () => {
  it('AC9: calls syncScheduleChange("remove", mesoId, dates) after successful removal', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const assigned = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 3, // Thursday
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 60,
    })
    if (!assigned.success) throw new Error('setup failed')
    vi.clearAllMocks()

    const result = await removeAssignment({ id: assigned.data.id })
    expect(result.success).toBe(true)
    expect(mockSyncScheduleChange).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduleChange).toHaveBeenCalledWith(
      'remove',
      meso.id,
      expect.any(Array)
    )
  })

  it('AC19: sync failure does not affect local mutation result', async () => {
    mockSyncScheduleChange.mockRejectedValueOnce(new Error('API failed'))
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const assigned = await assignTemplate({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      time_slot: '07:00',
      duration: 60,
    })
    if (!assigned.success) throw new Error('setup failed')
    vi.clearAllMocks()
    mockSyncScheduleChange.mockRejectedValueOnce(new Error('API failed'))

    const result = await removeAssignment({ id: assigned.data.id })
    expect(result.success).toBe(true)
  })

  it('does NOT call sync on validation failure', async () => {
    await removeAssignment({ id: -1 })
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })

  it('does NOT call sync when mesocycle is completed', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const tmpl = seedTemplate(meso.id)
    const row = testDb
      .insert(schema.weekly_schedule)
      .values({
        mesocycle_id: meso.id,
        day_of_week: 0,
        template_id: tmpl.id,
        week_type: 'normal',
        period: 'morning',
        time_slot: '07:00',
        duration: 60,
        created_at: new Date(),
      })
      .returning()
      .get()
    await removeAssignment({ id: row.id })
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })
})
