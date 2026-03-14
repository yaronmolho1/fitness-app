import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { weekly_schedule, workout_templates } from '@/lib/db/schema'

export type ScheduleEntry = {
  day_of_week: number
  template_id: number
  template_name: string
}

// Fetches schedule assignments for a mesocycle, joining template names
export async function getScheduleForMesocycle(
  mesocycleId: number,
  weekType: 'normal' | 'deload' = 'normal'
): Promise<ScheduleEntry[]> {
  const rows = db
    .select({
      day_of_week: weekly_schedule.day_of_week,
      template_id: weekly_schedule.template_id,
      template_name: workout_templates.name,
    })
    .from(weekly_schedule)
    .innerJoin(workout_templates, eq(weekly_schedule.template_id, workout_templates.id))
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesocycleId),
        eq(weekly_schedule.week_type, weekType)
      )
    )
    .orderBy(asc(weekly_schedule.day_of_week))
    .all()

  return rows as ScheduleEntry[]
}

export type TemplateOption = {
  id: number
  name: string
  modality: 'resistance' | 'running' | 'mma'
}

// Fetches templates belonging to a mesocycle (for the picker)
export async function getTemplatesForMesocycle(
  mesocycleId: number
): Promise<TemplateOption[]> {
  return db
    .select({
      id: workout_templates.id,
      name: workout_templates.name,
      modality: workout_templates.modality,
    })
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, mesocycleId))
    .all() as TemplateOption[]
}
