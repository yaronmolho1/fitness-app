import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  weekly_schedule,
  workout_templates,
  exercise_slots,
  exercises,
  logged_workouts,
  routine_items,
  routine_logs,
  logged_exercises,
  logged_sets,
} from '@/lib/db/schema'
import { filterActiveRoutineItems } from '@/lib/routines/scope-filter'

// Response types

export type SlotData = {
  id: number
  exercise_id: number
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

export type MesocycleInfo = {
  id: number
  name: string
  start_date: string
  end_date: string
  week_type: 'normal' | 'deload'
}

export type TemplateInfo = {
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

export type RoutineItemInfo = {
  id: number
  name: string
  category: string | null
  has_weight: boolean
  has_length: boolean
  has_duration: boolean
  has_sets: boolean
  has_reps: boolean
}

export type RoutineLogInfo = {
  id: number
  routine_item_id: number
  log_date: string
  status: 'done' | 'skipped'
  value_weight: number | null
  value_length: number | null
  value_duration: number | null
  value_sets: number | null
  value_reps: number | null
}

export type RestDayRoutines = {
  items: RoutineItemInfo[]
  logs: RoutineLogInfo[]
}

type RestDayResult = {
  type: 'rest_day'
  date: string
  mesocycle: MesocycleInfo
  routines: RestDayRoutines
}

type NoActiveMesoResult = {
  type: 'no_active_mesocycle'
  date: string
}

export type LoggedSetData = {
  set_number: number
  actual_reps: number | null
  actual_weight: number | null
  actual_rpe: number | null
}

export type LoggedExerciseData = {
  id: number
  exercise_name: string
  order: number
  sets: LoggedSetData[]
}

export type LoggedWorkoutSummary = {
  id: number
  log_date: string
  logged_at: Date
  canonical_name: string | null
  rating: number | null
  notes: string | null
  template_snapshot: { version: number; [key: string]: unknown }
  exercises: LoggedExerciseData[]
}

type AlreadyLoggedResult = {
  type: 'already_logged'
  date: string
  mesocycle: MesocycleInfo
  loggedWorkout: LoggedWorkoutSummary
}

export type TodayResult = WorkoutResult | RestDayResult | NoActiveMesoResult | AlreadyLoggedResult

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

// Fetch active routines + logs for a given date
async function getRestDayRoutines(today: string): Promise<RestDayRoutines> {
  const [allItems, allMesos, logs] = await Promise.all([
    db.select().from(routine_items).all(),
    db.select().from(mesocycles).all(),
    db.select().from(routine_logs).where(eq(routine_logs.log_date, today)).all(),
  ])

  const activeItems = filterActiveRoutineItems(allItems, allMesos, today)

  return {
    items: activeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      has_weight: item.has_weight,
      has_length: item.has_length,
      has_duration: item.has_duration,
      has_sets: item.has_sets,
      has_reps: item.has_reps,
    })),
    logs: logs.map((log) => ({
      id: log.id,
      routine_item_id: log.routine_item_id,
      log_date: log.log_date,
      status: log.status as 'done' | 'skipped',
      value_weight: log.value_weight,
      value_length: log.value_length,
      value_duration: log.value_duration,
      value_sets: log.value_sets,
      value_reps: log.value_reps,
    })),
  }
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
    const routines = await getRestDayRoutines(today)
    return { type: 'rest_day', date: today, mesocycle: mesoInfo, routines }
  }

  // Step 6: load template
  const template = await db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, scheduleRow.template_id))
    .get()

  if (!template) {
    const routines = await getRestDayRoutines(today)
    return { type: 'rest_day', date: today, mesocycle: mesoInfo, routines }
  }

  // Step 7: check if already logged for today + active mesocycle
  const existingLog = await db
    .select({
      id: logged_workouts.id,
      log_date: logged_workouts.log_date,
      logged_at: logged_workouts.logged_at,
      canonical_name: logged_workouts.canonical_name,
      rating: logged_workouts.rating,
      notes: logged_workouts.notes,
      template_snapshot: logged_workouts.template_snapshot,
    })
    .from(logged_workouts)
    .innerJoin(
      workout_templates,
      eq(logged_workouts.template_id, workout_templates.id)
    )
    .where(
      and(
        eq(logged_workouts.log_date, today),
        eq(workout_templates.mesocycle_id, activeMeso.id)
      )
    )
    .get()

  if (existingLog) {
    // Fetch logged exercises + sets for resistance summary
    const loggedExerciseRows = await db
      .select({
        id: logged_exercises.id,
        exercise_name: logged_exercises.exercise_name,
        order: logged_exercises.order,
      })
      .from(logged_exercises)
      .where(eq(logged_exercises.logged_workout_id, existingLog.id))
      .orderBy(asc(logged_exercises.order))
      .all()

    const exercisesWithSets: LoggedExerciseData[] = []
    for (const ex of loggedExerciseRows) {
      const sets = await db
        .select({
          set_number: logged_sets.set_number,
          actual_reps: logged_sets.actual_reps,
          actual_weight: logged_sets.actual_weight,
          actual_rpe: logged_sets.actual_rpe,
        })
        .from(logged_sets)
        .where(eq(logged_sets.logged_exercise_id, ex.id))
        .orderBy(asc(logged_sets.set_number))
        .all()

      exercisesWithSets.push({ ...ex, sets })
    }

    return {
      type: 'already_logged',
      date: today,
      mesocycle: mesoInfo,
      loggedWorkout: {
        ...existingLog,
        exercises: exercisesWithSets,
      },
    }
  }

  // Step 8: load exercise slots
  const slots = await db
    .select({
      id: exercise_slots.id,
      exercise_id: exercise_slots.exercise_id,
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
