'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workout_templates } from '@/lib/db/schema'
import { saveWorkoutCore } from './save-workout'
import type { SaveWorkoutInput, SaveWorkoutResult } from './save-workout'
import { saveRunningWorkoutCore } from './save-running-workout'
import type {
  SaveRunningWorkoutInput,
  SaveRunningWorkoutResult,
} from './save-running-workout'
import { saveMmaWorkoutCore } from './save-mma-workout'
import type {
  SaveMmaWorkoutInput,
  SaveMmaWorkoutResult,
} from './save-mma-workout'
import { saveMixedWorkoutCore } from './save-mixed-workout'
import type {
  SaveMixedWorkoutInput,
  SaveMixedWorkoutResult,
} from './save-mixed-workout'
import { syncCompletion } from '@/lib/google/sync'

export type {
  SaveWorkoutInput,
  SaveWorkoutSetInput,
  SaveWorkoutExerciseInput,
  SaveWorkoutResult,
} from './save-workout'

export type {
  IntervalRepData,
  SaveRunningWorkoutInput,
  SaveRunningWorkoutResult,
} from './save-running-workout'

export type {
  SaveMmaWorkoutInput,
  SaveMmaWorkoutResult,
} from './save-mma-workout'

export type {
  SaveMixedWorkoutInput,
  MixedSectionInput,
  SaveMixedWorkoutResult,
} from './save-mixed-workout'

// Fire-and-forget: update Google Calendar event with completion checkmark
async function fireCompletionSync(templateId: number, logDate: string) {
  const template = await db
    .select({ mesocycle_id: workout_templates.mesocycle_id })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()
  if (!template) return
  syncCompletion(template.mesocycle_id, templateId, logDate).catch(() => {})
}

export async function saveWorkout(input: SaveWorkoutInput): Promise<SaveWorkoutResult> {
  const result = await saveWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
    fireCompletionSync(input.templateId, input.logDate).catch(() => {})
  }
  return result
}

export async function saveRunningWorkout(
  input: SaveRunningWorkoutInput
): Promise<SaveRunningWorkoutResult> {
  const result = await saveRunningWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
    fireCompletionSync(input.templateId, input.logDate).catch(() => {})
  }
  return result
}

export async function saveMmaWorkout(
  input: SaveMmaWorkoutInput
): Promise<SaveMmaWorkoutResult> {
  const result = await saveMmaWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
    fireCompletionSync(input.templateId, input.logDate).catch(() => {})
  }
  return result
}

export async function saveMixedWorkout(
  input: SaveMixedWorkoutInput
): Promise<SaveMixedWorkoutResult> {
  const result = await saveMixedWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
    fireCompletionSync(input.templateId, input.logDate).catch(() => {})
  }
  return result
}
