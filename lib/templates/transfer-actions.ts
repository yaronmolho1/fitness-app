'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, sql, asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import {
  exercise_slots,
  workout_templates,
  mesocycles,
  template_sections,
} from '@/lib/db/schema'

type SlotRow = typeof exercise_slots.$inferSelect

type TransferResult =
  | { success: true; data: SlotRow[] }
  | { success: false; error: string }

const positiveInt = z.number().int().positive()

const transferSchema = z.object({
  slotIds: z.array(positiveInt).min(1),
  targetTemplateId: positiveInt,
  targetSectionId: positiveInt.optional(),
})

type TransferInput = {
  slotIds: number[]
  targetTemplateId: number
  targetSectionId?: number
}

// Resolve mesocycle status for a template. Returns null if template not found.
function getMesoStatus(templateId: number): string | null {
  const tmpl = db
    .select({ mesocycle_id: workout_templates.mesocycle_id })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!tmpl) return null

  const meso = db
    .select({ status: mesocycles.status })
    .from(mesocycles)
    .where(eq(mesocycles.id, tmpl.mesocycle_id))
    .get()

  return meso?.status ?? null
}

// Determine if the transfer involves a full superset group or partial
function isFullGroupTransfer(
  slotIds: number[],
  slots: SlotRow[]
): boolean {
  const groupIds = new Set(
    slots.filter(s => s.group_id !== null).map(s => s.group_id)
  )
  if (groupIds.size === 0) return false

  // For each group represented, check if ALL members are included
  for (const gid of groupIds) {
    const allMembers = db
      .select({ id: exercise_slots.id })
      .from(exercise_slots)
      .where(
        and(
          eq(exercise_slots.template_id, slots[0].template_id),
          eq(exercise_slots.group_id, gid!)
        )
      )
      .all()

    const memberIds = new Set(allMembers.map(m => m.id))
    const transferredFromGroup = slotIds.filter(id => memberIds.has(id))
    if (transferredFromGroup.length !== allMembers.length) return false
  }
  return true
}

// Get next group_id for a template (max existing + 1)
function nextGroupIdForTemplate(templateId: number): number {
  const result = db
    .select({
      maxGroup: sql<number>`coalesce(max(${exercise_slots.group_id}), 0)`,
    })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, templateId))
    .get()

  return (result?.maxGroup ?? 0) + 1
}

// Get max order in target template
function maxOrderInTemplate(templateId: number): number {
  const result = db
    .select({
      maxOrder: sql<number>`coalesce(max(${exercise_slots.order}), 0)`,
    })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, templateId))
    .get()

  return result?.maxOrder ?? 0
}

