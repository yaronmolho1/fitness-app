import { eq, and } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { logged_workouts, workout_templates } from '@/lib/db/schema'

// Check if a workout is already logged for the given date + mesocycle
export async function hasExistingLog(
  database: AppDb,
  logDate: string,
  mesocycleId: number
): Promise<boolean> {
  const existing = await database
    .select({ id: logged_workouts.id })
    .from(logged_workouts)
    .innerJoin(
      workout_templates,
      eq(logged_workouts.template_id, workout_templates.id)
    )
    .where(
      and(
        eq(logged_workouts.log_date, logDate),
        eq(workout_templates.mesocycle_id, mesocycleId)
      )
    )
    .get()

  return !!existing
}
