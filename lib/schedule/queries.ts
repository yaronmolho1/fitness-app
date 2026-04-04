import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { weekly_schedule, workout_templates, schedule_week_overrides, mesocycles } from '@/lib/db/schema'

export type ScheduleEntry = {
  id: number
  day_of_week: number
  template_id: number
  template_name: string
  period: 'morning' | 'afternoon' | 'evening'
  time_slot: string
  duration: number
  cycle_length: number
  cycle_position: number
}

// Fetches schedule assignments for a mesocycle, joining template names
export async function getScheduleForMesocycle(
  mesocycleId: number,
  weekType: 'normal' | 'deload' = 'normal'
): Promise<ScheduleEntry[]> {
  const rows = await db
    .select({
      id: weekly_schedule.id,
      day_of_week: weekly_schedule.day_of_week,
      template_id: weekly_schedule.template_id,
      template_name: workout_templates.name,
      period: weekly_schedule.period,
      time_slot: weekly_schedule.time_slot,
      duration: weekly_schedule.duration,
      cycle_length: weekly_schedule.cycle_length,
      cycle_position: weekly_schedule.cycle_position,
    })
    .from(weekly_schedule)
    .innerJoin(workout_templates, eq(weekly_schedule.template_id, workout_templates.id))
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycleId),
        eq(weekly_schedule.week_type, weekType)
      )
    )
    .orderBy(asc(weekly_schedule.day_of_week), asc(weekly_schedule.time_slot), asc(weekly_schedule.cycle_position))
    .all()

  return rows as ScheduleEntry[]
}

export type TemplateOption = {
  id: number
  name: string
  canonical_name: string
  modality: 'resistance' | 'running' | 'mma' | 'mixed'
  notes?: string | null
  // Running-specific
  run_type?: 'easy' | 'tempo' | 'interval' | 'long' | 'race' | null
  target_pace?: string | null
  hr_zone?: number | null
  interval_count?: number | null
  interval_rest?: number | null
  coaching_cues?: string | null
  // Distance/duration
  target_distance?: number | null
  target_duration?: number | null
  // MMA-specific
  planned_duration?: number | null
  // Resistance estimated duration
  estimated_duration?: number | null
}

// Fetches templates belonging to a mesocycle (for the picker)
export async function getTemplatesForMesocycle(
  mesocycleId: number
): Promise<TemplateOption[]> {
  return await db
    .select({
      id: workout_templates.id,
      name: workout_templates.name,
      canonical_name: workout_templates.canonical_name,
      modality: workout_templates.modality,
      notes: workout_templates.notes,
      run_type: workout_templates.run_type,
      target_pace: workout_templates.target_pace,
      hr_zone: workout_templates.hr_zone,
      interval_count: workout_templates.interval_count,
      interval_rest: workout_templates.interval_rest,
      coaching_cues: workout_templates.coaching_cues,
      target_distance: workout_templates.target_distance,
      target_duration: workout_templates.target_duration,
      planned_duration: workout_templates.planned_duration,
      estimated_duration: workout_templates.estimated_duration,
    })
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, mesocycleId))
    .all() as TemplateOption[]
}

// Computes which mesocycle weeks a template is active, factoring in rotation cycles and overrides
export async function getActiveWeeksForTemplate(
  templateId: number,
  mesocycleId: number
): Promise<number[]> {
  const meso = await db
    .select({ work_weeks: mesocycles.work_weeks })
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycleId))
    .get()

  if (!meso) return []

  const { work_weeks: workWeeks } = meso

  const slots = await db
    .select({
      id: weekly_schedule.id,
      day_of_week: weekly_schedule.day_of_week,
      time_slot: weekly_schedule.time_slot,
      cycle_length: weekly_schedule.cycle_length,
      cycle_position: weekly_schedule.cycle_position,
    })
    .from(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycleId),
        eq(weekly_schedule.template_id, templateId),
        eq(weekly_schedule.week_type, 'normal')
      )
    )
    .all()

  if (slots.length === 0) return []

  // Build base active weeks from rotation cycles
  const activeWeeks = new Set<number>()
  // Track which (day, timeSlot) combos the template occupies for override resolution
  const slotKeys = new Set<string>()

  for (const slot of slots) {
    const key = `${slot.day_of_week}:${slot.time_slot}`
    slotKeys.add(key)

    for (let week = 1; week <= workWeeks; week++) {
      const activePosition = ((week - 1) % slot.cycle_length) + 1
      if (activePosition === slot.cycle_position) {
        activeWeeks.add(week)
      }
    }
  }

  // Fetch overrides for relevant day/time_slot combos
  const overrides = await db
    .select({
      week_number: schedule_week_overrides.week_number,
      day_of_week: schedule_week_overrides.day_of_week,
      time_slot: schedule_week_overrides.time_slot,
      template_id: schedule_week_overrides.template_id,
    })
    .from(schedule_week_overrides)
    .where(eq(schedule_week_overrides.mesocycle_id, mesocycleId))
    .all()

  for (const override of overrides) {
    const key = `${override.day_of_week}:${override.time_slot}`

    if (slotKeys.has(key)) {
      if (override.template_id === templateId) {
        // Override adds this template to a week
        activeWeeks.add(override.week_number)
      } else {
        // Override replaces this template with something else (or null/rest)
        activeWeeks.delete(override.week_number)
      }
    } else if (override.template_id === templateId) {
      // Override adds this template to a slot it doesn't normally occupy
      activeWeeks.add(override.week_number)
    }
  }

  return Array.from(activeWeeks).sort((a, b) => a - b)
}
