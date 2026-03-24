'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  upsertWeekOverride as upsertFn,
  deleteWeekOverride as deleteFn,
  type UpsertFields,
} from './week-overrides'

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
