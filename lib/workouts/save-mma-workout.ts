import { eq } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { logged_workouts, workout_templates } from '@/lib/db/schema'
import { hasExistingLog } from './duplicate-check'

export type SaveMmaWorkoutInput = {
  templateId: number
  logDate: string
  actualDurationMinutes: number | null
  feeling: number | null
  notes: string | null
}

export type SaveMmaWorkoutResult =
  | { success: true; data: { workoutId: number } }
  | { success: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateInput(input: SaveMmaWorkoutInput): string | null {
  if (!DATE_RE.test(input.logDate)) {
    return 'Invalid date format (expected YYYY-MM-DD)'
  }

  if (input.actualDurationMinutes !== null) {
    if (
      !Number.isInteger(input.actualDurationMinutes) ||
      input.actualDurationMinutes <= 0
    ) {
      return 'Duration must be a positive integer (minutes)'
    }
  }

  if (input.feeling !== null) {
    if (
      !Number.isInteger(input.feeling) ||
      input.feeling < 1 ||
      input.feeling > 5
    ) {
      return 'Feeling must be an integer between 1 and 5'
    }
  }

  return null
}

export async function saveMmaWorkoutCore(
  database: AppDb,
  input: SaveMmaWorkoutInput
): Promise<SaveMmaWorkoutResult> {
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

  if (template.modality !== 'mma') {
    return { success: false, error: 'Template is not an MMA workout' }
  }

  const duplicate = await hasExistingLog(database, input.logDate, input.templateId)
  if (duplicate) {
    return { success: false, error: 'This workout is already logged for this date' }
  }

  const templateSnapshot = {
    version: 1 as const,
    name: template.name,
    modality: template.modality,
    planned_duration: template.planned_duration,
    notes: template.notes,
    actual_duration_minutes: input.actualDurationMinutes,
    feeling: input.feeling,
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
          rating: input.feeling,
          notes: normalizedNotes,
          template_snapshot: templateSnapshot,
          created_at: new Date(),
        })
        .returning()
        .get()

      // MMA workouts do NOT create logged_exercises or logged_sets
      return { workoutId: workout.id }
    })

    return { success: true, data: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to save MMA workout: ${message}` }
  }
}
