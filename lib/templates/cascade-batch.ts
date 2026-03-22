'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { exercise_slots, logged_workouts } from '@/lib/db/schema'
import { getCascadeTargets } from './cascade-queries'
import { findMatchingSlots } from './slot-matching'
import type { CascadeScope, CascadeSummary } from './cascade-types'

type SlotEdit = {
  slotId: number
  updates: Record<string, unknown>
}

type BatchCascadeInput = {
  templateId: number
  scope: CascadeScope
  edits: SlotEdit[]
}

type BatchCascadeResult =
  | { success: true; data: CascadeSummary }
  | { success: false; error: string }

export async function batchCascadeSlotEdits(
  input: BatchCascadeInput
): Promise<BatchCascadeResult> {
  const { templateId, scope, edits } = input

  if (edits.length === 0) {
    return { success: false, error: 'Nothing to update' }
  }

  // "this-only" — local edits already applied, no cascade needed
  if (scope === 'this-only') {
    return { success: true, data: { updated: 0, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 } }
  }

  // Build source slot identifiers from the edit list
  const sourceSlotIds = edits.map(e => e.slotId)
  const sourceSlots = db
    .select({
      id: exercise_slots.id,
      exercise_id: exercise_slots.exercise_id,
      order: exercise_slots.order,
    })
    .from(exercise_slots)
    .where(inArray(exercise_slots.id, sourceSlotIds))
    .all()

  if (sourceSlots.length === 0) {
    return { success: false, error: 'No matching slots found' }
  }

  // Map slotId -> updates for quick lookup
  const editsBySlotId = new Map(edits.map(e => [e.slotId, e.updates]))

  // Get cascade targets (sibling templates)
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })
  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data
  const { skippedCompleted } = targetsResult

  // Execute in a single transaction for atomicity (AC5)
  const summary = db.transaction((tx) => {
    const targetIds = targets.map(t => t.id)
    const loggedTemplateIds = targetIds.length > 0
      ? tx
          .select({ template_id: logged_workouts.template_id })
          .from(logged_workouts)
          .where(inArray(logged_workouts.template_id, targetIds))
          .all()
          .map(r => r.template_id)
          .filter((id): id is number => id !== null)
      : []

    const loggedSet = new Set(loggedTemplateIds)

    let updated = 0
    let skipped = 0
    let skippedNoMatch = 0

    for (const target of targets) {
      if (loggedSet.has(target.id)) {
        skipped++
        continue
      }

      // Get target template's slots
      const targetSlots = tx
        .select({
          id: exercise_slots.id,
          exercise_id: exercise_slots.exercise_id,
          order: exercise_slots.order,
        })
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, target.id))
        .all()

      // Match all source slots to target slots
      const matchResult = findMatchingSlots(sourceSlots, targetSlots)

      let anyApplied = false
      let anyMissed = false

      for (const sourceSlot of sourceSlots) {
        const match = matchResult.matches.get(sourceSlot.id)
        const slotUpdates = editsBySlotId.get(sourceSlot.id)
        if (!slotUpdates) continue

        if (!match) {
          anyMissed = true
          continue
        }

        // Build SQL set fields
        const setFields: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(slotUpdates)) {
          if (key === 'reps') {
            setFields.reps = String(val)
          } else {
            setFields[key] = val
          }
        }

        tx.update(exercise_slots)
          .set(setFields)
          .where(eq(exercise_slots.id, match.targetSlotId))
          .run()

        anyApplied = true
      }

      if (anyApplied) {
        updated++
      }
      if (anyMissed && !anyApplied) {
        skippedNoMatch++
      }
    }

    return { updated, skipped, skippedCompleted, skippedNoMatch }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: summary }
}
