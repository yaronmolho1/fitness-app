'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { workout_templates, logged_workouts } from '@/lib/db/schema'
import { getCascadeTargets, type CascadeScope } from './cascade-queries'

export type CascadeUpdates = {
  name?: string
  notes?: string
}

export type CascadeSummary = {
  updated: number
  skipped: number
}

type CascadeUpdateResult =
  | { success: true; data: CascadeSummary }
  | { success: false; error: string }

type CascadeUpdateInput = {
  templateId: number
  scope: CascadeScope
  updates: CascadeUpdates
}

export async function cascadeUpdateTemplates(
  input: CascadeUpdateInput
): Promise<CascadeUpdateResult> {
  const { templateId, scope, updates } = input

  // Validate updates aren't empty
  const trimmedName = updates.name?.trim()
  const trimmedNotes = updates.notes?.trim()

  const hasName = trimmedName !== undefined && trimmedName !== ''
  const hasNotes = trimmedNotes !== undefined

  if (!hasName && !hasNotes) {
    return { success: false, error: 'Nothing to update' }
  }

  // Validate name if provided
  if (updates.name !== undefined && !hasName) {
    return { success: false, error: 'Name is required' }
  }

  // Get all cascade targets (including those with logged workouts).
  // Logged-workout filtering happens inside the transaction for atomicity.
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })

  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data

  // Build set of fields to update
  const setFields: Record<string, unknown> = {}
  if (hasName) setFields.name = trimmedName
  if (hasNotes) setFields.notes = trimmedNotes

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

      tx.update(workout_templates)
        .set(setFields)
        .where(eq(workout_templates.id, target.id))
        .run()

      updated++
    }

    return { updated, skipped }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: summary }
}
