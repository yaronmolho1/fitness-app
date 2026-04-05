'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { exercise_slots, workout_templates, mesocycles } from '@/lib/db/schema'
import { recomputeEstimatedDuration } from './recompute-duration'

type ActionResult =
  | { success: true }
  | { success: false; error: string }

// Checks if the template's mesocycle is completed
function checkCompletedMesocycle(templateId: number): string | null {
  const template = db
    .select({ mesocycle_id: workout_templates.mesocycle_id })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!template) return null

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

// Next available group_id for a template (max existing + 1, or 1)
function nextGroupId(templateId: number): number {
  const result = db
    .select({
      maxGroup: sql<number>`coalesce(max(${exercise_slots.group_id}), 0)`,
    })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, templateId))
    .get()

  return (result?.maxGroup ?? 0) + 1
}

const positiveInt = z.number().int().positive()
const nonNegativeInt = z.number().int().min(0)

const createSupersetSchema = z.object({
  slot_ids: z.array(positiveInt).min(2, 'Need at least 2 slots to create a superset'),
  group_rest_seconds: nonNegativeInt,
})

type CreateSupersetInput = {
  slot_ids: number[]
  group_rest_seconds: number
}

export async function createSuperset(
  input: CreateSupersetInput
): Promise<ActionResult> {
  const parsed = createSupersetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { slot_ids, group_rest_seconds } = parsed.data

  // Fetch all requested slots
  const slots = slot_ids.map((id) => {
    return db
      .select()
      .from(exercise_slots)
      .where(eq(exercise_slots.id, id))
      .get()
  })

  // Check all slots exist
  if (slots.some((s) => !s)) {
    return { success: false, error: 'One or more slots not found' }
  }

  // All slots must be from same template
  const templateIds = new Set(slots.map((s) => s!.template_id))
  if (templateIds.size !== 1) {
    return { success: false, error: 'All slots must be from the same template' }
  }

  const templateId = slots[0]!.template_id

  // Check completed mesocycle
  const completedError = checkCompletedMesocycle(templateId)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Check none already grouped
  if (slots.some((s) => s!.group_id !== null)) {
    return { success: false, error: 'One or more slots already in a group' }
  }

  // Check contiguity: sort by order, verify sequential
  const sorted = [...slots].sort((a, b) => a!.order - b!.order)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.order !== sorted[i - 1]!.order + 1) {
      return { success: false, error: 'Slots must be contiguous in order' }
    }
  }

  const groupId = nextGroupId(templateId)

  // Update all slots atomically
  db.transaction((tx) => {
    for (const slot of slots) {
      tx.update(exercise_slots)
        .set({ group_id: groupId, group_rest_seconds })
        .where(eq(exercise_slots.id, slot!.id))
        .run()
    }
  })

  recomputeEstimatedDuration(templateId)
  revalidatePath('/mesocycles')
  return { success: true }
}

const breakSupersetSchema = z.object({
  group_id: positiveInt,
  template_id: positiveInt,
})

type BreakSupersetInput = {
  group_id: number
  template_id: number
}

export async function breakSuperset(
  input: BreakSupersetInput
): Promise<ActionResult> {
  const parsed = breakSupersetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { group_id, template_id } = parsed.data

  // Check completed mesocycle
  const completedError = checkCompletedMesocycle(template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Find slots with this group_id in this template
  const grouped = db
    .select({ id: exercise_slots.id })
    .from(exercise_slots)
    .where(
      and(
        eq(exercise_slots.template_id, template_id),
        eq(exercise_slots.group_id, group_id)
      )
    )
    .all()

  if (grouped.length === 0) {
    return { success: false, error: 'No slots found for this group' }
  }

  // Null out group fields
  db.transaction((tx) => {
    for (const slot of grouped) {
      tx.update(exercise_slots)
        .set({ group_id: null, group_rest_seconds: null })
        .where(eq(exercise_slots.id, slot.id))
        .run()
    }
  })

  recomputeEstimatedDuration(template_id)
  revalidatePath('/mesocycles')
  return { success: true }
}

const updateGroupRestSchema = z.object({
  group_id: positiveInt,
  template_id: positiveInt,
  group_rest_seconds: nonNegativeInt,
})

type UpdateGroupRestInput = {
  group_id: number
  template_id: number
  group_rest_seconds: number
}

export async function updateGroupRest(
  input: UpdateGroupRestInput
): Promise<ActionResult> {
  const parsed = updateGroupRestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { group_id, template_id, group_rest_seconds } = parsed.data

  // Check completed mesocycle
  const completedError = checkCompletedMesocycle(template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Find slots with this group_id in this template
  const grouped = db
    .select({ id: exercise_slots.id })
    .from(exercise_slots)
    .where(
      and(
        eq(exercise_slots.template_id, template_id),
        eq(exercise_slots.group_id, group_id)
      )
    )
    .all()

  if (grouped.length === 0) {
    return { success: false, error: 'No slots found for this group' }
  }

  // Update group_rest_seconds on all members
  db.transaction((tx) => {
    for (const slot of grouped) {
      tx.update(exercise_slots)
        .set({ group_rest_seconds })
        .where(eq(exercise_slots.id, slot.id))
        .run()
    }
  })

  recomputeEstimatedDuration(template_id)
  revalidatePath('/mesocycles')
  return { success: true }
}
