import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  weekly_schedule,
  workout_templates,
  exercise_slots,
  exercises,
} from '@/lib/db/schema'

// Response types

type SlotData = {
  id: number
  exercise_name: string
  sets: number
  reps: string
  weight: number | null
  rpe: number | null
  rest_seconds: number | null
  guidelines: string | null
  order: number
  is_main: boolean
}

type MesocycleInfo = {
  id: number
  name: string
  start_date: string
  end_date: string
  week_type: 'normal' | 'deload'
}

type TemplateInfo = {
  id: number
  name: string
  modality: string
  notes: string | null
  // Running-specific
  run_type: string | null
  target_pace: string | null
  hr_zone: number | null
  interval_count: number | null
  interval_rest: number | null
  coaching_cues: string | null
  // MMA-specific
  planned_duration: number | null
}

type WorkoutResult = {
  type: 'workout'
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
  slots: SlotData[]
}

type RestDayResult = {
  type: 'rest_day'
  date: string
  mesocycle: MesocycleInfo
}

type NoActiveMesoResult = {
  type: 'no_active_mesocycle'
  date: string
}

export type TodayResult = WorkoutResult | RestDayResult | NoActiveMesoResult

// Determine if the given date falls in the deload week of a mesocycle
export function isDeloadWeek(
  startDate: string,
  workWeeks: number,
  hasDeload: boolean,
  today: string
): boolean {
  if (!hasDeload) return false

  const start = new Date(startDate + 'T00:00:00Z')
  const current = new Date(today + 'T00:00:00Z')
  const diffMs = current.getTime() - start.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  // Deload week starts at day (workWeeks * 7)
  const deloadStartDay = workWeeks * 7
  return diffDays >= deloadStartDay
}

// Get day_of_week (0=Sunday, 6=Saturday) from a YYYY-MM-DD string
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay()
}

// Main lookup chain
export async function getTodayWorkout(today: string): Promise<TodayResult> {
  // Step 1: find active mesocycle
  const activeMeso = await db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.status, 'active'))
    .get()

  if (!activeMeso) {
    return { type: 'no_active_mesocycle', date: today }
  }

  // Step 2: determine day_of_week
  const dayOfWeek = getDayOfWeek(today)

  // Step 3: determine variant (normal vs deload)
  const deload = isDeloadWeek(
    activeMeso.start_date,
    activeMeso.work_weeks,
    activeMeso.has_deload,
    today
  )
  const weekType = deload ? 'deload' : 'normal'

  const mesoInfo: MesocycleInfo = {
    id: activeMeso.id,
    name: activeMeso.name,
    start_date: activeMeso.start_date,
    end_date: activeMeso.end_date,
    week_type: weekType,
  }

  // Step 4: query weekly_schedule
  const scheduleRow = await db
    .select({
      template_id: weekly_schedule.template_id,
    })
    .from(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, activeMeso.id),
        eq(weekly_schedule.day_of_week, dayOfWeek),
        eq(weekly_schedule.week_type, weekType)
      )
    )
    .get()

  // Step 5: no schedule = rest day
  if (!scheduleRow || !scheduleRow.template_id) {
    return { type: 'rest_day', date: today, mesocycle: mesoInfo }
  }

  // Step 6: load template + exercise slots
  const template = await db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, scheduleRow.template_id))
    .get()

  if (!template) {
    return { type: 'rest_day', date: today, mesocycle: mesoInfo }
  }

  const slots = await db
    .select({
      id: exercise_slots.id,
      exercise_name: exercises.name,
      sets: exercise_slots.sets,
      reps: exercise_slots.reps,
      weight: exercise_slots.weight,
      rpe: exercise_slots.rpe,
      rest_seconds: exercise_slots.rest_seconds,
      guidelines: exercise_slots.guidelines,
      order: exercise_slots.order,
      is_main: exercise_slots.is_main,
    })
    .from(exercise_slots)
    .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
    .where(eq(exercise_slots.template_id, template.id))
    .orderBy(asc(exercise_slots.order))
    .all()

  return {
    type: 'workout',
    date: today,
    mesocycle: mesoInfo,
    template: {
      id: template.id,
      name: template.name,
      modality: template.modality,
      notes: template.notes,
      run_type: template.run_type,
      target_pace: template.target_pace,
      hr_zone: template.hr_zone,
      interval_count: template.interval_count,
      interval_rest: template.interval_rest,
      coaching_cues: template.coaching_cues,
      planned_duration: template.planned_duration,
    },
    slots: slots as SlotData[],
  }
}
