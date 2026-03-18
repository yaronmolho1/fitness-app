import { eq } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  logged_workouts,
  logged_exercises,
  logged_sets,
  workout_templates,
} from '@/lib/db/schema'
import { hasExistingLog } from './duplicate-check'

export type SaveWorkoutSetInput = {
  reps: number | null
  weight: number | null
}

export type SaveWorkoutExerciseInput = {
  slotId: number
  exerciseId: number
  exerciseName: string
  order: number
  rpe: number | null
  sets: SaveWorkoutSetInput[]
}

export type SaveWorkoutInput = {
  templateId: number
  logDate: string
  exercises: SaveWorkoutExerciseInput[]
  rating: number | null
  notes: string | null
}

export type SaveWorkoutResult =
  | { success: true; data: { workoutId: number } }
  | { success: false; error: string }

type ResolvedSet = { reps: number; weight: number | null }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validatePreFallback(input: SaveWorkoutInput): string | null {
  if (!DATE_RE.test(input.logDate)) {
    return 'Invalid date format (expected YYYY-MM-DD)'
  }
  if (!input.exercises || input.exercises.length === 0) {
    return 'At least one exercise is required'
  }
  if (input.rating !== null && (input.rating < 1 || input.rating > 5)) {
    return 'Rating must be between 1 and 5'
  }
  for (const ex of input.exercises) {
    if (ex.rpe !== null && (ex.rpe < 1 || ex.rpe > 10)) {
      return 'RPE must be between 1 and 10'
    }
    for (const set of ex.sets) {
      if (set.weight !== null && set.weight < 0) {
        return 'Weight must be non-negative'
      }
    }
  }
  return null
}

// Resolve null inputs via cascade: set 1 → planned values, set 2+ → previous set
function resolveSetFallbacks(
  sets: SaveWorkoutSetInput[],
  plannedWeight: number | null,
  plannedReps: string
): ResolvedSet[] {
  const parsedPlannedReps = parseInt(plannedReps, 10) || 1
  const resolved: ResolvedSet[] = []

  for (let i = 0; i < sets.length; i++) {
    const raw = sets[i]
    let reps: number
    let weight: number | null

    if (i === 0) {
      reps = raw.reps ?? parsedPlannedReps
      weight = raw.weight ?? plannedWeight
    } else {
      reps = raw.reps ?? resolved[i - 1].reps
      weight = raw.weight ?? resolved[i - 1].weight
    }

    resolved.push({ reps, weight })
  }

  return resolved
}

function validateResolved(resolved: ResolvedSet[]): string | null {
  for (const set of resolved) {
    if (!set.reps || set.reps < 1) {
      return 'All sets must have reps > 0'
    }
  }
  return null
}

export async function saveWorkoutCore(
  database: AppDb,
  input: SaveWorkoutInput
): Promise<SaveWorkoutResult> {
  const preError = validatePreFallback(input)
  if (preError) {
    return { success: false, error: preError }
  }

  const normalizedNotes = input.notes?.trim() || null

  const template = await database.query.workout_templates.findFirst({
    where: eq(workout_templates.id, input.templateId),
    with: {
      exercise_slots: {
        with: {
          exercise: true,
        },
      },
    },
  })

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  const duplicate = await hasExistingLog(database, input.logDate, template.mesocycle_id)
  if (duplicate) {
    return { success: false, error: 'Workout already logged for this date and mesocycle' }
  }

  // Build slot lookup for fallback resolution
  const slotMap = new Map(template.exercise_slots.map((s) => [s.id, s]))

  // Resolve fallbacks and validate resolved sets
  const resolvedExercises: { ex: SaveWorkoutExerciseInput; sets: ResolvedSet[] }[] = []
  for (const ex of input.exercises) {
    const slot = slotMap.get(ex.slotId)
    const plannedWeight = slot?.weight ?? null
    const plannedReps = slot?.reps ?? '1'
    const resolved = resolveSetFallbacks(ex.sets, plannedWeight, plannedReps)
    const setError = validateResolved(resolved)
    if (setError) {
      return { success: false, error: setError }
    }
    resolvedExercises.push({ ex, sets: resolved })
  }

  const sortedSlots = [...template.exercise_slots].sort((a, b) => a.order - b.order)
  const templateSnapshot = {
    version: 1 as const,
    name: template.name,
    modality: template.modality,
    notes: template.notes,
    coaching_cues: template.coaching_cues,
    slots: sortedSlots.map((slot) => ({
      exercise_name: slot.exercise.name,
      target_sets: slot.sets,
      target_reps: slot.reps,
      target_weight: slot.weight,
      target_rpe: slot.rpe,
      rest_seconds: slot.rest_seconds,
      guidelines: slot.guidelines,
      sort_order: slot.order,
      is_main: slot.is_main,
    })),
  }

  try {
    const result = database.transaction((tx) => {
      const workout = tx
        .insert(logged_workouts)
        .values({
          template_id: input.templateId,
          canonical_name: template.canonical_name,
          log_date: input.logDate,
          logged_at: new Date(),
          rating: input.rating,
          notes: normalizedNotes,
          template_snapshot: templateSnapshot,
          created_at: new Date(),
        })
        .returning()
        .get()

      for (const { ex, sets } of resolvedExercises) {
        const loggedEx = tx
          .insert(logged_exercises)
          .values({
            logged_workout_id: workout.id,
            exercise_id: ex.exerciseId,
            exercise_name: ex.exerciseName,
            order: ex.order,
            actual_rpe: ex.rpe,
            created_at: new Date(),
          })
          .returning()
          .get()

        for (let i = 0; i < sets.length; i++) {
          const set = sets[i]
          tx.insert(logged_sets)
            .values({
              logged_exercise_id: loggedEx.id,
              set_number: i + 1,
              actual_reps: set.reps,
              actual_weight: set.weight,
              created_at: new Date(),
            })
            .run()
        }
      }

      return { workoutId: workout.id }
    })

    return { success: true, data: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to save workout: ${message}` }
  }
}
