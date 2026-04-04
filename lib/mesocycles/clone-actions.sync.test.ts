// T208: Verify sync hook in clone-actions (syncMesocycle after clone)
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

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

const mockSyncMesocycle = vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0, failed: 0, errors: [] })
vi.mock('@/lib/google/sync', () => ({
  syncMesocycle: (...args: unknown[]) => mockSyncMesocycle(...args),
}))

import { cloneMesocycle } from './clone-actions'

function resetTables() {
  testDb.run(sql`DROP TABLE IF EXISTS weekly_schedule`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS template_sections`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS mesocycles`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)

  testDb.run(sql`CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT, equipment TEXT, created_at INTEGER
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
    name TEXT NOT NULL, canonical_name TEXT NOT NULL, modality TEXT NOT NULL,
    notes TEXT, run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, estimated_duration INTEGER, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE template_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    modality TEXT NOT NULL, section_name TEXT NOT NULL, "order" INTEGER NOT NULL,
    run_type TEXT, target_pace TEXT, hr_zone INTEGER,
    interval_count INTEGER, interval_rest INTEGER, coaching_cues TEXT,
    target_distance REAL, target_duration INTEGER, target_elevation_gain INTEGER,
    planned_duration INTEGER, created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE exercise_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER REFERENCES template_sections(id),
    sets INTEGER NOT NULL, reps TEXT NOT NULL, weight REAL, rpe REAL,
    rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
    guidelines TEXT, "order" INTEGER NOT NULL, is_main INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  )`)
  testDb.run(sql`CREATE TABLE weekly_schedule (
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
  )`)
  testDb.run(
    sql`CREATE UNIQUE INDEX weekly_schedule_meso_day_type_timeslot_position_idx ON weekly_schedule(mesocycle_id, day_of_week, week_type, time_slot, cycle_position)`
  )
}

function seedSource() {
  const meso = testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Source Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'active',
    })
    .returning({ id: schema.mesocycles.id })
    .get()

  const tmpl = testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: meso.id,
      name: 'Push A',
      canonical_name: 'push-a',
      modality: 'resistance',
    })
    .returning({ id: schema.workout_templates.id })
    .get()

  testDb
    .insert(schema.weekly_schedule)
    .values({
      mesocycle_id: meso.id,
      day_of_week: 0,
      template_id: tmpl.id,
      week_type: 'normal',
      period: 'morning',
      time_slot: '07:00',
      duration: 90,
    })
    .run()

  return { mesoId: meso.id, tmplId: tmpl.id }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetTables()
})

describe('cloneMesocycle — sync hooks (T208)', () => {
  it('AC16: calls syncMesocycle(newMesoId) after successful clone', async () => {
    const { mesoId } = seedSource()
    const result = await cloneMesocycle({
      source_id: mesoId,
      name: 'Clone',
      start_date: '2026-04-01',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(mockSyncMesocycle).toHaveBeenCalledTimes(1)
      expect(mockSyncMesocycle).toHaveBeenCalledWith(result.id)
    }
  })

  it('AC19: sync failure does not affect clone result', async () => {
    mockSyncMesocycle.mockRejectedValueOnce(new Error('API failed'))
    const { mesoId } = seedSource()
    const result = await cloneMesocycle({
      source_id: mesoId,
      name: 'Clone',
      start_date: '2026-04-01',
    })
    expect(result.success).toBe(true)
  })

  it('does NOT call syncMesocycle on clone failure', async () => {
    await cloneMesocycle({
      source_id: 999,
      name: 'Clone',
      start_date: '2026-04-01',
    })
    expect(mockSyncMesocycle).not.toHaveBeenCalled()
  })

  it('does NOT call syncMesocycle for validation errors', async () => {
    const { mesoId } = seedSource()
    await cloneMesocycle({
      source_id: mesoId,
      name: '   ',
      start_date: '2026-04-01',
    })
    expect(mockSyncMesocycle).not.toHaveBeenCalled()
  })
})
