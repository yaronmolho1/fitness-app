import { eq, and } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { weekly_schedule, schedule_week_overrides } from '@/lib/db/schema'

type Period = 'morning' | 'afternoon' | 'evening'

export type EffectiveScheduleEntry = {
  schedule_entry_id: number | null
  template_id: number | null
  period: Period
  time_slot: string
  duration: number
  is_override: boolean
  override_group: string | null
}

/**
 * Resolves the effective schedule for a specific day within a mesocycle,
 * merging base weekly_schedule with any schedule_week_overrides.
 * Override matching uses time_slot key (not period). Results sorted by time_slot ascending.
 */
export async function getEffectiveScheduleForDay(
  database: AppDb,
  mesocycleId: number,
  weekNumber: number,
  dayOfWeek: number,
  weekType: 'normal' | 'deload'
): Promise<EffectiveScheduleEntry[]> {
  // Fetch base schedule entries for this day
  const baseRows = database
    .select({
      id: weekly_schedule.id,
      template_id: weekly_schedule.template_id,
      period: weekly_schedule.period,
      time_slot: weekly_schedule.time_slot,
      duration: weekly_schedule.duration,
    })
    .from(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycleId),
        eq(weekly_schedule.day_of_week, dayOfWeek),
        eq(weekly_schedule.week_type, weekType)
      )
    )
    .all()

  // Fetch overrides for this specific week/day
  const overrideRows = database
    .select({
      template_id: schedule_week_overrides.template_id,
      period: schedule_week_overrides.period,
      time_slot: schedule_week_overrides.time_slot,
      duration: schedule_week_overrides.duration,
      override_group: schedule_week_overrides.override_group,
    })
    .from(schedule_week_overrides)
    .where(
      and(
        eq(schedule_week_overrides.mesocycle_id, mesocycleId),
        eq(schedule_week_overrides.week_number, weekNumber),
        eq(schedule_week_overrides.day_of_week, dayOfWeek)
      )
    )
    .all()

  // Index overrides by time_slot for fast lookup
  const overrideByTimeSlot = new Map<string, (typeof overrideRows)[number]>()
  for (const ov of overrideRows) {
    overrideByTimeSlot.set(ov.time_slot, ov)
  }

  // Track seen time_slots to identify override-only entries
  const seenTimeSlots = new Set<string>()
  const entries: EffectiveScheduleEntry[] = []

  // Process base entries — apply override if one exists for the same time_slot
  for (const base of baseRows) {
    seenTimeSlots.add(base.time_slot)
    const override = overrideByTimeSlot.get(base.time_slot)

    if (override) {
      entries.push({
        schedule_entry_id: base.id,
        template_id: override.template_id,
        period: override.period as Period,
        time_slot: override.time_slot,
        duration: override.duration,
        is_override: true,
        override_group: override.override_group,
      })
    } else {
      entries.push({
        schedule_entry_id: base.id,
        template_id: base.template_id,
        period: base.period as Period,
        time_slot: base.time_slot,
        duration: base.duration,
        is_override: false,
        override_group: null,
      })
    }
  }

  // Add override-only entries (time_slots with no base schedule)
  for (const ov of overrideRows) {
    if (!seenTimeSlots.has(ov.time_slot)) {
      entries.push({
        schedule_entry_id: null,
        template_id: ov.template_id,
        period: ov.period as Period,
        time_slot: ov.time_slot,
        duration: ov.duration,
        is_override: true,
        override_group: ov.override_group,
      })
    }
  }

  // Sort by time_slot ascending (chronological)
  entries.sort((a, b) => a.time_slot.localeCompare(b.time_slot))

  return entries
}
