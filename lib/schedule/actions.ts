'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { weekly_schedule, workout_templates, mesocycles } from '@/lib/db/schema'
import { derivePeriod, timeSlotSchema, durationSchema } from '@/lib/schedule/time-utils'
import { syncScheduleChange } from '@/lib/google/sync'
import { projectAffectedDates } from '@/lib/google/sync-helpers'

type ScheduleRow = typeof weekly_schedule.$inferSelect

type AssignResult =
  | { success: true; data: ScheduleRow }
  | { success: false; error: string }

type UpdateResult =
  | { success: true; data: ScheduleRow }
  | { success: false; error: string }

type RemoveResult =
  | { success: true }
  | { success: false; error: string }

const assignSchema = z.object({
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  day_of_week: z.number().int().min(0).max(6, 'day_of_week must be 0-6'),
  template_id: z.number().int().positive('Invalid template ID'),
  week_type: z.enum(['normal', 'deload']).default('normal'),
  time_slot: timeSlotSchema,
  duration: durationSchema,
})

const removeSchema = z.object({
  id: z.number().int().positive('Invalid schedule entry ID'),
})

export async function assignTemplate(input: {
  mesocycle_id: number
  day_of_week: number
  template_id: number
  time_slot: string
  duration: number
  week_type?: 'normal' | 'deload'
}): Promise<AssignResult> {
  const parsed = assignSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { mesocycle_id, day_of_week, template_id, week_type, time_slot, duration } = parsed.data

  // Derive period from time_slot
  const period = derivePeriod(time_slot)

  // Verify mesocycle exists and isn't completed
  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return { success: false, error: 'Cannot modify schedule of a completed mesocycle' }
  }

  if (week_type === 'deload' && !meso.has_deload) {
    return { success: false, error: 'Mesocycle does not have a deload week' }
  }

  // Verify template exists and belongs to this mesocycle
  const tmpl = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, template_id))
    .get()

  if (!tmpl) {
    return { success: false, error: 'Template not found' }
  }

  if (tmpl.mesocycle_id !== mesocycle_id) {
    return { success: false, error: 'Template does not belong to this mesocycle' }
  }

  // Upsert via unique index (mesocycle_id, day_of_week, week_type, time_slot, template_id)
  const row = db
    .insert(weekly_schedule)
    .values({
      mesocycle_id,
      day_of_week,
      template_id,
      week_type,
      period,
      time_slot,
      duration,
      created_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [weekly_schedule.mesocycle_id, weekly_schedule.day_of_week, weekly_schedule.week_type, weekly_schedule.time_slot, weekly_schedule.template_id],
      set: { period, duration },
    })
    .returning()
    .get()

  revalidatePath('/mesocycles', 'layout')

  // Fire-and-forget: sync affected dates to Google Calendar
  const dates = projectAffectedDates(meso.start_date, meso.end_date, day_of_week)
  syncScheduleChange('assign', mesocycle_id, dates).catch(() => {})

  return { success: true, data: row }
}

export async function removeAssignment(input: {
  id: number
}): Promise<RemoveResult> {
  const parsed = removeSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { id } = parsed.data

  // Look up the row to check mesocycle guard and capture day for sync
  const entry = db
    .select({ mesocycle_id: weekly_schedule.mesocycle_id, day_of_week: weekly_schedule.day_of_week })
    .from(weekly_schedule)
    .where(eq(weekly_schedule.id, id))
    .get()

  if (!entry) {
    // Idempotent — row already gone
    revalidatePath('/mesocycles', 'layout')
    return { success: true }
  }

  // Verify mesocycle isn't completed
  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, entry.mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return { success: false, error: 'Cannot modify schedule of a completed mesocycle' }
  }

  db.delete(weekly_schedule)
    .where(eq(weekly_schedule.id, id))
    .run()

  revalidatePath('/mesocycles', 'layout')

  // Fire-and-forget: sync removed dates to Google Calendar
  const dates = projectAffectedDates(meso.start_date, meso.end_date, entry.day_of_week)
  syncScheduleChange('remove', meso.id, dates).catch(() => {})

  return { success: true }
}

const updateSchema = z.object({
  id: z.number().int().positive('Invalid schedule entry ID'),
  time_slot: timeSlotSchema.optional(),
  duration: durationSchema.optional(),
}).refine(d => d.time_slot !== undefined || d.duration !== undefined, {
  message: 'At least one of time_slot or duration must be provided',
})

export async function updateScheduleEntry(input: {
  id: number
  time_slot?: string
  duration?: number
}): Promise<UpdateResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { id, time_slot, duration } = parsed.data

  const entry = db
    .select()
    .from(weekly_schedule)
    .where(eq(weekly_schedule.id, id))
    .get()

  if (!entry) {
    return { success: false, error: 'Schedule entry not found' }
  }

  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, entry.mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return { success: false, error: 'Cannot modify schedule of a completed mesocycle' }
  }

  const newTimeSlot = time_slot ?? entry.time_slot
  const newDuration = duration ?? entry.duration
  const newPeriod = derivePeriod(newTimeSlot)

  const row = db
    .update(weekly_schedule)
    .set({ time_slot: newTimeSlot, duration: newDuration, period: newPeriod })
    .where(eq(weekly_schedule.id, id))
    .returning()
    .get()

  revalidatePath('/mesocycles', 'layout')

  const dates = projectAffectedDates(meso.start_date, meso.end_date, entry.day_of_week)
  syncScheduleChange('assign', entry.mesocycle_id, dates).catch(() => {})

  return { success: true, data: row }
}
