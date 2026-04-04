'use server'

import { eq, and, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { mesocycles } from '@/lib/db/schema'
import { calculateEndDate } from './utils'
import { syncMesocycle } from '@/lib/google/sync'

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
      status: 'draft',
    })
    .returning({ id: mesocycles.id })
    .get()

  return { success: true, id: result.id }
}

type UpdateResult =
  | { success: true; id: number }
  | { success: false; errors: Record<string, string> }

export async function updateMesocycle(id: number, formData: FormData): Promise<UpdateResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, errors: { server: 'Invalid mesocycle ID' } }
  }

  const meso = db
    .select({
      id: mesocycles.id,
      status: mesocycles.status,
      start_date: mesocycles.start_date,
      end_date: mesocycles.end_date,
      work_weeks: mesocycles.work_weeks,
      has_deload: mesocycles.has_deload,
    })
    .from(mesocycles)
    .where(eq(mesocycles.id, id))
    .get()

  if (!meso) {
    return { success: false, errors: { server: 'Mesocycle not found' } }
  }

  if (meso.status === 'completed') {
    return { success: false, errors: { server: 'Cannot edit a completed mesocycle' } }
  }

  const errors: Record<string, string> = {}

  const rawName = formData.get('name')
  const rawStartDate = formData.get('start_date')
  const rawWorkWeeks = formData.get('work_weeks')
  const rawHasDeload = formData.get('has_deload')

  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (!name) {
    errors.name = 'Name is required'
  }

  const startDate = typeof rawStartDate === 'string' ? rawStartDate : ''
  if (!startDate || !DATE_REGEX.test(startDate)) {
    errors.start_date = 'Valid start date (YYYY-MM-DD) is required'
  }

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

  // Detect date range change for sync
  const dateRangeChanged =
    meso.start_date !== startDate ||
    meso.work_weeks !== workWeeks ||
    meso.has_deload !== hasDeload

  db.update(mesocycles)
    .set({
      name,
      start_date: startDate,
      end_date: endDate,
      work_weeks: workWeeks,
      has_deload: hasDeload,
    })
    .where(eq(mesocycles.id, id))
    .run()

  revalidatePath('/mesocycles')

  // Fire-and-forget: re-project events if date range changed
  if (dateRangeChanged) {
    syncMesocycle(id).catch(() => {})
  }

  return { success: true, id }
}

type StatusResult =
  | { success: true }
  | { success: false; error: string }

export async function activateMesocycle(id: number): Promise<StatusResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid mesocycle ID' }
  }

  return db.transaction((tx) => {
    const meso = tx
      .select({ id: mesocycles.id, status: mesocycles.status })
      .from(mesocycles)
      .where(eq(mesocycles.id, id))
      .get()

    if (!meso) {
      return { success: false, error: 'Mesocycle not found' } as const
    }

    if (meso.status !== 'planned') {
      return { success: false, error: `Cannot activate a mesocycle with status "${meso.status}"` } as const
    }

    const existing = tx
      .select({ id: mesocycles.id })
      .from(mesocycles)
      .where(and(eq(mesocycles.status, 'active'), ne(mesocycles.id, id)))
      .get()

    if (existing) {
      return { success: false, error: 'Another mesocycle is already active' } as const
    }

    tx.update(mesocycles)
      .set({ status: 'active' })
      .where(eq(mesocycles.id, id))
      .run()

    revalidatePath('/mesocycles')
    return { success: true } as const
  })
}

export async function completeMesocycle(id: number): Promise<StatusResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid mesocycle ID' }
  }

  const meso = db
    .select({ id: mesocycles.id, status: mesocycles.status })
    .from(mesocycles)
    .where(eq(mesocycles.id, id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status !== 'active') {
    return { success: false, error: `Cannot complete a mesocycle with status "${meso.status}"` }
  }

  db.update(mesocycles)
    .set({ status: 'completed' })
    .where(eq(mesocycles.id, id))
    .run()

  revalidatePath('/mesocycles')
  return { success: true }
}

export async function planMesocycle(id: number): Promise<StatusResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid mesocycle ID' }
  }

  const meso = db
    .select({ id: mesocycles.id, status: mesocycles.status })
    .from(mesocycles)
    .where(eq(mesocycles.id, id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status !== 'draft') {
    return { success: false, error: `Cannot plan a mesocycle with status "${meso.status}"` }
  }

  db.update(mesocycles)
    .set({ status: 'planned' })
    .where(eq(mesocycles.id, id))
    .run()

  revalidatePath('/mesocycles')
  return { success: true }
}
