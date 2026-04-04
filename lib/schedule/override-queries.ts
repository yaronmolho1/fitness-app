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
  cycle_length: number
  cycle_position: number
}

type BaseRow = {
  id: number
  template_id: number | null
  period: string
  time_slot: string
  duration: number
  cycle_length: number
  cycle_position: number
}

// For each time_slot group with cycle_length > 1, keep only the row matching the active position.
function resolveRotationCycles(rows: BaseRow[], weekNumber: number): BaseRow[] {
  const groups = new Map<string, BaseRow[]>()
  for (const row of rows) {
    const existing = groups.get(row.time_slot)
    if (existing) {
      existing.push(row)
    } else {
      groups.set(row.time_slot, [row])
    }
  }

  const resolved: BaseRow[] = []
  for (const [, group] of groups) {
    const cycleLength = group[0].cycle_length
    if (cycleLength <= 1) {
      resolved.push(group[0])
    } else {
      const activePosition = ((weekNumber - 1) % cycleLength) + 1
      const match = group.find((r) => r.cycle_position === activePosition)
      if (match) {
        resolved.push(match)
      }
    }
  }

  return resolved
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
      cycle_length: weekly_schedule.cycle_length,
      cycle_position: weekly_schedule.cycle_position,
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

  // Resolve rotation cycles: group by time_slot, keep only the active position
  const resolvedRows = resolveRotationCycles(baseRows, weekNumber)

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

  // Process resolved base entries — apply override if one exists for the same time_slot
  for (const base of resolvedRows) {
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
        cycle_length: base.cycle_length,
        cycle_position: base.cycle_position,
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
        cycle_length: base.cycle_length,
        cycle_position: base.cycle_position,
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
        cycle_length: 1,
        cycle_position: 1,
      })
    }
  }

  // Sort by time_slot ascending (chronological)
  entries.sort((a, b) => a.time_slot.localeCompare(b.time_slot))

  return entries
}
