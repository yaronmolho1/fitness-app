'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { exercise_slots, logged_workouts } from '@/lib/db/schema'
import { getCascadeTargets } from './cascade-queries'
import { findMatchingSlots } from './slot-matching'
import type { CascadeScope, CascadeSummary } from './cascade-types'

// Allowed slot fields — reject unknown keys from client input
const ALLOWED_SLOT_FIELDS = new Set(['sets', 'reps', 'weight', 'rpe', 'rest_seconds', 'guidelines'])

export type SlotEdit = {
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

  // Filter updates to allowed fields only (P2 security)
  const sanitizedEdits = edits.map(e => ({
    slotId: e.slotId,
    updates: Object.fromEntries(
      Object.entries(e.updates).filter(([key]) => ALLOWED_SLOT_FIELDS.has(key))
    ),
  })).filter(e => Object.keys(e.updates).length > 0)

  if (sanitizedEdits.length === 0) {
    return { success: false, error: 'No valid fields to update' }
  }

  // Build source slot identifiers from the edit list
  const sourceSlotIds = sanitizedEdits.map(e => e.slotId)
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
  const editsBySlotId = new Map(sanitizedEdits.map(e => [e.slotId, e.updates]))

  // Helper: build SQL set fields from an updates object
  function buildSetFields(updates: Record<string, unknown>): Record<string, unknown> {
    const setFields: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(updates)) {
      if (key === 'reps') {
        setFields.reps = String(val)
      } else {
        setFields[key] = val
      }
    }
    return setFields
  }

  // "this-only" — write source slots, no cascade to siblings
  if (scope === 'this-only') {
    db.transaction((tx) => {
      for (const edit of sanitizedEdits) {
        const setFields = buildSetFields(edit.updates)
        tx.update(exercise_slots)
          .set(setFields)
          .where(eq(exercise_slots.id, edit.slotId))
          .run()
      }
    })
    revalidatePath('/mesocycles')
    return { success: true, data: { updated: 0, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 } }
  }

  // Get cascade targets (sibling templates)
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })
  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data
  const { skippedCompleted } = targetsResult

  // Execute in a single transaction for atomicity (AC5)
  const summary = db.transaction((tx) => {
    // Write source slots first
    for (const edit of sanitizedEdits) {
      const setFields = buildSetFields(edit.updates)
      tx.update(exercise_slots)
        .set(setFields)
        .where(eq(exercise_slots.id, edit.slotId))
        .run()
    }

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

        const setFields = buildSetFields(slotUpdates)
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
