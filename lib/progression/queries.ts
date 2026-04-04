import { eq, asc } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { logged_workouts, logged_exercises, logged_sets, mesocycles, workout_templates } from '@/lib/db/schema'

type ProgressionParams = {
  exerciseId: number
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

type Phase = {
  mesocycleId: number
  mesocycleName: string
  startDate: string
  endDate: string
}

type ProgressionResult = {
  data: ProgressionDataPoint[]
  phases: Phase[]
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
  // Query logged_exercises by exercise_id, join to logged_workouts for date/snapshot
  const rows = database
    .select({
      exerciseId: logged_exercises.id,
      exerciseName: logged_exercises.exercise_name,
      loggedWorkoutId: logged_exercises.logged_workout_id,
      logDate: logged_workouts.log_date,
      templateId: logged_workouts.template_id,
      templateSnapshot: logged_workouts.template_snapshot,
    })
    .from(logged_exercises)
    .innerJoin(logged_workouts, eq(logged_exercises.logged_workout_id, logged_workouts.id))
    .where(eq(logged_exercises.exercise_id, params.exerciseId))
    .orderBy(asc(logged_workouts.log_date))
    .all()

  if (rows.length === 0) {
    return { data: [], phases: [] }
  }

  const dataPoints: ProgressionDataPoint[] = []

  for (const row of rows) {
    // Get sets for this logged exercise
    const sets = database
      .select()
      .from(logged_sets)
      .where(eq(logged_sets.logged_exercise_id, row.exerciseId))
      .all()

    // Top-set weight: heaviest actual_weight across all sets
    const weights = sets
      .map((s) => s.actual_weight)
      .filter((w): w is number => w !== null)
    const actualWeight = weights.length > 0 ? Math.max(...weights) : null

    // Actual volume: sum of (reps * weight) for each set
    const actualVolume = sets.reduce((sum, s) => {
      if (s.actual_reps !== null && s.actual_weight !== null) {
        return sum + s.actual_reps * s.actual_weight
      }
      return sum
    }, 0) ?? null

    // Extract planned data from template_snapshot
    const snapshot = row.templateSnapshot as TemplateSnapshot
    let plannedWeight: number | null = null
    let plannedVolume: number | null = null

    if (snapshot?.slots) {
      const matchingSlots = snapshot.slots.filter(
        (s) => s.exercise_name === row.exerciseName
      )

      if (matchingSlots.length > 0) {
        const slotWeights = matchingSlots
          .map((s) => s.target_weight)
          .filter((w): w is number => w !== null)
        plannedWeight = slotWeights.length > 0 ? Math.max(...slotWeights) : null

        plannedVolume = matchingSlots.reduce((sum, s) => {
          if (s.target_weight !== null) {
            const reps = parseInt(s.target_reps, 10) || 0
            return sum + s.target_sets * reps * s.target_weight
          }
          return sum
        }, 0) ?? null
      }
    }

    // Resolve mesocycle info via template_id -> workout_templates -> mesocycles
    let mesocycleId: number | null = null
    let mesocycleName: string | null = null

    if (row.templateId) {
      const template = database
        .select({ mesocycle_id: workout_templates.mesocycle_id })
        .from(workout_templates)
        .where(eq(workout_templates.id, row.templateId))
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
      date: row.logDate,
      mesocycleId,
      mesocycleName,
      plannedWeight,
      actualWeight,
      plannedVolume,
      actualVolume,
    })
  }

  // Build phases from mesocycles that have data points
  const seenMesocycleIds = new Set(
    dataPoints.map((d) => d.mesocycleId).filter((id): id is number => id !== null)
  )

  const phases: Phase[] = []
  for (const mesoId of seenMesocycleIds) {
    const meso = database
      .select({
        id: mesocycles.id,
        name: mesocycles.name,
        start_date: mesocycles.start_date,
        end_date: mesocycles.end_date,
      })
      .from(mesocycles)
      .where(eq(mesocycles.id, mesoId))
      .get()

    if (meso) {
      phases.push({
        mesocycleId: meso.id,
        mesocycleName: meso.name,
        startDate: meso.start_date,
        endDate: meso.end_date,
      })
    }
  }

  phases.sort((a, b) => a.startDate.localeCompare(b.startDate))

  return { data: dataPoints, phases }
}
