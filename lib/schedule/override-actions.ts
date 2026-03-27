'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  weekly_schedule,
  schedule_week_overrides,
  logged_workouts,
} from '@/lib/db/schema'

type MoveResult =
  | { success: true; override_group: string }
  | { success: false; error: string }

const periodEnum = z.enum(['morning', 'afternoon', 'evening'])

const moveWorkoutSchema = z.object({
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  week_number: z.number().int().positive('Invalid week number'),
  source_day: z.number().int().min(0).max(6, 'source_day must be 0-6'),
  source_period: periodEnum,
  target_day: z.number().int().min(0).max(6, 'target_day must be 0-6'),
  target_period: periodEnum,
  scope: z.enum(['this_week', 'remaining_weeks']),
  target_time_slot: z.string().nullish(),
})

/**
 * Computes the calendar date for a given week + day within a mesocycle.
 * start_date is a Monday (day 0 = Monday). day_of_week 0-6.
 */
function getDateForWeekDay(startDate: string, weekNumber: number, dayOfWeek: number): string {
  const start = new Date(startDate + 'T00:00:00')
  const daysOffset = (weekNumber - 1) * 7 + dayOfWeek
  const target = new Date(start)
  target.setDate(start.getDate() + daysOffset)
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(target.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function generateOverrideGroup(): string {
  return `move-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function moveWorkout(input: {
  mesocycle_id: number
  week_number: number
  source_day: number
  source_period: 'morning' | 'afternoon' | 'evening'
  target_day: number
  target_period: 'morning' | 'afternoon' | 'evening'
  scope: 'this_week' | 'remaining_weeks'
  target_time_slot?: string | null
}): Promise<MoveResult> {
  const parsed = moveWorkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const {
    mesocycle_id,
    week_number,
    source_day,
    source_period,
    target_day,
    target_period,
    scope,
    target_time_slot,
  } = parsed.data

  // Same day + same period = no-op
  if (source_day === target_day && source_period === target_period) {
    return { success: false, error: 'Cannot move to the same day and period' }
  }

  return db.transaction((tx) => {
    // Verify mesocycle exists and isn't completed
    const meso = tx
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.id, mesocycle_id))
      .get()

    if (!meso) {
      return { success: false, error: 'Mesocycle not found' } as const
    }

    if (meso.status === 'completed') {
      return { success: false, error: 'Cannot modify schedule of a completed mesocycle' } as const
    }

    // Determine week_type based on week_number vs work_weeks
    const weekType = (meso.has_deload && week_number > meso.work_weeks) ? 'deload' : 'normal'

    // Find the source slot in the base schedule
    const sourceSlot = tx
      .select()
      .from(weekly_schedule)
      .where(
        and(
          eq(weekly_schedule.mesocycle_id, mesocycle_id),
          eq(weekly_schedule.day_of_week, source_day),
          eq(weekly_schedule.week_type, weekType),
          eq(weekly_schedule.period, source_period)
        )
      )
      .get()

    if (!sourceSlot || !sourceSlot.template_id) {
      return { success: false, error: 'Source slot has no template assigned' } as const
    }

    const templateId = sourceSlot.template_id
    const overrideGroup = generateOverrideGroup()

    // Determine which weeks to apply overrides
    const totalWeeks = meso.work_weeks
    const weeks: number[] = scope === 'this_week'
      ? [week_number]
      : Array.from({ length: totalWeeks - week_number + 1 }, (_, i) => week_number + i)

    // For each target week, check logged workout guard and create override pairs
    let createdAny = false
    for (const wk of weeks) {
      const sourceDate = getDateForWeekDay(meso.start_date, wk, source_day)

      // Check if this template is already logged on the source date
      const logged = tx
        .select({ id: logged_workouts.id })
        .from(logged_workouts)
        .where(
          and(
            eq(logged_workouts.template_id, templateId),
            eq(logged_workouts.log_date, sourceDate)
          )
        )
        .get()

      if (logged) {
        // For this_week scope, reject entirely
        if (scope === 'this_week') {
          return { success: false, error: 'Cannot move an already-logged workout' } as const
        }
        // For remaining_weeks, skip this week
        continue
      }

      // Insert source override (null out the source slot)
      tx.insert(schedule_week_overrides)
        .values({
          mesocycle_id,
          week_number: wk,
          day_of_week: source_day,
          period: source_period,
          template_id: null,
          time_slot: null,
          override_group: overrideGroup,
          created_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schedule_week_overrides.mesocycle_id,
            schedule_week_overrides.week_number,
            schedule_week_overrides.day_of_week,
            schedule_week_overrides.period,
          ],
          set: {
            template_id: null,
            time_slot: null,
            override_group: overrideGroup,
          },
        })
        .run()

      // Insert target override (place template on target slot)
      tx.insert(schedule_week_overrides)
        .values({
          mesocycle_id,
          week_number: wk,
          day_of_week: target_day,
          period: target_period,
          template_id: templateId,
          time_slot: target_time_slot ?? null,
          override_group: overrideGroup,
          created_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schedule_week_overrides.mesocycle_id,
            schedule_week_overrides.week_number,
            schedule_week_overrides.day_of_week,
            schedule_week_overrides.period,
          ],
          set: {
            template_id: templateId,
            time_slot: target_time_slot ?? null,
            override_group: overrideGroup,
          },
        })
        .run()

      createdAny = true
    }

    if (!createdAny) {
      return { success: false, error: 'No weeks available to move (all logged)' } as const
    }

    revalidatePath('/mesocycles', 'layout')
    return { success: true, override_group: overrideGroup } as const
  })
}

type UndoResult = { success: true; deleted: number } | { success: false; error: string }

/** Deletes all override rows matching an override_group within a mesocycle. */
export async function undoScheduleMove(
  overrideGroup: string,
  mesocycleId: number
): Promise<UndoResult> {
  if (!overrideGroup || !mesocycleId) {
    return { success: false, error: 'Missing override_group or mesocycle_id' }
  }

  return db.transaction((tx) => {
    const meso = tx
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.id, mesocycleId))
      .get()

    if (!meso) {
      return { success: false, error: 'Mesocycle not found' } as const
    }
    if (meso.status === 'completed') {
      return { success: false, error: 'Cannot modify schedule of a completed mesocycle' } as const
    }

    const result = tx
      .delete(schedule_week_overrides)
      .where(
        and(
          eq(schedule_week_overrides.override_group, overrideGroup),
          eq(schedule_week_overrides.mesocycle_id, mesocycleId)
        )
      )
      .run()

    revalidatePath('/mesocycles', 'layout')
    return { success: true, deleted: result.changes } as const
  })
}

/** Deletes all override rows for a given mesocycle + week number. */
export async function resetWeekSchedule(
  mesocycleId: number,
  weekNumber: number
): Promise<UndoResult> {
  if (!mesocycleId || !weekNumber) {
    return { success: false, error: 'Missing mesocycle_id or week_number' }
  }

  return db.transaction((tx) => {
    const meso = tx
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.id, mesocycleId))
      .get()

    if (!meso) {
      return { success: false, error: 'Mesocycle not found' } as const
    }
    if (meso.status === 'completed') {
      return { success: false, error: 'Cannot modify schedule of a completed mesocycle' } as const
    }

    const result = tx
      .delete(schedule_week_overrides)
      .where(
        and(
          eq(schedule_week_overrides.mesocycle_id, mesocycleId),
          eq(schedule_week_overrides.week_number, weekNumber)
        )
      )
      .run()

    revalidatePath('/mesocycles', 'layout')
    return { success: true, deleted: result.changes } as const
  })
}
