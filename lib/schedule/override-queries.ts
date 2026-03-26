import { eq, and } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { weekly_schedule, schedule_week_overrides } from '@/lib/db/schema'

type Period = 'morning' | 'afternoon' | 'evening'

export type EffectiveScheduleEntry = {
  template_id: number | null
  period: Period
  time_slot: string | null
  is_override: boolean
  override_group: string | null
}

const PERIOD_ORDER: Record<Period, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
}

/**
 * Resolves the effective schedule for a specific day within a mesocycle,
 * merging base weekly_schedule with any schedule_week_overrides.
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
      template_id: weekly_schedule.template_id,
      period: weekly_schedule.period,
      time_slot: weekly_schedule.time_slot,
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

  // Index overrides by period for fast lookup
  const overrideByPeriod = new Map<string, (typeof overrideRows)[number]>()
  for (const ov of overrideRows) {
    overrideByPeriod.set(ov.period, ov)
  }

  // Collect all periods present in either base or overrides
  const seenPeriods = new Set<string>()
  const entries: EffectiveScheduleEntry[] = []

  // Process base entries — apply override if one exists for the period
  for (const base of baseRows) {
    seenPeriods.add(base.period)
    const override = overrideByPeriod.get(base.period)

    if (override) {
      entries.push({
        template_id: override.template_id,
        period: override.period as Period,
        time_slot: override.time_slot,
        is_override: true,
        override_group: override.override_group,
      })
    } else {
      entries.push({
        template_id: base.template_id,
        period: base.period as Period,
        time_slot: base.time_slot,
        is_override: false,
        override_group: null,
      })
    }
  }

  // Add override-only entries (periods with no base schedule)
  for (const ov of overrideRows) {
    if (!seenPeriods.has(ov.period)) {
      entries.push({
        template_id: ov.template_id,
        period: ov.period as Period,
        time_slot: ov.time_slot,
        is_override: true,
        override_group: ov.override_group,
      })
    }
  }

  // Sort by period order
  entries.sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period])

  return entries
}
