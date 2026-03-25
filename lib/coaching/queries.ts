import { eq, gte, asc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { AppDb } from '@/lib/db'
import {
  athlete_profile,
  logged_workouts,
  logged_exercises,
  logged_sets,
  mesocycles,
  workout_templates,
  exercise_slots,
  exercises,
  weekly_schedule,
} from '@/lib/db/schema'

export async function getAthleteProfile() {
  const rows = await db
    .select()
    .from(athlete_profile)
    .where(eq(athlete_profile.id, 1))

  return rows[0] ?? null
}

export type RecentSession = {
  id: number
  logDate: string
  rating: number | null
  notes: string | null
  templateSnapshot: { version: number; [key: string]: unknown }
  canonicalName: string | null
  exercises: RecentSessionExercise[]
}

export type RecentSessionExercise = {
  id: number
  exerciseName: string
  order: number
  actualRpe: number | null
  sets: RecentSessionSet[]
}

export type RecentSessionSet = {
  id: number
  setNumber: number
  actualReps: number | null
  actualWeight: number | null
}

// Fetch logged workouts from the last N weeks with exercises and sets, chronological order
export async function getRecentSessions(
  db: AppDb,
  weeks: number = 4
): Promise<RecentSession[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - weeks * 7)
  const cutoff = cutoffDate.toISOString().split('T')[0]

  const workouts = db
    .select()
    .from(logged_workouts)
    .where(gte(logged_workouts.log_date, cutoff))
    .orderBy(asc(logged_workouts.log_date))
    .all()

  const sessions: RecentSession[] = []

  for (const w of workouts) {
    const exercises = db
      .select()
      .from(logged_exercises)
      .where(eq(logged_exercises.logged_workout_id, w.id))
      .orderBy(asc(logged_exercises.order))
      .all()

    const sessionExercises: RecentSessionExercise[] = []

    for (const ex of exercises) {
      const sets = db
        .select()
        .from(logged_sets)
        .where(eq(logged_sets.logged_exercise_id, ex.id))
        .orderBy(asc(logged_sets.set_number))
        .all()

      sessionExercises.push({
        id: ex.id,
        exerciseName: ex.exercise_name,
        order: ex.order,
        actualRpe: ex.actual_rpe,
        sets: sets.map((s) => ({
          id: s.id,
          setNumber: s.set_number,
          actualReps: s.actual_reps,
          actualWeight: s.actual_weight,
        })),
      })
    }

    sessions.push({
      id: w.id,
      logDate: w.log_date,
      rating: w.rating,
      notes: w.notes,
      templateSnapshot: w.template_snapshot,
      canonicalName: w.canonical_name,
      exercises: sessionExercises,
    })
  }

  return sessions
}

export type CurrentPlanSlot = {
  id: number
  sets: number
  reps: string
  weight: number | null
  rpe: number | null
  rest_seconds: number | null
  order: number
  exercise_name: string
}

export type CurrentPlanTemplate = {
  id: number
  name: string
  canonical_name: string
  modality: string
  notes: string | null
  exercise_slots: CurrentPlanSlot[]
}

export type CurrentPlanScheduleEntry = {
  day_of_week: number
  template_id: number | null
  template_name: string | null
  week_type: string
  period: string
  time_slot: string | null
}

export type CurrentPlan = {
  mesocycle: {
    id: number
    name: string
    start_date: string
    end_date: string
    work_weeks: number
    has_deload: boolean
    status: string
  }
  templates: CurrentPlanTemplate[]
  schedule: CurrentPlanScheduleEntry[]
}

// Fetch active mesocycle with templates, exercise slots, exercises, and weekly schedule
export async function getCurrentPlan(
  db: AppDb
): Promise<CurrentPlan | null> {
  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.status, 'active'))
    .orderBy(asc(mesocycles.id))
    .get()

  if (!meso) return null

  const templates = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, meso.id))
    .all()

  const templateIds = templates.map((t) => t.id)

  // Fetch all slots in one query, grouped by template after
  const allSlots =
    templateIds.length > 0
      ? db
          .select({
            id: exercise_slots.id,
            template_id: exercise_slots.template_id,
            sets: exercise_slots.sets,
            reps: exercise_slots.reps,
            weight: exercise_slots.weight,
            rpe: exercise_slots.rpe,
            rest_seconds: exercise_slots.rest_seconds,
            order: exercise_slots.order,
            exercise_name: exercises.name,
          })
          .from(exercise_slots)
          .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
          .where(inArray(exercise_slots.template_id, templateIds))
          .orderBy(asc(exercise_slots.order))
          .all()
      : []

  // Group slots by template
  const slotsByTemplate = new Map<number, CurrentPlanSlot[]>()
  for (const slot of allSlots) {
    const list = slotsByTemplate.get(slot.template_id) ?? []
    list.push({
      id: slot.id,
      sets: slot.sets,
      reps: slot.reps,
      weight: slot.weight,
      rpe: slot.rpe,
      rest_seconds: slot.rest_seconds,
      order: slot.order,
      exercise_name: slot.exercise_name,
    })
    slotsByTemplate.set(slot.template_id, list)
  }

  const resultTemplates: CurrentPlanTemplate[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    canonical_name: t.canonical_name,
    modality: t.modality,
    notes: t.notes,
    exercise_slots: slotsByTemplate.get(t.id) ?? [],
  }))

  // Fetch weekly schedule with template names
  const scheduleRows = db
    .select({
      day_of_week: weekly_schedule.day_of_week,
      template_id: weekly_schedule.template_id,
      template_name: workout_templates.name,
      week_type: weekly_schedule.week_type,
      period: weekly_schedule.period,
      time_slot: weekly_schedule.time_slot,
    })
    .from(weekly_schedule)
    .leftJoin(
      workout_templates,
      eq(weekly_schedule.template_id, workout_templates.id)
    )
    .where(eq(weekly_schedule.mesocycle_id, meso.id))
    .orderBy(asc(weekly_schedule.day_of_week), asc(weekly_schedule.period))
    .all()

  return {
    mesocycle: meso,
    templates: resultTemplates,
    schedule: scheduleRows,
  }
}
