'use server'

import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { workout_templates, logged_workouts } from '@/lib/db/schema'
import { getCascadeTargets, getCascadePreview as getCascadePreviewQuery } from './cascade-queries'
import type { CascadeScope, CascadeUpdates, CascadePreviewResult, CascadeUpdateResult } from './cascade-types'

export type { CascadeScope, CascadeUpdates, CascadeSummary, CascadePreviewResult, CascadePreviewData, CascadeUpdateResult } from './cascade-types'

type CascadeUpdateInput = {
  templateId: number
  scope: CascadeScope
  updates: CascadeUpdates
}

// Server action wrapper for getCascadePreview — safe to call from client components
export async function getCascadePreview(
  templateId: number,
  scope: CascadeScope
): Promise<CascadePreviewResult> {
  return getCascadePreviewQuery(templateId, scope)
}

export async function cascadeUpdateTemplates(
  input: CascadeUpdateInput
): Promise<CascadeUpdateResult> {
  const { templateId, scope, updates } = input

  // Validate updates aren't empty
  const trimmedName = updates.name?.trim()
  const trimmedNotes = updates.notes !== undefined ? updates.notes.trim() : undefined

  const hasName = trimmedName !== undefined && trimmedName !== ''
  const hasNotes = trimmedNotes !== undefined

  // Running fields
  const hasRunType = updates.run_type !== undefined
  const hasTargetPace = 'target_pace' in updates
  const hasHrZone = 'hr_zone' in updates
  const hasIntervalCount = 'interval_count' in updates
  const hasIntervalRest = 'interval_rest' in updates
  const hasCoachingCues = 'coaching_cues' in updates
  const hasTargetDistance = 'target_distance' in updates
  const hasTargetDuration = 'target_duration' in updates

  // MMA fields
  const hasPlannedDuration = 'planned_duration' in updates

  const hasAnyField = hasName || hasNotes || hasRunType || hasTargetPace ||
    hasHrZone || hasIntervalCount || hasIntervalRest || hasCoachingCues ||
    hasTargetDistance || hasTargetDuration || hasPlannedDuration

  if (!hasAnyField) {
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
  const { skippedCompleted } = targetsResult

  // Build set of fields to update
  const setFields: Record<string, unknown> = {}
  if (hasName) setFields.name = trimmedName
  if (hasNotes) setFields.notes = trimmedNotes
  if (hasRunType) setFields.run_type = updates.run_type
  if (hasTargetPace) setFields.target_pace = updates.target_pace
  if (hasHrZone) setFields.hr_zone = updates.hr_zone
  if (hasIntervalCount) setFields.interval_count = updates.interval_count
  if (hasIntervalRest) setFields.interval_rest = updates.interval_rest
  if (hasCoachingCues) setFields.coaching_cues = updates.coaching_cues
  if (hasTargetDistance) setFields.target_distance = updates.target_distance
  if (hasTargetDuration) setFields.target_duration = updates.target_duration
  if (hasPlannedDuration) setFields.planned_duration = updates.planned_duration

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

    return { updated, skipped, skippedCompleted, skippedNoMatch: 0 }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: summary }
}