export async function copyExerciseSlots(
  input: TransferInput
): Promise<TransferResult> {
  const parsed = transferSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { slotIds, targetTemplateId, targetSectionId } = parsed.data

  // Validate target template exists
  const target = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, targetTemplateId))
    .get()

  if (!target) {
    return { success: false, error: 'Target template not found' }
  }

  // Validate target meso not completed
  const targetStatus = getMesoStatus(targetTemplateId)
  if (targetStatus === 'completed') {
    return { success: false, error: 'Cannot copy to a completed mesocycle' }
  }

  // Validate targetSectionId if provided
  if (targetSectionId !== undefined) {
    const section = db
      .select()
      .from(template_sections)
      .where(
        and(
          eq(template_sections.id, targetSectionId),
          eq(template_sections.template_id, targetTemplateId)
        )
      )
      .get()

    if (!section) {
      return { success: false, error: 'Target section not found or does not belong to target template' }
    }
  }

  // Fetch source slots
  const sourceSlots = slotIds.map(id =>
    db.select().from(exercise_slots).where(eq(exercise_slots.id, id)).get()
  )

  if (sourceSlots.some(s => !s)) {
    return { success: false, error: 'One or more slots not found' }
  }

  const slots = sourceSlots as SlotRow[]

  // All slots must belong to the same source template
  if (new Set(slots.map(s => s.template_id)).size > 1) {
    return { success: false, error: 'All slots must belong to the same template' }
  }

  // Determine group handling
  const fullGroup = isFullGroupTransfer(slotIds, slots)

  try {
    const created = db.transaction((tx) => {
      let currentOrder = maxOrderInTemplate(targetTemplateId)

      // Build group_id remap for full group transfers
      const groupIdMap = new Map<number, number>()
      if (fullGroup) {
        let nextGid = nextGroupIdForTemplate(targetTemplateId)
        for (const slot of slots) {
          if (slot.group_id !== null && !groupIdMap.has(slot.group_id)) {
            groupIdMap.set(slot.group_id, nextGid++)
          }
        }
      }

      const results: SlotRow[] = []

      for (const slot of slots) {
        currentOrder++

        const newGroupId = fullGroup && slot.group_id !== null
          ? groupIdMap.get(slot.group_id) ?? null
          : null

        const newGroupRest = fullGroup && slot.group_id !== null
          ? slot.group_rest_seconds
          : null

        const newSectionId = targetSectionId ?? null

        const created = tx
          .insert(exercise_slots)
          .values({
            template_id: targetTemplateId,
            exercise_id: slot.exercise_id,
            section_id: newSectionId,
            sets: slot.sets,
            reps: slot.reps,
            weight: slot.weight,
            rpe: slot.rpe,
            rest_seconds: slot.rest_seconds,
            group_id: newGroupId,
            group_rest_seconds: newGroupRest,
            guidelines: slot.guidelines,
            order: currentOrder,
            is_main: slot.is_main,
            created_at: new Date(),
          })
          .returning()
          .get()

        results.push(created)
      }

      return results
    })

    revalidatePath('/mesocycles')
    return { success: true, data: created }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to copy slots: ${msg}` }
  }
}

export async function moveExerciseSlots(
  input: TransferInput
): Promise<TransferResult> {
  const parsed = transferSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { slotIds, targetTemplateId, targetSectionId } = parsed.data

  // Fetch source slots to determine source template
  const sourceSlots = slotIds.map(id =>
    db.select().from(exercise_slots).where(eq(exercise_slots.id, id)).get()
  )

  if (sourceSlots.some(s => !s)) {
    return { success: false, error: 'One or more slots not found' }
  }

  const slots = sourceSlots as SlotRow[]

  // All slots must belong to the same source template
  if (new Set(slots.map(s => s.template_id)).size > 1) {
    return { success: false, error: 'All slots must belong to the same template' }
  }

  // Validate source meso not completed (move is destructive)
  const sourceStatus = getMesoStatus(slots[0].template_id)
  if (sourceStatus === 'completed') {
    return { success: false, error: 'Cannot move from a completed mesocycle' }
  }

  // Validate target template exists
  const target = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, targetTemplateId))
    .get()

  if (!target) {
    return { success: false, error: 'Target template not found' }
  }

  // Validate target meso not completed
  const targetStatus = getMesoStatus(targetTemplateId)
  if (targetStatus === 'completed') {
    return { success: false, error: 'Cannot move to a completed mesocycle' }
  }

  // Validate targetSectionId if provided
  if (targetSectionId !== undefined) {
    const section = db
      .select()
      .from(template_sections)
      .where(
        and(
          eq(template_sections.id, targetSectionId),
          eq(template_sections.template_id, targetTemplateId)
        )
      )
      .get()

    if (!section) {
      return { success: false, error: 'Target section not found or does not belong to target template' }
    }
  }

  const fullGroup = isFullGroupTransfer(slotIds, slots)
  const sourceTemplateId = slots[0].template_id

  try {
    const created = db.transaction((tx) => {
      let currentOrder = maxOrderInTemplate(targetTemplateId)

      // Build group_id remap
      const groupIdMap = new Map<number, number>()
      if (fullGroup) {
        let nextGid = nextGroupIdForTemplate(targetTemplateId)
        for (const slot of slots) {
          if (slot.group_id !== null && !groupIdMap.has(slot.group_id)) {
            groupIdMap.set(slot.group_id, nextGid++)
          }
        }
      }

      const results: SlotRow[] = []

      // Copy slots to target
      for (const slot of slots) {
        currentOrder++

        const newGroupId = fullGroup && slot.group_id !== null
          ? groupIdMap.get(slot.group_id) ?? null
          : null

        const newGroupRest = fullGroup && slot.group_id !== null
          ? slot.group_rest_seconds
          : null

        const newSectionId = targetSectionId ?? null

        const inserted = tx
          .insert(exercise_slots)
          .values({
            template_id: targetTemplateId,
            exercise_id: slot.exercise_id,
            section_id: newSectionId,
            sets: slot.sets,
            reps: slot.reps,
            weight: slot.weight,
            rpe: slot.rpe,
            rest_seconds: slot.rest_seconds,
            group_id: newGroupId,
            group_rest_seconds: newGroupRest,
            guidelines: slot.guidelines,
            order: currentOrder,
            is_main: slot.is_main,
            created_at: new Date(),
          })
          .returning()
          .get()

        results.push(inserted)
      }

      // Delete source slots
      for (const slot of slots) {
        tx.delete(exercise_slots)
          .where(eq(exercise_slots.id, slot.id))
          .run()
      }

      // Reorder remaining source slots
      const remaining = tx
        .select({ id: exercise_slots.id })
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, sourceTemplateId))
        .orderBy(asc(exercise_slots.order))
        .all()

      for (let i = 0; i < remaining.length; i++) {
        tx.update(exercise_slots)
          .set({ order: i + 1 })
          .where(eq(exercise_slots.id, remaining[i].id))
          .run()
      }

      return results
    })

    revalidatePath('/mesocycles')
    return { success: true, data: created }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to move slots: ${msg}` }
  }
}
