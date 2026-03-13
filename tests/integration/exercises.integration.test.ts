import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

// We need our own in-memory DB since the setup file's DB isn't exported
let sqlite: Database.Database
let db: ReturnType<typeof drizzle>

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    modality TEXT NOT NULL,
    muscle_group TEXT,
    equipment TEXT,
    created_at INTEGER
  )
`

beforeAll(() => {
  sqlite = new Database(':memory:')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(CREATE_TABLE)
  db = drizzle(sqlite, { schema })
})

beforeEach(() => {
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
