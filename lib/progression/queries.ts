import { eq, asc } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { logged_workouts, logged_exercises, logged_sets, mesocycles, workout_templates } from '@/lib/db/schema'

type ProgressionParams = {
  canonicalName: string
  exerciseId?: number
}

type ProgressionDataPoint = {
  date: string
  mesocycleId: number | null
  mesocycleName: string | null
  plannedWeight: number | null
  actualWeight: number | null
  plannedVolume: number | null
  actualVolume: number | null
}

type ProgressionResult = {
  data: ProgressionDataPoint[]
}

type SnapshotSlot = {
  exercise_name: string
  target_sets: number
  target_reps: string
  target_weight: number | null
  is_main: boolean
}

type TemplateSnapshot = {
  version: number
  slots?: SnapshotSlot[]
}

export async function getProgressionData(
  database: AppDb,
  params: ProgressionParams
): Promise<ProgressionResult> {
  // Fetch all logged workouts matching canonical_name, ordered by date
  const workouts = database
    .select()
    .from(logged_workouts)
    .where(eq(logged_workouts.canonical_name, params.canonicalName))
    .orderBy(asc(logged_workouts.log_date))
    .all()

  if (workouts.length === 0) {
    return { data: [] }
  }

  const dataPoints: ProgressionDataPoint[] = []

  for (const workout of workouts) {
    // Get logged exercises for this workout, optionally filtered by exercise_id
    const exercises = database
      .select()
      .from(logged_exercises)
      .where(eq(logged_exercises.logged_workout_id, workout.id))
      .all()
      .filter((ex) => (params.exerciseId ? ex.exercise_id === params.exerciseId : true))

    if (exercises.length === 0) continue

    // Collect all sets across matching exercises
    const allSets: Array<{ actual_reps: number | null; actual_weight: number | null }> = []
    for (const ex of exercises) {
      const sets = database
        .select()
        .from(logged_sets)
        .where(eq(logged_sets.logged_exercise_id, ex.id))
        .all()
      allSets.push(...sets)
    }

    // Top-set weight: heaviest actual_weight across all sets
    const weights = allSets
      .map((s) => s.actual_weight)
      .filter((w): w is number => w !== null)
    const actualWeight = weights.length > 0 ? Math.max(...weights) : null

    // Actual volume: sum of (reps * weight) for each set
    const actualVolume = allSets.reduce((sum, s) => {
      if (s.actual_reps !== null && s.actual_weight !== null) {
        return sum + s.actual_reps * s.actual_weight
      }
      return sum
    }, 0) ?? null

    // Extract planned data from template_snapshot
    const snapshot = workout.template_snapshot as TemplateSnapshot
    let plannedWeight: number | null = null
    let plannedVolume: number | null = null

    if (snapshot?.slots) {
      // If exercise_id filter is active, match by exercise name from logged_exercises
      const exerciseNames = exercises.map((e) => e.exercise_name)
      const matchingSlots = params.exerciseId
        ? snapshot.slots.filter((s) => exerciseNames.includes(s.exercise_name))
        : snapshot.slots

      if (matchingSlots.length > 0) {
        // Planned weight: highest target_weight among matching slots
        const slotWeights = matchingSlots
          .map((s) => s.target_weight)
          .filter((w): w is number => w !== null)
        plannedWeight = slotWeights.length > 0 ? Math.max(...slotWeights) : null

        // Planned volume: sum of (target_sets * target_reps * target_weight) for matching slots
        plannedVolume = matchingSlots.reduce((sum, s) => {
          if (s.target_weight !== null) {
            const reps = parseInt(s.target_reps, 10) || 0
            return sum + s.target_sets * reps * s.target_weight
          }
          return sum
        }, 0) ?? null
      }
    }

    // Resolve mesocycle info via the template_id -> workout_templates -> mesocycles chain
    let mesocycleId: number | null = null
    let mesocycleName: string | null = null

    if (workout.template_id) {
      const template = database
        .select({ mesocycle_id: workout_templates.mesocycle_id })
        .from(workout_templates)
        .where(eq(workout_templates.id, workout.template_id))
        .get()

      if (template) {
        const meso = database
          .select({ id: mesocycles.id, name: mesocycles.name })
          .from(mesocycles)
          .where(eq(mesocycles.id, template.mesocycle_id))
          .get()

        if (meso) {
          mesocycleId = meso.id
          mesocycleName = meso.name
        }
      }
    }

    dataPoints.push({
      date: workout.log_date,
      mesocycleId,
      mesocycleName,
      plannedWeight,
      actualWeight,
      plannedVolume,
      actualVolume,
    })
  }

  return { data: dataPoints }
}
