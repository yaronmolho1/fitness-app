import { eq } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { logged_workouts, workout_templates } from '@/lib/db/schema'
import { hasExistingLog } from './duplicate-check'

export type IntervalRepData = {
  rep_number: number
  interval_pace: string | null
  interval_avg_hr: number | null
  interval_notes: string | null
  interval_elevation_gain: number | null
}

export type SaveRunningWorkoutInput = {
  templateId: number
  logDate: string
  actualDistance: number | null
  actualAvgPace: string | null
  actualAvgHr: number | null
  rating: number | null
  notes: string | null
  actualElevationGain?: number | null
  intervalData?: IntervalRepData[] | null
}

export type SaveRunningWorkoutResult =
  | { success: true; data: { workoutId: number } }
  | { success: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateInput(input: SaveRunningWorkoutInput): string | null {
  if (!DATE_RE.test(input.logDate)) {
    return 'Invalid date format (expected YYYY-MM-DD)'
  }

  if (input.rating !== null) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      return 'Rating must be an integer between 1 and 5'
    }
  }

  if (input.actualDistance !== null && input.actualDistance < 0) {
    return 'Distance must be non-negative'
  }

  if (input.actualAvgHr !== null) {
    if (input.actualAvgHr <= 0) {
      return 'Average HR must be a positive integer'
    }
    if (!Number.isInteger(input.actualAvgHr)) {
      return 'Average HR must be a positive integer'
    }
  }

  if (input.actualElevationGain !== null && input.actualElevationGain !== undefined) {
    if (!Number.isInteger(input.actualElevationGain) || input.actualElevationGain < 0) {
      return 'Elevation gain must be non-negative'
    }
  }

  if (input.intervalData) {
    for (const rep of input.intervalData) {
      if (rep.interval_avg_hr !== null && rep.interval_avg_hr !== undefined) {
        if (!Number.isInteger(rep.interval_avg_hr) || rep.interval_avg_hr <= 0) {
          return `Interval rep ${rep.rep_number}: HR must be a positive integer`
        }
      }
      if (rep.interval_elevation_gain !== null && rep.interval_elevation_gain !== undefined) {
        if (!Number.isInteger(rep.interval_elevation_gain) || rep.interval_elevation_gain < 0) {
          return `Interval rep ${rep.rep_number}: elevation gain must be non-negative`
        }
      }
    }
  }

  return null
}

export async function saveRunningWorkoutCore(
  database: AppDb,
  input: SaveRunningWorkoutInput
): Promise<SaveRunningWorkoutResult> {
  const validationError = validateInput(input)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const normalizedNotes = input.notes?.trim() || null

  const template = await database
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, input.templateId))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  if (template.modality !== 'running') {
    return { success: false, error: 'Template is not a running workout' }
  }

  const duplicate = await hasExistingLog(database, input.logDate, template.mesocycle_id)
  if (duplicate) {
    return { success: false, error: 'Workout already logged for this date and mesocycle' }
  }

  // Only store interval data for interval run types
  const isInterval = template.run_type === 'interval'
  const intervalData = isInterval && input.intervalData ? input.intervalData : null

  const templateSnapshot = {
    version: 1 as const,
    name: template.name,
    modality: template.modality,
    run_type: template.run_type,
    target_pace: template.target_pace,
    hr_zone: template.hr_zone,
    interval_count: template.interval_count,
    interval_rest: template.interval_rest,
    coaching_cues: template.coaching_cues,
    target_distance: template.target_distance,
    target_duration: template.target_duration,
    target_elevation_gain: template.target_elevation_gain ?? null,
    notes: template.notes,
    actual_distance: input.actualDistance,
    actual_avg_pace: input.actualAvgPace,
    actual_avg_hr: input.actualAvgHr,
    actual_elevation_gain: input.actualElevationGain ?? null,
    interval_data: intervalData,
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

      // Running workouts do NOT create logged_exercises or logged_sets
      return { workoutId: workout.id }
    })

    return { success: true, data: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to save running workout: ${message}` }
  }
}
