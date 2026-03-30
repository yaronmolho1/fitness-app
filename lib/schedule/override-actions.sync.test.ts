// T208: Verify sync hooks in override actions (move, undo, reset)
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

import { moveWorkout, undoScheduleMove, resetWeekSchedule } from './override-actions'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS logged_workouts`)
  testDb.run(sql`DROP TABLE IF EXISTS schedule_week_overrides`)
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
      name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
      notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
      interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
      target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
      planned_duration INTEGER, estimated_duration INTEGER, created_at INTEGER
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
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_template_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, template_id)`
  )
  testDb.run(sql`
    CREATE TABLE schedule_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesocycle_id INTEGER NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      period TEXT NOT NULL,
      template_id INTEGER REFERENCES workout_templates(id),
      time_slot TEXT NOT NULL DEFAULT '07:00',
      duration INTEGER NOT NULL DEFAULT 90,
      override_group TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  testDb.run(
    sql`CREATE UNIQUE INDEX schedule_week_overrides_meso_week_day_timeslot_template_idx ON schedule_week_overrides(mesocycle_id, week_number, day_of_week, time_slot, template_id)`
  )
  testDb.run(sql`
    CREATE TABLE logged_workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      canonical_name TEXT,
      log_date TEXT NOT NULL,
      logged_at INTEGER NOT NULL,
      rating INTEGER, notes TEXT,
      template_snapshot TEXT NOT NULL,
      created_at INTEGER
    )
  `)
}

function seedMesocycle(
  overrides: Partial<{
    name: string; status: string; has_deload: number; work_weeks: number; start_date: string; end_date: string
  }> = {}
) {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-02',
      end_date: '2026-03-29',
      work_weeks: 4,
      has_deload: 0,
      status: 'active',
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

function seedSchedule(
  mesocycleId: number,
  dayOfWeek: number,
  templateId: number,
  timeSlot = '07:00',
  duration = 90
) {
  return testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: mesocycleId,
      day_of_week: dayOfWeek,
      template_id: templateId,
      week_type: 'normal',
      period: 'morning',
      time_slot: timeSlot,
      duration,
      created_at: new Date(),
    })
    .returning()
    .get()
}

beforeEach(() => {
  vi.clearAllMocks()
  createTables()
})

describe('moveWorkout — sync hooks (T208)', () => {
  it('AC10: calls syncScheduleChange("move") after successful this_week move', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    const result = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 2,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'this_week',
    })

    expect(result.success).toBe(true)
    expect(mockSyncScheduleChange).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduleChange).toHaveBeenCalledWith(
      'move',
      meso.id,
      expect.any(Array)
    )
    // For this_week move, affected dates = source date + target date
    const dates = mockSyncScheduleChange.mock.calls[0][2] as string[]
    expect(dates.length).toBe(2)
  })

  it('AC11: calls syncScheduleChange("move") after successful remaining_weeks move', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    const result = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 2,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'remaining_weeks',
    })

    expect(result.success).toBe(true)
    expect(mockSyncScheduleChange).toHaveBeenCalledTimes(1)
    const dates = mockSyncScheduleChange.mock.calls[0][2] as string[]
    // Remaining weeks from week 2: weeks 2,3,4 = 3 source dates + 3 target dates = 6
    expect(dates.length).toBe(6)
  })

  it('AC19: sync failure does not affect local mutation result', async () => {
    mockSyncScheduleChange.mockRejectedValueOnce(new Error('API failed'))
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    const result = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 2,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'this_week',
    })

    expect(result.success).toBe(true)
  })

  it('does NOT call sync on failure', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'this_week',
    })

    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })
})

describe('undoScheduleMove — sync hooks (T208)', () => {
  it('AC12: calls syncScheduleChange("reset") after successful undo', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    const moveResult = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'this_week',
    })
    if (!moveResult.success) throw new Error('setup failed')
    vi.clearAllMocks()

    const result = await undoScheduleMove(moveResult.override_group, meso.id)
    expect(result.success).toBe(true)
    expect(mockSyncScheduleChange).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduleChange).toHaveBeenCalledWith(
      'reset',
      meso.id,
      expect.any(Array)
    )
  })

  it('AC19: sync failure does not affect local mutation result', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    const moveResult = await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'this_week',
    })
    if (!moveResult.success) throw new Error('setup failed')
    vi.clearAllMocks()
    mockSyncScheduleChange.mockRejectedValueOnce(new Error('API failed'))

    const result = await undoScheduleMove(moveResult.override_group, meso.id)
    expect(result.success).toBe(true)
  })

  it('does NOT call sync on failure (missing params)', async () => {
    await undoScheduleMove('', 0)
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })

  it('does NOT call sync when mesocycle is completed', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    await undoScheduleMove('some-group', meso.id)
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })
})

describe('resetWeekSchedule — sync hooks (T208)', () => {
  it('AC13: calls syncScheduleChange("reset") after successful reset', async () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const entry = seedSchedule(meso.id, 1, tmpl.id)

    await moveWorkout({
      mesocycle_id: meso.id,
      week_number: 1,
      schedule_id: entry.id,
      target_day: 3,
      target_time_slot: '18:00',
      target_duration: 60,
      scope: 'this_week',
    })
    vi.clearAllMocks()

    const result = await resetWeekSchedule(meso.id, 1)
    expect(result.success).toBe(true)
    expect(mockSyncScheduleChange).toHaveBeenCalledTimes(1)
    expect(mockSyncScheduleChange).toHaveBeenCalledWith(
      'reset',
      meso.id,
      expect.any(Array)
    )
    // Dates should cover the full week 1 (7 days)
    const dates = mockSyncScheduleChange.mock.calls[0][2] as string[]
    expect(dates.length).toBe(7)
  })

  it('AC19: sync failure does not affect local mutation result', async () => {
    mockSyncScheduleChange.mockRejectedValueOnce(new Error('API failed'))
    const meso = seedMesocycle()

    const result = await resetWeekSchedule(meso.id, 1)
    expect(result.success).toBe(true)
  })

  it('does NOT call sync on failure', async () => {
    await resetWeekSchedule(0, 0)
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })

  it('does NOT call sync when mesocycle is completed', async () => {
    const meso = seedMesocycle({ status: 'completed' })
    await resetWeekSchedule(meso.id, 1)
    expect(mockSyncScheduleChange).not.toHaveBeenCalled()
  })
})
