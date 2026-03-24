'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql, asc, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { exercise_slots, workout_templates, exercises, mesocycles, template_sections } from '@/lib/db/schema'

type SlotRow = typeof exercise_slots.$inferSelect

// Checks if the template's mesocycle is completed. Returns error string or null.
function checkCompletedMesocycle(templateId: number): string | null {
  const template = db
    .select({ mesocycle_id: workout_templates.mesocycle_id })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!template) return null // let caller handle not-found

  const meso = db
    .select({ status: mesocycles.status })
    .from(mesocycles)
    .where(eq(mesocycles.id, template.mesocycle_id))
    .get()

  if (meso?.status === 'completed') {
    return 'Cannot modify template on a completed mesocycle'
  }

  return null
}

type SlotResult =
  | { success: true; data: SlotRow }
  | { success: false; error: string }

type RemoveResult =
  | { success: true }
  | { success: false; error: string }

type ReorderResult =
  | { success: true; noop?: boolean }
  | { success: false; error: string }

// Shared field validators
const positiveInt = z.number().int().positive()
const nonNegativeNumber = z.number().min(0)
const nonNegativeInt = z.number().int().min(0)
const rpeRange = z.number().min(1).max(10)

const addSlotSchema = z.object({
  template_id: positiveInt,
  exercise_id: positiveInt,
  section_id: positiveInt.optional(),
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
  section_id?: number
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

  const { template_id, exercise_id, section_id, sets, reps, weight, rpe, rest_seconds, guidelines } = parsed.data

  // Verify template exists
  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, template_id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  const completedError = checkCompletedMesocycle(template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Verify section exists and belongs to this template
  if (section_id !== undefined) {
    const section = db
      .select()
      .from(template_sections)
      .where(and(eq(template_sections.id, section_id), eq(template_sections.template_id, template_id)))
      .get()

    if (!section) {
      return { success: false, error: 'Section not found or does not belong to this template' }
    }
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
      section_id: section_id ?? null,
      sets,
      reps: String(reps), // stored as text to support future range notation (e.g. "8-12")
      weight: weight ?? null,
      rpe: rpe ?? null,
      rest_seconds: rest_seconds ?? null,
      guidelines: guidelines ?? null,
      is_main: false,
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

  const completedError = checkCompletedMesocycle(existing.template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (sets !== undefined) updates.sets = sets
  if (reps !== undefined) updates.reps = String(reps) // text for future range notation
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

export async function toggleSlotRole(slotId: number): Promise<SlotResult> {
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

  const completedError = checkCompletedMesocycle(existing.template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  const updated = db
    .update(exercise_slots)
    .set({ is_main: !existing.is_main })
    .where(eq(exercise_slots.id, slotId))
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

  const completedError = checkCompletedMesocycle(existing.template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  db.delete(exercise_slots).where(eq(exercise_slots.id, slotId)).run()

  revalidatePath('/mesocycles')
  return { success: true }
}

const reorderSchema = z.object({
  template_id: positiveInt,
  slot_ids: z.array(positiveInt).min(1),
})

type ReorderExerciseSlotsInput = {
  template_id: number
  slot_ids: number[]
}

export async function reorderExerciseSlots(
  input: ReorderExerciseSlotsInput
): Promise<ReorderResult> {
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { template_id, slot_ids } = parsed.data

  // Verify template exists
  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, template_id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  const completedError = checkCompletedMesocycle(template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Get current slots for this template
  const currentSlots = db
    .select({ id: exercise_slots.id, order: exercise_slots.order })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, template_id))
    .orderBy(asc(exercise_slots.order))
    .all()

  // Verify slot_ids match exactly
  const currentIds = new Set(currentSlots.map(s => s.id))
  const inputIds = new Set(slot_ids)

  if (currentIds.size !== inputIds.size || ![...currentIds].every(id => inputIds.has(id))) {
    return { success: false, error: 'Slot IDs mismatch: must include all template slots' }
  }

  // Check if order is actually changing
  const currentOrder = currentSlots.map(s => s.id)
  const isUnchanged = slot_ids.every((id, i) => id === currentOrder[i])
  if (isUnchanged) {
    return { success: true, noop: true }
  }

  // Update order values atomically
  db.transaction((tx) => {
    for (let i = 0; i < slot_ids.length; i++) {
      tx.update(exercise_slots)
        .set({ order: i + 1 })
        .where(eq(exercise_slots.id, slot_ids[i]))
        .run()
    }
  })

  revalidatePath('/mesocycles')
  return { success: true }
}
