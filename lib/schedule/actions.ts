'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { weekly_schedule, workout_templates, mesocycles } from '@/lib/db/schema'

type ScheduleRow = typeof weekly_schedule.$inferSelect

type AssignResult =
  | { success: true; data: ScheduleRow }
  | { success: false; error: string }

type RemoveResult =
  | { success: true }
  | { success: false; error: string }

const periodEnum = z.enum(['morning', 'afternoon', 'evening'])

// HH:MM format, 00:00-23:59
const timeSlotSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  'time_slot must be HH:MM format (00:00-23:59)'
)

const assignSchema = z.object({
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  day_of_week: z.number().int().min(0).max(6, 'day_of_week must be 0-6'),
  template_id: z.number().int().positive('Invalid template ID'),
  week_type: z.enum(['normal', 'deload']).default('normal'),
  period: periodEnum,
  time_slot: timeSlotSchema.nullish(),
})

const removeSchema = z.object({
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  day_of_week: z.number().int().min(0).max(6, 'day_of_week must be 0-6'),
  week_type: z.enum(['normal', 'deload']).default('normal'),
  period: periodEnum,
})

export async function assignTemplate(input: {
  mesocycle_id: number
  day_of_week: number
  template_id: number
  period: 'morning' | 'afternoon' | 'evening'
  week_type?: 'normal' | 'deload'
  time_slot?: string | null
}): Promise<AssignResult> {
  const parsed = assignSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { mesocycle_id, day_of_week, template_id, week_type, period, time_slot } = parsed.data

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

  // Upsert via unique index (mesocycle_id, day_of_week, week_type, period)
  const row = db
    .insert(weekly_schedule)
    .values({
      mesocycle_id,
      day_of_week,
      template_id,
      week_type,
      period,
      time_slot: time_slot ?? null,
      created_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [weekly_schedule.mesocycle_id, weekly_schedule.day_of_week, weekly_schedule.week_type, weekly_schedule.period],
      set: { template_id, time_slot: time_slot ?? null },
    })
    .returning()
    .get()

  revalidatePath('/mesocycles', 'layout')
  return { success: true, data: row }
}

export async function removeAssignment(input: {
  mesocycle_id: number
  day_of_week: number
  period: 'morning' | 'afternoon' | 'evening'
  week_type?: 'normal' | 'deload'
}): Promise<RemoveResult> {
  const parsed = removeSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { mesocycle_id, day_of_week, week_type, period } = parsed.data

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

  // Delete the specific period entry (idempotent)
  db.delete(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycle_id),
        eq(weekly_schedule.day_of_week, day_of_week),
        eq(weekly_schedule.week_type, week_type),
        eq(weekly_schedule.period, period)
      )
    )
    .run()

  revalidatePath('/mesocycles', 'layout')
  return { success: true }
}
