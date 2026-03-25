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

import { getSlotsByTemplate } from './slot-queries'

function createTables() {
  testDb.run(sql`DROP TABLE IF EXISTS slot_week_overrides`)
  testDb.run(sql`DROP TABLE IF EXISTS exercise_slots`)
  testDb.run(sql`DROP TABLE IF EXISTS workout_templates`)
  testDb.run(sql`DROP TABLE IF EXISTS exercises`)
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
    CREATE TABLE exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      modality TEXT NOT NULL,
      muscle_group TEXT,
      equipment TEXT,
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
      target_distance REAL, target_duration INTEGER,
      planned_duration INTEGER,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE exercise_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      section_id INTEGER,
      sets INTEGER NOT NULL,
      reps TEXT NOT NULL,
      weight REAL,
      rpe REAL,
      rest_seconds INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
      guidelines TEXT,
      "order" INTEGER NOT NULL,
      is_main INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER
    )
  `)
  testDb.run(sql`
    CREATE TABLE slot_week_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_slot_id INTEGER NOT NULL REFERENCES exercise_slots(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      weight REAL,
      reps TEXT,
      sets INTEGER,
      rpe REAL,
      distance REAL,
      duration INTEGER,
      pace TEXT,
      is_deload INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER,
      UNIQUE(exercise_slot_id, week_number)
    )
  `)
}

function seedMesocycle() {
  return testDb
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: 0,
      status: 'planned',
    })
    .returning({ id: schema.mesocycles.id })
    .get()
}

function seedTemplate(mesocycleId: number) {
  return testDb
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: mesocycleId,
      name: 'Push A',
      canonical_name: 'push-a',
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning({ id: schema.workout_templates.id })
    .get()
}

function seedExercise(name: string) {
  return testDb
    .insert(schema.exercises)
    .values({ name, modality: 'resistance', created_at: new Date() })
    .returning({ id: schema.exercises.id })
    .get()
}

describe('getSlotsByTemplate', () => {
  beforeEach(() => {
    createTables()
  })

  it('returns group_id and group_rest_seconds in slot results', () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise('Bench Press')

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 3,
        reps: '10',
        order: 1,
        is_main: false,
        group_id: 1,
        group_rest_seconds: 90,
        created_at: new Date(),
      })
      .run()

    const slots = getSlotsByTemplate(tmpl.id)
    expect(slots).toHaveLength(1)
    expect(slots[0].group_id).toBe(1)
    expect(slots[0].group_rest_seconds).toBe(90)
  })

  it('returns null group fields for ungrouped slots', () => {
    const meso = seedMesocycle()
    const tmpl = seedTemplate(meso.id)
    const ex = seedExercise('Squat')

    testDb
      .insert(schema.exercise_slots)
      .values({
        template_id: tmpl.id,
        exercise_id: ex.id,
        sets: 4,
        reps: '5',
        order: 1,
        is_main: true,
        created_at: new Date(),
      })
      .run()

    const slots = getSlotsByTemplate(tmpl.id)
    expect(slots[0].group_id).toBeNull()
    expect(slots[0].group_rest_seconds).toBeNull()
  })
})
