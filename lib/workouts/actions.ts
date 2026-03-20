'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
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

export async function saveWorkout(input: SaveWorkoutInput): Promise<SaveWorkoutResult> {
  const result = await saveWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
  }
  return result
}

export async function saveRunningWorkout(
  input: SaveRunningWorkoutInput
): Promise<SaveRunningWorkoutResult> {
  const result = await saveRunningWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
  }
  return result
}

export async function saveMmaWorkout(
  input: SaveMmaWorkoutInput
): Promise<SaveMmaWorkoutResult> {
  const result = await saveMmaWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
  }
  return result
}

export async function saveMixedWorkout(
  input: SaveMixedWorkoutInput
): Promise<SaveMixedWorkoutResult> {
  const result = await saveMixedWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
  }
  return result
}
