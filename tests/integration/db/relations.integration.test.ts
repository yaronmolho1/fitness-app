import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../../../lib/db/schema'
import * as relationsModule from '../../../lib/db/relations'
import {
  exercises,
  mesocycles,
  workout_templates,
  exercise_slots,
} from '../../../lib/db/schema'

const fullSchema = { ...schema, ...relationsModule }

describe('Drizzle v2 Relations', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle<typeof fullSchema>>

  beforeAll(async () => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: fullSchema })

    // Create tables manually for in-memory test
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        modality TEXT NOT NULL,
        muscle_group TEXT,
        equipment TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS mesocycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        work_weeks INTEGER NOT NULL,
        has_deload INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS workout_templates (
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
      );
      CREATE TABLE IF NOT EXISTS exercise_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    section_id INTEGER,
        sets INTEGER,
        reps TEXT,
        weight REAL,
        rpe REAL,
        rest_seconds INTEGER, duration INTEGER, group_id INTEGER, group_rest_seconds INTEGER,
        guidelines TEXT,
        "order" INTEGER NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER
      );
    `)
  })

  afterAll(() => {
    sqlite?.close()
  })

  it('relations module exports all relation definitions', () => {
    expect(relationsModule.mesocyclesRelations).toBeDefined()
    expect(relationsModule.workout_templatesRelations).toBeDefined()
    expect(relationsModule.exercise_slotsRelations).toBeDefined()
    expect(relationsModule.exercisesRelations).toBeDefined()
    expect(relationsModule.weekly_scheduleRelations).toBeDefined()
    expect(relationsModule.routine_itemsRelations).toBeDefined()
    expect(relationsModule.logged_workoutsRelations).toBeDefined()
    expect(relationsModule.logged_exercisesRelations).toBeDefined()
    expect(relationsModule.logged_setsRelations).toBeDefined()
    expect(relationsModule.routine_logsRelations).toBeDefined()
  })

  it('can query with eager loading using with:', async () => {
    // Insert test data
    const [exercise] = await db
      .insert(exercises)
      .values({ name: 'Bench Press', modality: 'resistance' })
      .returning()

    const [meso] = await db
      .insert(mesocycles)
      .values({
        name: 'Test Meso',
        start_date: '2026-01-01',
        end_date: '2026-01-28',
        work_weeks: 4,
      })
      .returning()

    const [template] = await db
      .insert(workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning()

    await db.insert(exercise_slots).values({
      template_id: template.id,
      exercise_id: exercise.id,
      sets: 3,
      reps: '8-10',
      order: 1,
    })

    // Query with eager loading
    const result = await db.query.mesocycles.findFirst({
      with: { workout_templates: true },
    })

    expect(result).toBeDefined()
    expect(result?.id).toBe(meso.id)
    expect(result?.workout_templates).toBeDefined()
    expect(result?.workout_templates?.length).toBe(1)
    expect(result?.workout_templates?.[0]?.name).toBe('Push A')
  })

  it('can query nested relations', async () => {
    // Insert test data
    const [exercise] = await db
      .insert(exercises)
      .values({ name: 'Squat', modality: 'resistance' })
      .returning()

    const [meso] = await db
      .insert(mesocycles)
      .values({
        name: 'Leg Meso',
        start_date: '2026-02-01',
        end_date: '2026-02-28',
        work_weeks: 4,
      })
      .returning()

    const [template] = await db
      .insert(workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Leg Day',
        canonical_name: 'leg-day',
        modality: 'resistance',
      })
      .returning()

    await db.insert(exercise_slots).values({
      template_id: template.id,
      exercise_id: exercise.id,
      sets: 4,
      reps: '6-8',
      order: 1,
    })

    // Query with nested relations
    const result = await db.query.mesocycles.findFirst({
      where: eq(mesocycles.id, meso.id),
      with: {
        workout_templates: {
          with: {
            exercise_slots: {
              with: {
                exercise: true,
              },
            },
          },
        },
      },
    })

    expect(result).toBeDefined()
    expect(result?.workout_templates?.[0]?.exercise_slots).toBeDefined()
    expect(result?.workout_templates?.[0]?.exercise_slots?.[0]?.exercise).toBeDefined()
    expect(result?.workout_templates?.[0]?.exercise_slots?.[0]?.exercise?.name).toBe(
      'Squat'
    )
  })
})
