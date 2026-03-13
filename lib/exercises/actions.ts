'use server'

import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { exercises } from '@/lib/db/schema'

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
