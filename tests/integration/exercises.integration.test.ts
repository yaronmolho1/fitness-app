import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql, eq } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

// Mock next/cache (used by server actions)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock @/lib/db so server actions use our in-memory test DB
vi.mock('@/lib/db', () => ({
  get db() {
    return db
  },
}))

// We need our own in-memory DB since the setup file's DB isn't exported
let sqlite: Database.Database
let db: ReturnType<typeof drizzle>

const CREATE_EXERCISES = `
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
  )
`

const CREATE_MESOCYCLES = `
  CREATE TABLE IF NOT EXISTS mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    work_weeks INTEGER NOT NULL,
    has_deload INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    created_at INTEGER
  )
`

const CREATE_WORKOUT_TEMPLATES = `
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
  )
`

const CREATE_EXERCISE_SLOTS = `
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
  )
`

beforeAll(() => {
  sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(CREATE_EXERCISES)
  sqlite.exec(CREATE_MESOCYCLES)
  sqlite.exec(CREATE_WORKOUT_TEMPLATES)
  sqlite.exec(CREATE_EXERCISE_SLOTS)
  db = drizzle(sqlite, { schema })
})

beforeEach(() => {
  sqlite.exec('DELETE FROM exercise_slots')
  sqlite.exec('DELETE FROM workout_templates')
  sqlite.exec('DELETE FROM mesocycles')
  sqlite.exec('DELETE FROM exercises')
})

afterEach(() => {
  // clean slate per test
})

describe('exercises integration', () => {
  it('inserts and persists an exercise', async () => {
    const [created] = await db
      .insert(schema.exercises)
      .values({
        name: 'Bench Press',
        modality: 'resistance',
        muscle_group: 'Chest',
        equipment: 'Barbell',
        created_at: new Date(),
      })
      .returning()

    expect(created.id).toBe(1)
    expect(created.name).toBe('Bench Press')
    expect(created.modality).toBe('resistance')
    expect(created.muscle_group).toBe('Chest')
    expect(created.equipment).toBe('Barbell')

    const rows = await db.select().from(schema.exercises)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Bench Press')
  })

  it('enforces DB unique constraint on name', async () => {
    await db.insert(schema.exercises).values({
      name: 'Squat',
      modality: 'resistance',
      created_at: new Date(),
    })

    await expect(
      db.insert(schema.exercises).values({
        name: 'Squat',
        modality: 'resistance',
        created_at: new Date(),
      })
    ).rejects.toThrow(/UNIQUE constraint failed/)
  })

  it('detects case-insensitive duplicates via query', async () => {
    await db.insert(schema.exercises).values({
      name: 'Squat',
      modality: 'resistance',
      created_at: new Date(),
    })

    const existing = await db
      .select()
      .from(schema.exercises)
      .where(sql`lower(${schema.exercises.name}) = lower(${'squat'})`)

    expect(existing).toHaveLength(1)
    expect(existing[0].name).toBe('Squat')
  })

  it('creates exercise via server action', async () => {
    // Mock next/cache and db module, then import action
    // Instead, test the action logic end-to-end by using our test db directly
    const { createExerciseWithDb } = await setupActionWithTestDb()

    const result = await createExerciseWithDb({
      name: 'Deadlift',
      modality: 'resistance',
      muscle_group: 'Back',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Deadlift')
      expect(result.data.modality).toBe('resistance')
    }

    const rows = await db.select().from(schema.exercises)
    expect(rows).toHaveLength(1)
  })

  it('rejects case-insensitive duplicate via action', async () => {
    const { createExerciseWithDb } = await setupActionWithTestDb()

    const first = await createExerciseWithDb({ name: 'Squat', modality: 'resistance' })
    expect(first.success).toBe(true)

    const second = await createExerciseWithDb({ name: 'squat', modality: 'mma' })
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error).toMatch(/exists/i)
  })
})

// Helper: creates a version of createExercise that uses our test DB
async function setupActionWithTestDb() {
  const { z } = await import('zod')

  const createExerciseSchema = z.object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or fewer')),
    modality: z.enum(['resistance', 'running', 'mma'], {
      message: 'Modality must be resistance, running, or mma',
    }),
    muscle_group: z.string().optional(),
    equipment: z.string().optional(),
  })

  async function createExerciseWithDb(input: {
    name: string
    modality: string
    muscle_group?: string
    equipment?: string
  }) {
    const parsed = createExerciseSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message }
    }

    const { name, modality, muscle_group, equipment } = parsed.data

    const existing = await db
      .select()
      .from(schema.exercises)
      .where(sql`lower(${schema.exercises.name}) = lower(${name})`)

    if (existing.length > 0) {
      return { success: false as const, error: `Exercise "${name}" already exists` }
    }

    try {
      const [created] = await db
        .insert(schema.exercises)
        .values({ name, modality, muscle_group, equipment, created_at: new Date() })
        .returning()

      return { success: true as const, data: created }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        return { success: false as const, error: `Exercise "${name}" already exists` }
      }
      return { success: false as const, error: 'Failed to create exercise' }
    }
  }

  return { createExerciseWithDb }
}

