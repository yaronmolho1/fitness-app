'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { exercises, exercise_slots } from '@/lib/db/schema'

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

type CreateExerciseInput = {
  name: string
  modality: string
  muscle_group?: string
  equipment?: string
}

type ExerciseRow = typeof exercises.$inferSelect

type CreateExerciseResult =
  | { success: true; data: ExerciseRow }
  | { success: false; error: string }

export async function createExercise(input: CreateExerciseInput): Promise<CreateExerciseResult> {
  const parsed = createExerciseSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { name, modality, muscle_group, equipment } = parsed.data

  // Case-insensitive duplicate check
  const existing = await db
    .select()
    .from(exercises)
    .where(sql`lower(${exercises.name}) = lower(${name})`)

  if (existing.length > 0) {
    return { success: false, error: `Exercise "${name}" already exists` }
  }

  try {
    const [created] = await db
      .insert(exercises)
      .values({
        name,
        modality,
        muscle_group,
        equipment,
        created_at: new Date(),
      })
      .returning()

    revalidatePath('/exercises')
    return { success: true, data: created }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: `Exercise "${name}" already exists` }
    }
    return { success: false, error: 'Failed to create exercise' }
  }
}

const editExerciseSchema = z.object({
  id: z.number().int().positive('Invalid exercise ID'),
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

type EditExerciseInput = {
  id: number
  name: string
  modality: string
  muscle_group?: string
  equipment?: string
}

type EditExerciseResult =
  | { success: true; data: ExerciseRow }
  | { success: false; error: string }

export async function editExercise(input: EditExerciseInput): Promise<EditExerciseResult> {
  const parsed = editExerciseSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { id, name, modality, muscle_group, equipment } = parsed.data

  // Case-insensitive duplicate check excluding self
  const existing = await db
    .select()
    .from(exercises)
    .where(sql`lower(${exercises.name}) = lower(${name})`)

  const duplicate = existing.find((e) => e.id !== id)
  if (duplicate) {
    return { success: false, error: `Exercise "${name}" already exists` }
  }

  try {
    const [updated] = await db
      .update(exercises)
      .set({
        name,
        modality,
        muscle_group: muscle_group || null,
        equipment: equipment || null,
      })
      .where(eq(exercises.id, id))
      .returning()

    if (!updated) {
      return { success: false, error: 'Exercise not found' }
    }

    revalidatePath('/exercises')
    return { success: true, data: updated }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: `Exercise "${name}" already exists` }
    }
    return { success: false, error: 'Failed to update exercise' }
  }
}

type DeleteExerciseResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteExercise(id: number): Promise<DeleteExerciseResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid exercise ID' }
  }

  try {
    const result = db.transaction((tx) => {
      const existing = tx
        .select()
        .from(exercises)
        .where(eq(exercises.id, id))
        .all()

      if (existing.length === 0) {
        return { success: false as const, error: 'Exercise not found' }
      }

      const slots = tx
        .select()
        .from(exercise_slots)
        .where(eq(exercise_slots.exercise_id, id))
        .all()

      if (slots.length > 0) {
        return { success: false as const, error: 'Exercise is in use and cannot be deleted' }
      }

      tx.delete(exercises).where(eq(exercises.id, id)).run()
      return { success: true as const }
    })

    if (result.success) {
      revalidatePath('/exercises')
    }

    return result
  } catch {
    return { success: false, error: 'Failed to delete exercise' }
  }
}
