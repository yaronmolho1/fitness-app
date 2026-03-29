import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { weekly_schedule, workout_templates } from '@/lib/db/schema'

export type ScheduleEntry = {
  id: number
  day_of_week: number
  template_id: number
  template_name: string
  period: 'morning' | 'afternoon' | 'evening'
  time_slot: string
  duration: number
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
    })
    .from(weekly_schedule)
    .innerJoin(workout_templates, eq(weekly_schedule.template_id, workout_templates.id))
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycleId),
        eq(weekly_schedule.week_type, weekType)
      )
    )
    .orderBy(asc(weekly_schedule.day_of_week), asc(weekly_schedule.period))
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
    })
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, mesocycleId))
    .all() as TemplateOption[]
}
