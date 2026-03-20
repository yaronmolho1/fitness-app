'use server'

import { eq, inArray, asc, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { exercise_slots, logged_workouts } from '@/lib/db/schema'
import { getCascadeTargets } from './cascade-queries'
import { findMatchingSlots, type SlotIdentifier } from './slot-matching'
import type { CascadeScope, CascadeSummary } from './cascade-types'

type CascadeSlotOpsResult =
  | { success: true; data: CascadeSummary }
  | { success: false; error: string }

// --- Cascade Add Slot ---

type CascadeAddSlotInput = {
  sourceSlotId: number
  scope: CascadeScope
}

export async function cascadeAddSlot(
  input: CascadeAddSlotInput
): Promise<CascadeSlotOpsResult> {
  const { sourceSlotId, scope } = input

  // "this-only" means the slot was already added locally — no cascade needed
  if (scope === 'this-only') {
    return { success: true, data: { updated: 0, skipped: 0, skippedCompleted: 0 } }
  }

  // Look up source slot
  const sourceSlot = db
    .select()
    .from(exercise_slots)
    .where(eq(exercise_slots.id, sourceSlotId))
    .get()

  if (!sourceSlot) {
    return { success: false, error: 'Slot not found' }
  }

  const templateId = sourceSlot.template_id

  // Get cascade targets (sibling templates)
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })
  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data
  const { skippedCompleted } = targetsResult

  // Filter out the source template — we only add to siblings
  const siblings = targets.filter((t) => t.id !== templateId)

  const summary = db.transaction((tx) => {
    // Find which target templates have logged workouts
    const siblingIds = siblings.map((t) => t.id)
    const loggedTemplateIds = siblingIds.length > 0
      ? tx
          .select({ template_id: logged_workouts.template_id })
          .from(logged_workouts)
          .where(inArray(logged_workouts.template_id, siblingIds))
          .all()
          .map((r) => r.template_id)
          .filter((id): id is number => id !== null)
      : []

    const loggedSet = new Set(loggedTemplateIds)

    let updated = 0
    let skipped = 0

    for (const sibling of siblings) {
      if (loggedSet.has(sibling.id)) {
        skipped++
        continue
      }

      // Check if target order position is occupied
      const maxOrder = tx
        .select({ maxOrder: sql<number>`coalesce(max(${exercise_slots.order}), 0)` })
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, sibling.id))
        .get()

      const currentMax = maxOrder?.maxOrder ?? 0

      // If target order is occupied, append at end; otherwise use same order
      const targetOrder = sourceSlot.order <= currentMax
        ? currentMax + 1
        : sourceSlot.order

      tx.insert(exercise_slots)
        .values({
          template_id: sibling.id,
          exercise_id: sourceSlot.exercise_id,
          sets: sourceSlot.sets,
          reps: sourceSlot.reps,
          weight: sourceSlot.weight,
          rpe: sourceSlot.rpe,
          rest_seconds: sourceSlot.rest_seconds,
          guidelines: sourceSlot.guidelines,
          order: targetOrder,
          is_main: sourceSlot.is_main,
          created_at: new Date(),
        })
        .run()

      updated++
    }

    return { updated, skipped, skippedCompleted }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: summary }
}

// --- Cascade Remove Slot ---

type CascadeRemoveSlotInput = {
  sourceExerciseId: number
  sourceOrder: number
  templateId: number
  scope: CascadeScope
}

export async function cascadeRemoveSlot(
  input: CascadeRemoveSlotInput
): Promise<CascadeSlotOpsResult> {
  const { sourceExerciseId, sourceOrder, templateId, scope } = input

  // "this-only" means the slot was already removed locally — no cascade needed
  if (scope === 'this-only') {
    return { success: true, data: { updated: 0, skipped: 0, skippedCompleted: 0 } }
  }

  // Get cascade targets (sibling templates)
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })
  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data
  const { skippedCompleted } = targetsResult

  // Filter out the source template — we only remove from siblings
  const siblings = targets.filter((t) => t.id !== templateId)

  // Build source slot identifier for matching
  const sourceIdentifier: SlotIdentifier = {
    id: 0, // placeholder — we use exercise_id + order for matching
    exercise_id: sourceExerciseId,
    order: sourceOrder,
  }

  const summary = db.transaction((tx) => {
    // Find which target templates have logged workouts
    const siblingIds = siblings.map((t) => t.id)
    const loggedTemplateIds = siblingIds.length > 0
      ? tx
          .select({ template_id: logged_workouts.template_id })
          .from(logged_workouts)
          .where(inArray(logged_workouts.template_id, siblingIds))
          .all()
          .map((r) => r.template_id)
          .filter((id): id is number => id !== null)
      : []

    const loggedSet = new Set(loggedTemplateIds)

    let updated = 0
    let skipped = 0

    for (const sibling of siblings) {
      if (loggedSet.has(sibling.id)) {
        skipped++
        continue
      }

      // Get slots for this target template
      const targetSlots = tx
        .select({
          id: exercise_slots.id,
          exercise_id: exercise_slots.exercise_id,
          order: exercise_slots.order,
        })
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, sibling.id))
        .all()

      // Find matching slot using slot matching utility
      const matchResult = findMatchingSlots([sourceIdentifier], targetSlots)
      const match = matchResult.matches.get(sourceIdentifier.id)

      if (!match) {
        // No matching slot — skip silently (not counted as "skipped")
        continue
      }

      // Delete the matched slot
      tx.delete(exercise_slots)
        .where(eq(exercise_slots.id, match.targetSlotId))
        .run()

      // Re-order remaining slots to fill gaps
      const remaining = tx
        .select({ id: exercise_slots.id })
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, sibling.id))
        .orderBy(asc(exercise_slots.order))
        .all()

      for (let i = 0; i < remaining.length; i++) {
        tx.update(exercise_slots)
          .set({ order: i + 1 })
          .where(eq(exercise_slots.id, remaining[i].id))
          .run()
      }

      updated++
    }

    return { updated, skipped, skippedCompleted }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: summary }
}