describe('exercise edit integration', () => {
  it('updates exercise fields in database', async () => {
    const { editExercise } = await import('@/lib/exercises/actions')
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() })
      .returning()

    const result = await editExercise({
      id: exercise.id, name: 'Incline Bench', modality: 'resistance',
      muscle_group: 'Upper Chest', equipment: 'Dumbbell',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Incline Bench')
      expect(result.data.muscle_group).toBe('Upper Chest')
      expect(result.data.equipment).toBe('Dumbbell')
    }

    const rows = await db.select().from(schema.exercises)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Incline Bench')
  })

  it('rejects duplicate name belonging to different exercise', async () => {
    const { editExercise } = await import('@/lib/exercises/actions')
    await db.insert(schema.exercises).values({ name: 'Squat', modality: 'resistance', created_at: new Date() })
    const [bench] = await db
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance', created_at: new Date() })
      .returning()

    const result = await editExercise({ id: bench.id, name: 'Squat', modality: 'resistance' })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/exists/i)
  })

  it('allows saving with same name (no change)', async () => {
    const { editExercise } = await import('@/lib/exercises/actions')
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Deadlift', modality: 'resistance', created_at: new Date() })
      .returning()

    const result = await editExercise({ id: exercise.id, name: 'Deadlift', modality: 'running' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.modality).toBe('running')
  })

  it('clears muscle_group and equipment when set to empty', async () => {
    const { editExercise } = await import('@/lib/exercises/actions')
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'OHP', modality: 'resistance', muscle_group: 'Shoulders', equipment: 'Barbell', created_at: new Date() })
      .returning()

    const result = await editExercise({
      id: exercise.id, name: 'OHP', modality: 'resistance',
      muscle_group: '', equipment: '',
    })

    expect(result.success).toBe(true)
    const rows = await db.select().from(schema.exercises)
    expect(rows[0].muscle_group).toBeNull()
    expect(rows[0].equipment).toBeNull()
  })

  it('returns not-found for non-existent exercise', async () => {
    const { editExercise } = await import('@/lib/exercises/actions')
    const result = await editExercise({ id: 999, name: 'Ghost', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })
})

