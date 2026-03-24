'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  upsertWeekOverride as upsertFn,
  deleteWeekOverride as deleteFn,
  getWeekOverrides as getFn,
} from './week-overrides'

type UpsertFields = {
  weight?: number | null
  reps?: string | null
  sets?: number | null
  rpe?: number | null
  distance?: number | null
  duration?: number | null
  pace?: string | null
  is_deload?: boolean
}

export async function upsertWeekOverrideAction(
  slotId: number,
  weekNumber: number,
  fields: UpsertFields
) {
  const result = await upsertFn(db, slotId, weekNumber, fields)
  if (result.success) {
    revalidatePath('/mesocycles')
  }
  return result
}

export async function deleteWeekOverrideAction(
  slotId: number,
  weekNumber: number
) {
  const result = await deleteFn(db, slotId, weekNumber)
  if (result.success) {
    revalidatePath('/mesocycles')
  }
  return result
}

export async function getWeekOverridesAction(slotId: number) {
  return getFn(db, slotId)
}
