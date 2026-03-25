import { eq, gte, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { AppDb } from '@/lib/db'
import { athlete_profile, logged_workouts, logged_exercises, logged_sets } from '@/lib/db/schema'

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
