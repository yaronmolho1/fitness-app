'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  upsertTemplateWeekOverride as upsertFn,
  deleteTemplateWeekOverride as deleteFn,
  getTemplateWeekOverrides as getFn,
} from './template-week-overrides'

type UpsertFields = {
  distance?: number | null
  duration?: number | null
  pace?: string | null
  planned_duration?: number | null
  interval_count?: number | null
  interval_rest?: number | null
  is_deload?: boolean
}

export async function upsertTemplateWeekOverrideAction(
  templateId: number,
  sectionId: number | null,
  weekNumber: number,
  fields: UpsertFields
) {
  const result = await upsertFn(db, templateId, sectionId, weekNumber, fields)
  if (result.success) {
    revalidatePath('/mesocycles')
  }
  return result
}

export async function deleteTemplateWeekOverrideAction(
  templateId: number,
  sectionId: number | null,
  weekNumber: number
) {
  const result = await deleteFn(db, templateId, sectionId, weekNumber)
  if (result.success) {
    revalidatePath('/mesocycles')
  }
  return result
}

export async function getTemplateWeekOverridesAction(
  templateId: number,
  sectionId: number | null
) {
  return getFn(db, templateId, sectionId)
}
