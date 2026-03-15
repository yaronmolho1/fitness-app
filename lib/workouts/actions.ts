'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { saveWorkoutCore } from './save-workout'
import type { SaveWorkoutInput, SaveWorkoutResult } from './save-workout'

export type {
  SaveWorkoutInput,
  SaveWorkoutSetInput,
  SaveWorkoutExerciseInput,
  SaveWorkoutResult,
} from './save-workout'

export async function saveWorkout(input: SaveWorkoutInput): Promise<SaveWorkoutResult> {
  const result = await saveWorkoutCore(db, input)
  if (result.success) {
    revalidatePath('/')
  }
  return result
}
