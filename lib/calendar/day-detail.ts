import { and, eq, gte, lte, asc } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  mesocycles,
  weekly_schedule,
  workout_templates,
  exercise_slots,
  exercises,
  logged_workouts,
  logged_exercises,
  logged_sets,
} from '@/lib/db/schema'

// Slot target data from live template
export type SlotDetail = {
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

export type TemplateDetail = {
  id: number
  name: string
  modality: string
  notes: string | null
  run_type: string | null
  target_pace: string | null
  hr_zone: number | null
  interval_count: number | null
  interval_rest: number | null
  coaching_cues: string | null
  planned_duration: number | null
}

export type LoggedSetDetail = {
  set_number: number
  actual_reps: number | null
  actual_weight: number | null
  actual_rpe: number | null
}

export type LoggedExerciseDetail = {
  exercise_name: string
  order: number
  sets: LoggedSetDetail[]
}

export type TemplateSnapshot = {
  version: number
  name?: string
  modality?: string
  notes?: string | null
  slots?: Array<{
    exercise_name: string
    sets: number
    reps: string
    weight: number | null
    rpe: number | null
    rest_seconds: number | null
    guidelines: string | null
    order: number
    is_main: boolean
  }>
  [key: string]: unknown
}

type RestResult = {
  type: 'rest'
  date: string
}

type ProjectedResult = {
  type: 'projected'
  date: string
  template: TemplateDetail
  slots: SlotDetail[]
  is_deload: boolean
}

type CompletedResult = {
  type: 'completed'
  date: string
  snapshot: TemplateSnapshot
  exercises: LoggedExerciseDetail[]
  rating: number | null
  notes: string | null
  is_deload: boolean
}

export type DayDetailResult = RestResult | ProjectedResult | CompletedResult

// 0=Mon..6=Sun from YYYY-MM-DD
function isoDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

function daysBetween(startDate: string, date: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(date + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export async function getDayDetail(
  database: AppDb,
  date: string
): Promise<DayDetailResult> {
  // Find mesocycle covering this date
  const meso = database
    .select({
      id: mesocycles.id,
      start_date: mesocycles.start_date,
      end_date: mesocycles.end_date,
      work_weeks: mesocycles.work_weeks,
      has_deload: mesocycles.has_deload,
    })
    .from(mesocycles)
    .where(and(lte(mesocycles.start_date, date), gte(mesocycles.end_date, date)))
    .get()

  if (!meso) {
    return { type: 'rest', date }
  }

  // Determine week type (normal vs deload)
  const daysFromStart = daysBetween(meso.start_date, date)
  const weekNumber = Math.floor(daysFromStart / 7) + 1
  const hasDeload = meso.has_deload === true || (meso.has_deload as unknown) === 1
  const isDeload = hasDeload && weekNumber > meso.work_weeks
  const weekType = isDeload ? 'deload' : 'normal'

  const dow = isoDayOfWeek(date)

  // Check schedule
  const schedEntry = database
    .select({
      template_id: weekly_schedule.template_id,
    })
    .from(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, meso.id),
        eq(weekly_schedule.day_of_week, dow),
        eq(weekly_schedule.week_type, weekType)
      )
    )
    .get()

  if (!schedEntry || !schedEntry.template_id) {
    return { type: 'rest', date }
  }

  // Check if completed (logged workout exists for this date)
  const loggedWorkout = database
    .select({
      id: logged_workouts.id,
      rating: logged_workouts.rating,
      notes: logged_workouts.notes,
      template_snapshot: logged_workouts.template_snapshot,
    })
    .from(logged_workouts)
    .where(eq(logged_workouts.log_date, date))
    .get()

  if (loggedWorkout) {
    // Fetch logged exercises + sets
    const loggedExerciseRows = database
      .select({
        id: logged_exercises.id,
        exercise_name: logged_exercises.exercise_name,
        order: logged_exercises.order,
      })
      .from(logged_exercises)
      .where(eq(logged_exercises.logged_workout_id, loggedWorkout.id))
      .orderBy(asc(logged_exercises.order))
      .all()

    const exercisesWithSets: LoggedExerciseDetail[] = []
    for (const ex of loggedExerciseRows) {
      const sets = database
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

      exercisesWithSets.push({
        exercise_name: ex.exercise_name,
        order: ex.order,
        sets,
      })
    }

    const snapshot = loggedWorkout.template_snapshot as unknown
    if (
      typeof snapshot !== 'object' ||
      snapshot === null ||
      !('version' in snapshot) ||
      typeof (snapshot as Record<string, unknown>).version !== 'number'
    ) {
      // Corrupted or missing snapshot — treat as rest
      return { type: 'rest', date }
    }

    return {
      type: 'completed',
      date,
      snapshot: snapshot as TemplateSnapshot,
      exercises: exercisesWithSets,
      rating: loggedWorkout.rating,
      notes: loggedWorkout.notes,
      is_deload: isDeload,
    }
  }

  // Projected — load live template
  const template = database
    .select({
      id: workout_templates.id,
      name: workout_templates.name,
      modality: workout_templates.modality,
      notes: workout_templates.notes,
      run_type: workout_templates.run_type,
      target_pace: workout_templates.target_pace,
      hr_zone: workout_templates.hr_zone,
      interval_count: workout_templates.interval_count,
      interval_rest: workout_templates.interval_rest,
      coaching_cues: workout_templates.coaching_cues,
      planned_duration: workout_templates.planned_duration,
    })
    .from(workout_templates)
    .where(eq(workout_templates.id, schedEntry.template_id))
    .get()

  if (!template) {
    return { type: 'rest', date }
  }

  // Load exercise slots for resistance templates
  const slots = database
    .select({
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
    .map((row) => ({ ...row, is_main: Boolean(row.is_main) })) as SlotDetail[]

  return {
    type: 'projected',
    date,
    template,
    slots,
    is_deload: isDeload,
  }
}
