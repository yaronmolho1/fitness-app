'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { exercise_slots, workout_templates, exercises } from '@/lib/db/schema'

type SlotRow = typeof exercise_slots.$inferSelect

type SlotResult =
  | { success: true; data: SlotRow }
  | { success: false; error: string }

type RemoveResult =
  | { success: true }
  | { success: false; error: string }

// Shared field validators
const positiveInt = z.number().int().positive()
const nonNegativeNumber = z.number().min(0)
const nonNegativeInt = z.number().int().min(0)
const rpeRange = z.number().min(1).max(10)

const addSlotSchema = z.object({
  template_id: positiveInt,
  exercise_id: positiveInt,
  sets: positiveInt,
  reps: positiveInt,
  weight: nonNegativeNumber.optional(),
  rpe: rpeRange.optional(),
  rest_seconds: nonNegativeInt.optional(),
  guidelines: z.string().optional(),
})

type AddExerciseSlotInput = {
  template_id: number
  exercise_id: number
  sets: number
  reps: number
  weight?: number
  rpe?: number
  rest_seconds?: number
  guidelines?: string
}

export async function addExerciseSlot(
  input: AddExerciseSlotInput
): Promise<SlotResult> {
  const parsed = addSlotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { template_id, exercise_id, sets, reps, weight, rpe, rest_seconds, guidelines } = parsed.data

  // Verify template exists
  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, template_id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  // Verify exercise exists
  const exercise = db
    .select()
    .from(exercises)
    .where(eq(exercises.id, exercise_id))
    .get()

  if (!exercise) {
    return { success: false, error: 'Exercise not found' }
  }

  // Auto-assign order: max existing + 1
  const maxOrder = db
    .select({ maxOrder: sql<number>`coalesce(max(${exercise_slots.order}), 0)` })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, template_id))
    .get()

  const nextOrder = (maxOrder?.maxOrder ?? 0) + 1

  const created = db
    .insert(exercise_slots)
    .values({
      template_id,
      exercise_id,
      sets,
      reps: String(reps),
      weight: weight ?? null,
      rpe: rpe ?? null,
      rest_seconds: rest_seconds ?? null,
      guidelines: guidelines ?? null,
      order: nextOrder,
      created_at: new Date(),
    })
    .returning()
    .get()

  revalidatePath('/mesocycles')
  return { success: true, data: created }
}

// Update schema: all fields optional except id, with null support for clearing
const updateSlotSchema = z.object({
  id: positiveInt,
  sets: positiveInt.optional(),
  reps: positiveInt.optional(),
  weight: nonNegativeNumber.nullable().optional(),
  rpe: rpeRange.nullable().optional(),
  rest_seconds: nonNegativeInt.nullable().optional(),
  guidelines: z.string().nullable().optional(),
})

type UpdateExerciseSlotInput = {
  id: number
  sets?: number
  reps?: number
  weight?: number | null
  rpe?: number | null
  rest_seconds?: number | null
  guidelines?: string | null
}

export async function updateExerciseSlot(
  input: UpdateExerciseSlotInput
): Promise<SlotResult> {
  const parsed = updateSlotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { id, sets, reps, weight, rpe, rest_seconds, guidelines } = parsed.data

  // Verify slot exists
  const existing = db
    .select()
    .from(exercise_slots)
    .where(eq(exercise_slots.id, id))
    .get()

  if (!existing) {
    return { success: false, error: 'Slot not found' }
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (sets !== undefined) updates.sets = sets
  if (reps !== undefined) updates.reps = String(reps)
  if (weight !== undefined) updates.weight = weight
  if (rpe !== undefined) updates.rpe = rpe
  if (rest_seconds !== undefined) updates.rest_seconds = rest_seconds
  if (guidelines !== undefined) updates.guidelines = guidelines

  if (Object.keys(updates).length === 0) {
    return { success: true, data: existing }
  }

  const updated = db
    .update(exercise_slots)
    .set(updates)
    .where(eq(exercise_slots.id, id))
    .returning()
    .get()

  revalidatePath('/mesocycles')
  return { success: true, data: updated }
}

export async function removeExerciseSlot(slotId: number): Promise<RemoveResult> {
  if (!Number.isInteger(slotId) || slotId < 1) {
    return { success: false, error: 'Invalid slot ID' }
  }

  const existing = db
    .select()
    .from(exercise_slots)
    .where(eq(exercise_slots.id, slotId))
    .get()

  if (!existing) {
    return { success: false, error: 'Slot not found' }
  }

  db.delete(exercise_slots).where(eq(exercise_slots.id, slotId)).run()

  revalidatePath('/mesocycles')
  return { success: true }
}
