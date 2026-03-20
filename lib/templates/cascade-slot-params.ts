'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { exercise_slots, logged_workouts } from '@/lib/db/schema'
import { getCascadeTargets } from './cascade-queries'
import { findMatchingSlots, type SlotIdentifier } from './slot-matching'
import type { CascadeScope, CascadeSummary } from './cascade-types'

type SlotParamUpdates = {
  sets?: number
  reps?: number
  weight?: number | null
  rpe?: number | null
  rest_seconds?: number | null
  guidelines?: string | null
}

type CascadeSlotParamsInput = {
  slotId: number
  scope: CascadeScope
  updates: SlotParamUpdates
}

type CascadeSlotParamsResult =
  | { success: true; data: CascadeSummary }
  | { success: false; error: string }

export async function cascadeSlotParams(
  input: CascadeSlotParamsInput
): Promise<CascadeSlotParamsResult> {
  const { slotId, scope, updates } = input

  // Validate updates aren't empty
  const hasUpdates = Object.keys(updates).some((key) => {
    const val = updates[key as keyof SlotParamUpdates]
    return val !== undefined
  })
  if (!hasUpdates) {
    return { success: false, error: 'Nothing to update' }
  }

  // Look up source slot + its template
  const sourceSlot = db
    .select()
    .from(exercise_slots)
    .where(eq(exercise_slots.id, slotId))
    .get()

  if (!sourceSlot) {
    return { success: false, error: 'Slot not found' }
  }

  const templateId = sourceSlot.template_id

  // Build the SQL-level set fields from updates
  const setFields: Record<string, unknown> = {}
  if (updates.sets !== undefined) setFields.sets = updates.sets
  if (updates.reps !== undefined) setFields.reps = String(updates.reps)
  if (updates.weight !== undefined) setFields.weight = updates.weight
  if (updates.rpe !== undefined) setFields.rpe = updates.rpe
  if (updates.rest_seconds !== undefined) setFields.rest_seconds = updates.rest_seconds
  if (updates.guidelines !== undefined) setFields.guidelines = updates.guidelines

  // Get cascade targets (sibling templates via canonical_name)
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })
  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data
  const { skippedCompleted } = targetsResult

  // Build source slot identifier for matching
  const sourceSlotIdentifier: SlotIdentifier = {
    id: sourceSlot.id,
    exercise_id: sourceSlot.exercise_id,
    order: sourceSlot.order,
  }

  // Execute in a single transaction
  const summary = db.transaction((tx) => {
    // Find which target templates have logged workouts
    const targetIds = targets.map((t) => t.id)
    const loggedTemplateIds = tx
      .select({ template_id: logged_workouts.template_id })
      .from(logged_workouts)
      .where(inArray(logged_workouts.template_id, targetIds))
      .all()
      .map((r) => r.template_id)
      .filter((id): id is number => id !== null)

    const loggedSet = new Set(loggedTemplateIds)

    let updated = 0
    let skipped = 0

    for (const target of targets) {
      if (loggedSet.has(target.id)) {
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
        .where(eq(exercise_slots.template_id, target.id))
        .all()

      // Find matching slot using the slot matching utility
      const matchResult = findMatchingSlots([sourceSlotIdentifier], targetSlots)
      const match = matchResult.matches.get(sourceSlot.id)

      if (!match) {
        // No matching slot in this template — not counted as "skipped"
        continue
      }

      // Apply updates to the matched target slot
      tx.update(exercise_slots)
        .set(setFields)
        .where(eq(exercise_slots.id, match.targetSlotId))
        .run()

      updated++
    }

    return { updated, skipped, skippedCompleted }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: summary }
}
