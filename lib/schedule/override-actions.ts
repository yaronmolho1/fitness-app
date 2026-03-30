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
import { derivePeriod, timeSlotSchema, durationSchema } from '@/lib/schedule/time-utils'
import { syncScheduleChange } from '@/lib/google/sync'
import { projectWeekDates, getDateForWeekDay } from '@/lib/google/sync-helpers'

type MoveResult =
  | { success: true; override_group: string }
  | { success: false; error: string }

const moveWorkoutSchema = z.object({
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  week_number: z.number().int().positive('Invalid week number'),
  schedule_id: z.number().int().positive('Invalid schedule entry ID'),
  target_day: z.number().int().min(0).max(6, 'target_day must be 0-6'),
  target_time_slot: timeSlotSchema,
  target_duration: durationSchema,
  scope: z.enum(['this_week', 'remaining_weeks']),
  target_week_offset: z.number().int().min(-1).max(1).default(0),
})


function generateOverrideGroup(): string {
  return `move-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function moveWorkout(input: {
  mesocycle_id: number
  week_number: number
  schedule_id: number
  target_day: number
  target_time_slot: string
  target_duration: number
  scope: 'this_week' | 'remaining_weeks'
  target_week_offset?: number
}): Promise<MoveResult> {
  const parsed = moveWorkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const {
    mesocycle_id,
    week_number,
    schedule_id,
    target_day,
    target_time_slot,
    target_duration,
    scope,
    target_week_offset,
  } = parsed.data

  // Internal result carries sync data alongside the public shape
  type InternalMoveResult =
    | MoveResult & { success: false }
    | { success: true; override_group: string; _syncDates: string[] }

  const result = db.transaction((tx): InternalMoveResult => {
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

    // Validate week_number upper bound
    const maxWeek = meso.has_deload ? meso.work_weeks + 1 : meso.work_weeks
    if (week_number > maxWeek) {
      return { success: false, error: 'Invalid week number' } as const
    }

    // Find source entry by row ID
    const sourceSlot = tx
      .select()
      .from(weekly_schedule)
      .where(eq(weekly_schedule.id, schedule_id))
      .get()

    if (!sourceSlot || !sourceSlot.template_id || sourceSlot.mesocycle_id !== mesocycle_id) {
      return { success: false, error: 'Source schedule entry not found or has no template' } as const
    }

    const source_day = sourceSlot.day_of_week
    const sourceTimeSlot = sourceSlot.time_slot
    const sourceDuration = sourceSlot.duration
    const sourcePeriod = derivePeriod(sourceTimeSlot)

    // Same day + same time_slot + same week = no-op
    if (target_week_offset === 0 && source_day === target_day && sourceTimeSlot === target_time_slot) {
      return { success: false, error: 'Cannot move to the same day and time' } as const
    }

    const templateId = sourceSlot.template_id
    const overrideGroup = generateOverrideGroup()
    const targetPeriod = derivePeriod(target_time_slot)

    // Determine which weeks to apply overrides
    const totalWeeks = meso.work_weeks
    const weeks: number[] = scope === 'this_week'
      ? [week_number]
      : Array.from({ length: totalWeeks - week_number + 1 }, (_, i) => week_number + i)

    // For each target week, check logged workout guard and create override pairs
    let createdAny = false
    const syncDates: string[] = []
    for (const wk of weeks) {
      const targetWk = wk + target_week_offset

      // Skip if target week falls outside mesocycle bounds
      if (targetWk < 1 || targetWk > maxWeek) {
        if (scope === 'this_week') {
          return { success: false, error: 'Target week is outside the mesocycle' } as const
        }
        continue
      }

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
        if (scope === 'this_week') {
          return { success: false, error: 'Cannot move an already-logged workout' } as const
        }
        continue
      }

      // Insert source override (null out the source slot)
      tx.insert(schedule_week_overrides)
        .values({
          mesocycle_id,
          week_number: wk,
          day_of_week: source_day,
          period: sourcePeriod,
          template_id: null,
          time_slot: sourceTimeSlot,
          duration: sourceDuration,
          override_group: overrideGroup,
          created_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schedule_week_overrides.mesocycle_id,
            schedule_week_overrides.week_number,
            schedule_week_overrides.day_of_week,
            schedule_week_overrides.time_slot,
            schedule_week_overrides.template_id,
          ],
          set: {
            template_id: null,
            time_slot: sourceTimeSlot,
            override_group: overrideGroup,
          },
        })
        .run()

      // Insert target override (place template on target slot, possibly different week)
      tx.insert(schedule_week_overrides)
        .values({
          mesocycle_id,
          week_number: targetWk,
          day_of_week: target_day,
          period: targetPeriod,
          template_id: templateId,
          time_slot: target_time_slot,
          duration: target_duration,
          override_group: overrideGroup,
          created_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schedule_week_overrides.mesocycle_id,
            schedule_week_overrides.week_number,
            schedule_week_overrides.day_of_week,
            schedule_week_overrides.time_slot,
            schedule_week_overrides.template_id,
          ],
          set: {
            template_id: templateId,
            time_slot: target_time_slot,
            override_group: overrideGroup,
          },
        })
        .run()

      createdAny = true
      syncDates.push(sourceDate)
      syncDates.push(getDateForWeekDay(meso.start_date, targetWk, target_day))
    }

    if (!createdAny) {
      return { success: false, error: 'No weeks available to move (all logged)' } as const
    }

    return { success: true, override_group: overrideGroup, _syncDates: syncDates } as const
  })

  if (result.success) {
    revalidatePath('/mesocycles', 'layout')

    // Fire-and-forget: sync affected dates to Google Calendar
    syncScheduleChange('move', mesocycle_id, result._syncDates).catch(() => {})
  }

  // Strip internal sync data before returning
  if (result.success) {
    return { success: true, override_group: result.override_group }
  }
  return result
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

  const txResult = db.transaction((tx) => {
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

    // Capture override dates before deletion for sync
    const overrideRows = tx
      .select({ week_number: schedule_week_overrides.week_number, day_of_week: schedule_week_overrides.day_of_week })
      .from(schedule_week_overrides)
      .where(
        and(
          eq(schedule_week_overrides.override_group, overrideGroup),
          eq(schedule_week_overrides.mesocycle_id, mesocycleId)
        )
      )
      .all()

    const syncDates = overrideRows.map(r => getDateForWeekDay(meso.start_date, r.week_number, r.day_of_week))

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
    return { success: true, deleted: result.changes, _syncDates: [...new Set(syncDates)] } as const
  })

  if (txResult.success && txResult._syncDates.length > 0) {
    syncScheduleChange('reset', mesocycleId, [...txResult._syncDates]).catch(() => {})
  }

  if (txResult.success) {
    return { success: true, deleted: txResult.deleted }
  }
  return txResult
}

/** Deletes all override rows for a given mesocycle + week number. */
export async function resetWeekSchedule(
  mesocycleId: number,
  weekNumber: number
): Promise<UndoResult> {
  if (!mesocycleId || !weekNumber) {
    return { success: false, error: 'Missing mesocycle_id or week_number' }
  }

  const txResult = db.transaction((tx) => {
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
    return { success: true, deleted: result.changes, start_date: meso.start_date } as const
  })

  if (txResult.success) {
    // Fire-and-forget: sync all dates in this week
    const weekDates = projectWeekDates(txResult.start_date, weekNumber)
    syncScheduleChange('reset', mesocycleId, weekDates).catch(() => {})
    return { success: true, deleted: txResult.deleted }
  }

  return txResult
}
