'use server'

import { db } from '@/lib/db/index'
import { mesocycles } from '@/lib/db/schema'
import { calculateEndDate } from './utils'

type CreateResult =
  | { success: true; id: number }
  | { success: false; errors: Record<string, string> }

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function createMesocycle(formData: FormData): Promise<CreateResult> {
  const errors: Record<string, string> = {}

  // Parse inputs
  const rawName = formData.get('name')
  const rawStartDate = formData.get('start_date')
  const rawWorkWeeks = formData.get('work_weeks')
  const rawHasDeload = formData.get('has_deload')

  // Validate name
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) {
    errors.name = 'Name is required'
  }

  // Validate start_date
  const startDate = typeof rawStartDate === 'string' ? rawStartDate : ''
  if (!startDate || !DATE_REGEX.test(startDate)) {
    errors.start_date = 'Valid start date (YYYY-MM-DD) is required'
  }

  // Validate work_weeks
  const workWeeksStr = typeof rawWorkWeeks === 'string' ? rawWorkWeeks : ''
  const workWeeks = Number(workWeeksStr)
  if (!workWeeksStr || !Number.isInteger(workWeeks) || workWeeks < 1) {
    errors.work_weeks = 'Work weeks must be a positive integer'
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  const hasDeload = rawHasDeload === 'true'
  const endDate = calculateEndDate(startDate, workWeeks, hasDeload)

  const result = db
    .insert(mesocycles)
    .values({
      name,
      start_date: startDate,
      end_date: endDate,
      work_weeks: workWeeks,
      has_deload: hasDeload,
      status: 'planned',
    })
    .returning({ id: mesocycles.id })
    .get()

  return { success: true, id: result.id }
}
