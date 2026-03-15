import { eq, and, ne, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { workout_templates, mesocycles, logged_workouts } from '@/lib/db/schema'
import type { CascadeScope, CascadePreviewResult, CascadePreviewTarget } from './cascade-types'

export type { CascadeScope, CascadePreviewData, CascadePreviewResult, CascadePreviewTarget } from './cascade-types'

type TemplateTarget = {
  id: number
  mesocycle_id: number
  canonical_name: string
}

type CascadeResult =
  | { success: true; data: TemplateTarget[] }
  | { success: false; error: string }

/**
 * Find cascade sibling templates for a given template and scope.
 * Used by the cascade edit SA (T036) to determine which templates to update.
 */
export async function getCascadeTargets(
  templateId: number,
  scope: CascadeScope,
  options?: { includeLogged?: boolean }
): Promise<CascadeResult> {
  // Look up the source template
  const source = db
    .select({
      id: workout_templates.id,
      mesocycle_id: workout_templates.mesocycle_id,
      canonical_name: workout_templates.canonical_name,
    })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!source) {
    return { success: false, error: 'Template not found' }
  }

  // "this-only" always returns just the source
  if (scope === 'this-only') {
    return { success: true, data: [source] }
  }

  // Base query: siblings with same canonical_name in non-completed mesocycles
  const templateColumns = {
    id: workout_templates.id,
    mesocycle_id: workout_templates.mesocycle_id,
    canonical_name: workout_templates.canonical_name,
  }

  let siblings: TemplateTarget[]

  if (scope === 'all-phases') {
    siblings = db
      .select(templateColumns)
      .from(workout_templates)
      .innerJoin(mesocycles, eq(workout_templates.mesocycle_id, mesocycles.id))
      .where(
        and(
          eq(workout_templates.canonical_name, source.canonical_name),
          ne(mesocycles.status, 'completed')
        )
      )
      .all()
  } else {
    // this-and-future: source mesocycle + mesocycles created at/after it
    const sourceMeso = db
      .select({ created_at: mesocycles.created_at })
      .from(mesocycles)
      .where(eq(mesocycles.id, source.mesocycle_id))
      .get()

    if (!sourceMeso) {
      return { success: false, error: 'Source mesocycle not found' }
    }

    const sourceCreatedAt = sourceMeso.created_at?.getTime() ?? 0

    siblings = db
      .select(templateColumns)
      .from(workout_templates)
      .innerJoin(mesocycles, eq(workout_templates.mesocycle_id, mesocycles.id))
      .where(
        and(
          eq(workout_templates.canonical_name, source.canonical_name),
          ne(mesocycles.status, 'completed'),
          gte(mesocycles.created_at, new Date(sourceCreatedAt))
        )
      )
      .all()
  }

  // When includeLogged is true, return all targets without filtering.
  // The execution layer (T036 SA) handles logged-workout skipping
  // inside its transaction for atomicity.
  if (options?.includeLogged) {
    return { success: true, data: siblings.length > 0 ? siblings : [source] }
  }

  // Exclude templates that have logged workouts (but always keep source)
  const siblingIds = siblings.map((s) => s.id)
  if (siblingIds.length === 0) {
    return { success: true, data: [source] }
  }

  const loggedTemplateIds = db
    .select({ template_id: logged_workouts.template_id })
    .from(logged_workouts)
    .where(inArray(logged_workouts.template_id, siblingIds))
    .all()
    .map((r) => r.template_id)
    .filter((id): id is number => id !== null)

  const loggedSet = new Set(loggedTemplateIds)

  // Source is always kept even if it has logged workouts —
  // the execution layer (T036 SA) decides how to handle it.
  const filtered = siblings.filter(
    (t) => t.id === source.id || !loggedSet.has(t.id)
  )

  return { success: true, data: filtered }
}


/**
 * Fetch a preview of cascade targets with mesocycle names and logged-workout flags.
 * Used by the cascade scope selection UI (T037) to show what will be affected.
 */
export async function getCascadePreview(
  templateId: number,
  scope: CascadeScope
): Promise<CascadePreviewResult> {
  // Get all targets including those with logged workouts for the preview
  const targetsResult = await getCascadeTargets(templateId, scope, { includeLogged: true })

  if (!targetsResult.success) {
    return { success: false, error: targetsResult.error }
  }

  const targets = targetsResult.data

  // Fetch mesocycle names for all targets
  const mesoIds = [...new Set(targets.map((t) => t.mesocycle_id))]
  const mesoRows = mesoIds.length > 0
    ? db
        .select({ id: mesocycles.id, name: mesocycles.name })
        .from(mesocycles)
        .where(inArray(mesocycles.id, mesoIds))
        .all()
    : []

  const mesoNameMap = new Map(mesoRows.map((m) => [m.id, m.name]))

  // Find which targets have logged workouts
  const targetIds = targets.map((t) => t.id)
  const loggedTemplateIds = targetIds.length > 0
    ? db
        .select({ template_id: logged_workouts.template_id })
        .from(logged_workouts)
        .where(inArray(logged_workouts.template_id, targetIds))
        .all()
        .map((r) => r.template_id)
        .filter((id): id is number => id !== null)
    : []

  const loggedSet = new Set(loggedTemplateIds)

  const previewTargets: CascadePreviewTarget[] = targets.map((t) => ({
    id: t.id,
    mesocycleId: t.mesocycle_id,
    mesocycleName: mesoNameMap.get(t.mesocycle_id) ?? 'Unknown',
    hasLoggedWorkouts: loggedSet.has(t.id),
  }))

  const skippedCount = previewTargets.filter((t) => t.hasLoggedWorkouts).length

  return {
    success: true,
    data: {
      totalTargets: previewTargets.length,
      skippedCount,
      targets: previewTargets,
    },
  }
}
