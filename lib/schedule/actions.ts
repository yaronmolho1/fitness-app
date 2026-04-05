'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, inArray } from 'drizzle-orm'
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

type AssignRotationResult =
  | { success: true; data: ScheduleRow[] }
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

  // Atomic delete + insert for slot replacement
  const row = db.transaction((tx) => {
    tx.delete(weekly_schedule)
      .where(
        and(
          eq(weekly_schedule.mesocycle_id, mesocycle_id),
          eq(weekly_schedule.day_of_week, day_of_week),
          eq(weekly_schedule.week_type, week_type),
          eq(weekly_schedule.time_slot, time_slot),
        )
      )
      .run()

    return tx
      .insert(weekly_schedule)
      .values({
        mesocycle_id,
        day_of_week,
        template_id,
        week_type,
        period,
        time_slot,
        duration,
        cycle_length: 1,
        cycle_position: 1,
        created_at: new Date(),
      })
      .returning()
      .get()
  })

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

  // Look up the full row to check mesocycle guard, rotation, and capture day for sync
  const entry = db
    .select({
      mesocycle_id: weekly_schedule.mesocycle_id,
      day_of_week: weekly_schedule.day_of_week,
      week_type: weekly_schedule.week_type,
      time_slot: weekly_schedule.time_slot,
      cycle_length: weekly_schedule.cycle_length,
    })
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

  // If rotation (cycle_length > 1), delete all rows for this slot; otherwise just the one row
  if (entry.cycle_length > 1) {
    db.delete(weekly_schedule)
      .where(
        and(
          eq(weekly_schedule.mesocycle_id, entry.mesocycle_id),
          eq(weekly_schedule.day_of_week, entry.day_of_week),
          eq(weekly_schedule.week_type, entry.week_type),
          eq(weekly_schedule.time_slot, entry.time_slot),
        )
      )
      .run()
  } else {
    db.delete(weekly_schedule)
      .where(eq(weekly_schedule.id, id))
      .run()
  }

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

type CopyResult =
  | { success: true; count: number }
  | { success: false; error: string }

export async function copyNormalToDeload(
  mesocycleId: number
): Promise<CopyResult> {
  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycleId))
    .get()

  if (!meso) return { success: false, error: 'Mesocycle not found' }
  if (meso.status === 'completed') return { success: false, error: 'Cannot modify completed mesocycle' }
  if (!meso.has_deload) return { success: false, error: 'Mesocycle has no deload week' }

  const normalEntries = db
    .select()
    .from(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycleId),
        eq(weekly_schedule.week_type, 'normal')
      )
    )
    .all()

  if (normalEntries.length === 0) return { success: false, error: 'No normal schedule to copy' }

  const count = db.transaction((tx) => {
    // Clear existing deload schedule
    tx.delete(weekly_schedule)
      .where(
        and(
          eq(weekly_schedule.mesocycle_id, mesocycleId),
          eq(weekly_schedule.week_type, 'deload')
        )
      )
      .run()

    // Copy normal entries as deload
    for (const entry of normalEntries) {
      tx.insert(weekly_schedule)
        .values({
          mesocycle_id: mesocycleId,
          day_of_week: entry.day_of_week,
          template_id: entry.template_id,
          week_type: 'deload' as const,
          period: entry.period,
          time_slot: entry.time_slot,
          duration: entry.duration,
          cycle_length: entry.cycle_length,
          cycle_position: entry.cycle_position,
          created_at: new Date(),
        })
        .run()
    }

    return normalEntries.length
  })

  revalidatePath('/mesocycles', 'layout')
  return { success: true, count }
}

const rotationPositionSchema = z.object({
  cycle_position: z.number().int().positive(),
  template_id: z.number().int().positive(),
  time_slot: timeSlotSchema.optional(),
  duration: durationSchema.optional(),
})

const assignRotationSchema = z.object({
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  day_of_week: z.number().int().min(0).max(6, 'day_of_week must be 0-6'),
  week_type: z.enum(['normal', 'deload']).default('normal'),
  time_slot: timeSlotSchema,
  duration: durationSchema,
  positions: z.array(rotationPositionSchema).min(2, 'Rotation requires 2-8 positions').max(8, 'Rotation requires 2-8 positions'),
})

function validateContiguousPositions(positions: { cycle_position: number }[]): boolean {
  const sorted = [...positions].sort((a, b) => a.cycle_position - b.cycle_position)
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].cycle_position !== i + 1) return false
  }
  return true
}

export async function assignRotation(input: {
  mesocycle_id: number
  day_of_week: number
  week_type?: 'normal' | 'deload'
  time_slot: string
  duration: number
  positions: Array<{ cycle_position: number; template_id: number; time_slot?: string; duration?: number }>
}): Promise<AssignRotationResult> {
  const parsed = assignRotationSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { mesocycle_id, day_of_week, week_type, time_slot, duration, positions } = parsed.data

  if (!validateContiguousPositions(positions)) {
    return { success: false, error: 'Positions must be contiguous from 1 to N' }
  }

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

  // Validate all template_ids exist in this mesocycle
  const templateIds = [...new Set(positions.map(p => p.template_id))]
  const templates = db
    .select({ id: workout_templates.id, mesocycle_id: workout_templates.mesocycle_id })
    .from(workout_templates)
    .where(inArray(workout_templates.id, templateIds))
    .all()

  const foundIds = new Set(templates.map(t => t.id))
  for (const tid of templateIds) {
    if (!foundIds.has(tid)) {
      return { success: false, error: 'Template not found' }
    }
  }

  for (const tmpl of templates) {
    if (tmpl.mesocycle_id !== mesocycle_id) {
      return { success: false, error: 'Template does not belong to this mesocycle' }
    }
  }

  const cycleLength = positions.length

  // Atomic delete + insert for rotation replacement
  const rows = db.transaction((tx) => {
    tx.delete(weekly_schedule)
      .where(
        and(
          eq(weekly_schedule.mesocycle_id, mesocycle_id),
          eq(weekly_schedule.day_of_week, day_of_week),
          eq(weekly_schedule.week_type, week_type),
          eq(weekly_schedule.time_slot, time_slot),
        )
      )
      .run()

    const inserted: ScheduleRow[] = []
    for (const pos of positions) {
      const posTimeSlot = pos.time_slot ?? time_slot
      const posDuration = pos.duration ?? duration
      const row = tx
        .insert(weekly_schedule)
        .values({
          mesocycle_id,
          day_of_week,
          template_id: pos.template_id,
          week_type,
          period: derivePeriod(posTimeSlot),
          time_slot: posTimeSlot,
          duration: posDuration,
          cycle_length: cycleLength,
          cycle_position: pos.cycle_position,
          created_at: new Date(),
        })
        .returning()
        .get()
      inserted.push(row)
    }
    return inserted
  })

  revalidatePath('/mesocycles', 'layout')

  // Fire-and-forget GCal sync
  const dates = projectAffectedDates(meso.start_date, meso.end_date, day_of_week)
  syncScheduleChange('assign', mesocycle_id, dates).catch(() => {})

  return { success: true, data: rows }
}