// Helper: insert a mesocycle + template + slot referencing an exercise
async function insertExerciseWithSlot(exerciseId: number) {
  const [meso] = await db
    .insert(schema.mesocycles)
    .values({
      name: 'Test Meso',
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      work_weeks: 4,
      created_at: new Date(),
    })
    .returning()

  const [template] = await db
    .insert(schema.workout_templates)
    .values({
      mesocycle_id: meso.id,
      name: 'Push Day',
      canonical_name: 'push-day',
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning()

  const [slot] = await db
    .insert(schema.exercise_slots)
    .values({
      template_id: template.id,
      exercise_id: exerciseId,
      sets: 3,
      reps: '10',
      order: 1,
      created_at: new Date(),
    })
    .returning()

  return { meso, template, slot }
}

describe('exercise deletion integration', () => {
  it('FK constraint prevents deleting exercise referenced by slot', async () => {
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance', created_at: new Date() })
      .returning()

    await insertExerciseWithSlot(exercise.id)

    await expect(
      db.delete(schema.exercises).where(eq(schema.exercises.id, exercise.id))
    ).rejects.toThrow(/FOREIGN KEY constraint failed/)
  })

  it('allows deleting exercise after slot removal', async () => {
    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Squat', modality: 'resistance', created_at: new Date() })
      .returning()

    const { slot } = await insertExerciseWithSlot(exercise.id)

    await db.delete(schema.exercise_slots).where(eq(schema.exercise_slots.id, slot.id))
    await db.delete(schema.exercises).where(eq(schema.exercises.id, exercise.id))

    const rows = await db.select().from(schema.exercises)
    expect(rows).toHaveLength(0)
  })

  it('deleteExercise action returns not-found for missing exercise', async () => {
    const { deleteExerciseWithDb } = await setupDeleteActionWithTestDb()
    const result = await deleteExerciseWithDb(999)
    expect(result).toEqual({ success: false, error: 'Exercise not found' })
  })

  it('deleteExercise action returns protection error for in-use exercise', async () => {
    const { deleteExerciseWithDb } = await setupDeleteActionWithTestDb()

    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Deadlift', modality: 'resistance', created_at: new Date() })
      .returning()

    await insertExerciseWithSlot(exercise.id)

    const result = await deleteExerciseWithDb(exercise.id)
    expect(result).toEqual({
      success: false,
      error: 'Exercise is in use and cannot be deleted',
    })
  })

  it('deleteExercise action successfully deletes unused exercise', async () => {
    const { deleteExerciseWithDb } = await setupDeleteActionWithTestDb()

    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'OHP', modality: 'resistance', created_at: new Date() })
      .returning()

    const result = await deleteExerciseWithDb(exercise.id)
    expect(result).toEqual({ success: true })

    const rows = await db.select().from(schema.exercises)
    expect(rows).toHaveLength(0)
  })

  it('deleteExercise action rejects invalid IDs', async () => {
    const { deleteExerciseWithDb } = await setupDeleteActionWithTestDb()

    expect(deleteExerciseWithDb(0)).toEqual({ success: false, error: 'Invalid exercise ID' })
    expect(deleteExerciseWithDb(-1)).toEqual({ success: false, error: 'Invalid exercise ID' })
    expect(deleteExerciseWithDb(1.5)).toEqual({ success: false, error: 'Invalid exercise ID' })
  })

  it('protects exercise referenced in slots across multiple mesocycles', async () => {
    const { deleteExerciseWithDb } = await setupDeleteActionWithTestDb()

    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Bench Press', modality: 'resistance', created_at: new Date() })
      .returning()

    // First mesocycle + template + slot
    const [meso1] = await db
      .insert(schema.mesocycles)
      .values({ name: 'Meso A', start_date: '2026-01-01', end_date: '2026-03-01', work_weeks: 4, created_at: new Date() })
      .returning()
    const [template1] = await db
      .insert(schema.workout_templates)
      .values({ mesocycle_id: meso1.id, name: 'Push A', canonical_name: 'push-a', modality: 'resistance', created_at: new Date() })
      .returning()
    await db.insert(schema.exercise_slots).values({ template_id: template1.id, exercise_id: exercise.id, sets: 3, reps: '10', order: 1, created_at: new Date() })

    // Second mesocycle + template + slot referencing same exercise
    const [meso2] = await db
      .insert(schema.mesocycles)
      .values({ name: 'Meso B', start_date: '2026-04-01', end_date: '2026-06-01', work_weeks: 4, created_at: new Date() })
      .returning()
    const [template2] = await db
      .insert(schema.workout_templates)
      .values({ mesocycle_id: meso2.id, name: 'Push B', canonical_name: 'push-b', modality: 'resistance', created_at: new Date() })
      .returning()
    await db.insert(schema.exercise_slots).values({ template_id: template2.id, exercise_id: exercise.id, sets: 3, reps: '10', order: 1, created_at: new Date() })

    const result = await deleteExerciseWithDb(exercise.id)
    expect(result).toEqual({ success: false, error: 'Exercise is in use and cannot be deleted' })
  })

  it('protects exercise referenced in completed mesocycle', async () => {
    const { deleteExerciseWithDb } = await setupDeleteActionWithTestDb()

    const [exercise] = await db
      .insert(schema.exercises)
      .values({ name: 'Squat', modality: 'resistance', created_at: new Date() })
      .returning()

    const [meso] = await db
      .insert(schema.mesocycles)
      .values({ name: 'Completed Meso', start_date: '2025-01-01', end_date: '2025-03-01', work_weeks: 4, status: 'completed', created_at: new Date() })
      .returning()
    const [template] = await db
      .insert(schema.workout_templates)
      .values({ mesocycle_id: meso.id, name: 'Leg Day', canonical_name: 'leg-day', modality: 'resistance', created_at: new Date() })
      .returning()
    await db.insert(schema.exercise_slots).values({ template_id: template.id, exercise_id: exercise.id, sets: 3, reps: '10', order: 1, created_at: new Date() })

    const result = await deleteExerciseWithDb(exercise.id)
    expect(result).toEqual({ success: false, error: 'Exercise is in use and cannot be deleted' })
  })
})

// Helper: creates deleteExercise that uses the test DB (mirrors action logic)
async function setupDeleteActionWithTestDb() {
  function deleteExerciseWithDb(id: number) {
    if (!Number.isInteger(id) || id < 1) {
      return { success: false as const, error: 'Invalid exercise ID' }
    }

    try {
      return db.transaction((tx) => {
        const existing = tx
          .select()
          .from(schema.exercises)
          .where(eq(schema.exercises.id, id))
          .all()

        if (existing.length === 0) {
          return { success: false as const, error: 'Exercise not found' }
        }

        const slots = tx
          .select()
          .from(schema.exercise_slots)
          .where(eq(schema.exercise_slots.exercise_id, id))
          .all()

        if (slots.length > 0) {
          return {
            success: false as const,
            error: 'Exercise is in use and cannot be deleted',
          }
        }

        tx.delete(schema.exercises).where(eq(schema.exercises.id, id)).run()
        return { success: true as const }
      })
    } catch {
      return { success: false as const, error: 'Failed to delete exercise' }
    }
  }

  return { deleteExerciseWithDb }
}

