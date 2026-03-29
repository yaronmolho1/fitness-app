import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../../../lib/db/schema'
import * as relationsModule from '../../../lib/db/relations'

const fullSchema = { ...schema, ...relationsModule }

describe('slot_week_overrides schema', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle<typeof fullSchema>>

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: fullSchema })

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
        target_distance REAL,
        target_duration INTEGER,
    target_elevation_gain INTEGER,
        planned_duration INTEGER, estimated_duration INTEGER,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS exercise_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        section_id INTEGER,
        sets INTEGER NOT NULL,
        reps TEXT NOT NULL,
        weight REAL,
        rpe REAL,
        rest_seconds INTEGER,
        duration INTEGER,
        group_id INTEGER,
        group_rest_seconds INTEGER,
        guidelines TEXT,
        "order" INTEGER NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS slot_week_overrides (
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
        planned_duration INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER,
        UNIQUE(exercise_slot_id, week_number)
      );
    `)
  })

  afterAll(() => {
    sqlite?.close()
  })

  // Seed helpers
  async function seedSlot() {
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance' })
      .returning()

    const [meso] = await db
      .insert(schema.mesocycles)
      .values({
        name: 'Test Meso',
        start_date: '2026-01-01',
        end_date: '2026-02-28',
        work_weeks: 4,
      })
      .returning()

    const [template] = await db
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Push A',
        canonical_name: 'push-a',
        modality: 'resistance',
      })
      .returning()

    const [slot] = await db
      .insert(schema.exercise_slots)
      .values({
        template_id: template.id,
        exercise_id: exercise.id,
        sets: 3,
        reps: '8-10',
        weight: 60,
        rpe: 7,
        order: 1,
      })
      .returning()

    return { exercise, meso, template, slot }
  }

  beforeEach(() => {
    sqlite.exec('DELETE FROM slot_week_overrides')
    sqlite.exec('DELETE FROM exercise_slots')
    sqlite.exec('DELETE FROM workout_templates')
    sqlite.exec('DELETE FROM mesocycles')
    sqlite.exec('DELETE FROM exercises')
  })

  it('table export exists on schema', () => {
    expect(schema.slot_week_overrides).toBeDefined()
  })

  it('inserts and retrieves a week override', async () => {
    const { slot } = await seedSlot()

    const [override] = await db
      .insert(schema.slot_week_overrides)
      .values({
        exercise_slot_id: slot.id,
        week_number: 2,
        weight: 62.5,
        reps: '8',
        sets: 3,
        rpe: 7.5,
      })
      .returning()

    expect(override.id).toBe(1)
    expect(override.exercise_slot_id).toBe(slot.id)
    expect(override.week_number).toBe(2)
    expect(override.weight).toBe(62.5)
    expect(override.reps).toBe('8')
    expect(override.sets).toBe(3)
    expect(override.rpe).toBe(7.5)
    expect(override.is_deload).toBe(0)
  })

  it('supports running/cardio override fields', async () => {
    const { slot } = await seedSlot()

    const [override] = await db
      .insert(schema.slot_week_overrides)
      .values({
        exercise_slot_id: slot.id,
        week_number: 1,
        distance: 5.0,
        duration: 25,
        pace: '5:00',
      })
      .returning()

    expect(override.distance).toBe(5.0)
    expect(override.duration).toBe(25)
    expect(override.pace).toBe('5:00')
  })

  it('supports is_deload flag', async () => {
    const { slot } = await seedSlot()

    const [override] = await db
      .insert(schema.slot_week_overrides)
      .values({
        exercise_slot_id: slot.id,
        week_number: 5,
        weight: 36,
        sets: 2,
        is_deload: 1,
      })
      .returning()

    expect(override.is_deload).toBe(1)
    expect(override.week_number).toBe(5)
  })

  it('nullable fields default to null', async () => {
    const { slot } = await seedSlot()

    const [override] = await db
      .insert(schema.slot_week_overrides)
      .values({
        exercise_slot_id: slot.id,
        week_number: 1,
      })
      .returning()

    expect(override.weight).toBeNull()
    expect(override.reps).toBeNull()
    expect(override.sets).toBeNull()
    expect(override.rpe).toBeNull()
    expect(override.distance).toBeNull()
    expect(override.duration).toBeNull()
    expect(override.pace).toBeNull()
  })

  it('enforces unique constraint on (exercise_slot_id, week_number)', async () => {
    const { slot } = await seedSlot()

    await db.insert(schema.slot_week_overrides).values({
      exercise_slot_id: slot.id,
      week_number: 2,
      weight: 60,
    })

    await expect(
      db.insert(schema.slot_week_overrides).values({
        exercise_slot_id: slot.id,
        week_number: 2,
        weight: 65,
      })
    ).rejects.toThrow(/UNIQUE constraint failed/)
  })

  it('allows same week_number for different slots', async () => {
    const { slot, template, exercise } = await seedSlot()

    // Create a second exercise + slot
    const [exercise2] = await db
      .insert(schema.exercises)
      .values({ name: 'Squat', modality: 'resistance' })
      .returning()

    const [slot2] = await db
      .insert(schema.exercise_slots)
      .values({
        template_id: template.id,
        exercise_id: exercise2.id,
        sets: 4,
        reps: '6',
        order: 2,
      })
      .returning()

    await db.insert(schema.slot_week_overrides).values({
      exercise_slot_id: slot.id,
      week_number: 1,
      weight: 60,
    })

    await db.insert(schema.slot_week_overrides).values({
      exercise_slot_id: slot2.id,
      week_number: 1,
      weight: 100,
    })

    const all = await db.select().from(schema.slot_week_overrides)
    expect(all).toHaveLength(2)
  })

  it('cascade deletes overrides when exercise_slot is deleted', async () => {
    const { slot } = await seedSlot()

    await db.insert(schema.slot_week_overrides).values([
      { exercise_slot_id: slot.id, week_number: 1, weight: 60 },
      { exercise_slot_id: slot.id, week_number: 2, weight: 62.5 },
      { exercise_slot_id: slot.id, week_number: 3, weight: 65 },
    ])

    const before = await db.select().from(schema.slot_week_overrides)
    expect(before).toHaveLength(3)

    await db
      .delete(schema.exercise_slots)
      .where(eq(schema.exercise_slots.id, slot.id))

    const after = await db.select().from(schema.slot_week_overrides)
    expect(after).toHaveLength(0)
  })

  it('cascade deletes overrides when parent template is deleted', async () => {
    const { slot, template } = await seedSlot()

    await db.insert(schema.slot_week_overrides).values({
      exercise_slot_id: slot.id,
      week_number: 1,
      weight: 60,
    })

    await db
      .delete(schema.workout_templates)
      .where(eq(schema.workout_templates.id, template.id))

    const after = await db.select().from(schema.slot_week_overrides)
    expect(after).toHaveLength(0)
  })

  it('FK constraint rejects invalid exercise_slot_id', async () => {
    await expect(
      db.insert(schema.slot_week_overrides).values({
        exercise_slot_id: 999,
        week_number: 1,
        weight: 60,
      })
    ).rejects.toThrow(/FOREIGN KEY constraint failed/)
  })
})

describe('slot_week_overrides relations', () => {
  let sqlite: Database.Database
  let db: ReturnType<typeof drizzle<typeof fullSchema>>

  beforeAll(() => {
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    db = drizzle(sqlite, { schema: fullSchema })

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
        target_distance REAL,
        target_duration INTEGER,
    target_elevation_gain INTEGER,
        planned_duration INTEGER, estimated_duration INTEGER,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS exercise_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        section_id INTEGER,
        sets INTEGER NOT NULL,
        reps TEXT NOT NULL,
        weight REAL,
        rpe REAL,
        rest_seconds INTEGER,
        duration INTEGER,
        group_id INTEGER,
        group_rest_seconds INTEGER,
        guidelines TEXT,
        "order" INTEGER NOT NULL,
        is_main INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS slot_week_overrides (
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
        planned_duration INTEGER,
        interval_count INTEGER,
        interval_rest INTEGER,
        elevation_gain INTEGER,
    is_deload INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER,
        UNIQUE(exercise_slot_id, week_number)
      );
    `)
  })

  afterAll(() => {
    sqlite?.close()
  })

  it('relation definitions exist', () => {
    expect(relationsModule.slot_week_overridesRelations).toBeDefined()
  })

  it('exercise_slots relation includes slot_week_overrides (many)', async () => {
    // Seed data
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'OHP', modality: 'resistance' })
      .returning()

    const [meso] = await db
      .insert(schema.mesocycles)
      .values({
        name: 'Meso',
        start_date: '2026-01-01',
        end_date: '2026-02-28',
        work_weeks: 4,
      })
      .returning()

    const [template] = await db
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Push',
        canonical_name: 'push',
        modality: 'resistance',
      })
      .returning()

    const [slot] = await db
      .insert(schema.exercise_slots)
      .values({
        template_id: template.id,
        exercise_id: exercise.id,
        sets: 3,
        reps: '10',
        order: 1,
      })
      .returning()

    await db.insert(schema.slot_week_overrides).values([
      { exercise_slot_id: slot.id, week_number: 1, weight: 40 },
      { exercise_slot_id: slot.id, week_number: 2, weight: 42.5 },
    ])

    // Query with eager loading
    const result = await db.query.exercise_slots.findFirst({
      where: eq(schema.exercise_slots.id, slot.id),
      with: { slot_week_overrides: true },
    })

    expect(result).toBeDefined()
    expect(result?.slot_week_overrides).toBeDefined()
    expect(result?.slot_week_overrides).toHaveLength(2)
  })

  it('slot_week_override has back-reference to exercise_slot', async () => {
    // Seed own data so the test is self-contained
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Deadlift', modality: 'resistance' })
      .returning()

    const [meso] = await db
      .insert(schema.mesocycles)
      .values({
        name: 'Back Ref Meso',
        start_date: '2026-03-01',
        end_date: '2026-04-30',
        work_weeks: 4,
      })
      .returning()

    const [template] = await db
      .insert(schema.workout_templates)
      .values({
        mesocycle_id: meso.id,
        name: 'Pull',
        canonical_name: 'pull',
        modality: 'resistance',
      })
      .returning()

    const [slot] = await db
      .insert(schema.exercise_slots)
      .values({
        template_id: template.id,
        exercise_id: exercise.id,
        sets: 3,
        reps: '5',
        order: 1,
      })
      .returning()

    await db.insert(schema.slot_week_overrides).values({
      exercise_slot_id: slot.id,
      week_number: 1,
      weight: 100,
    })

    const result = await db.query.slot_week_overrides.findFirst({
      where: eq(schema.slot_week_overrides.exercise_slot_id, slot.id),
      with: { exercise_slot: true },
    })
    expect(result).toBeDefined()
    expect(result?.exercise_slot).toBeDefined()
    expect(result?.exercise_slot.id).toBe(slot.id)
  })
})
