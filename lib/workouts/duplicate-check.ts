import { eq, and } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { logged_workouts } from '@/lib/db/schema'

// Check if a specific template is already logged for the given date
export async function hasExistingLog(
  database: AppDb,
  logDate: string,
  templateId: number
): Promise<boolean> {
  const existing = await database
    .select({ id: logged_workouts.id })
    .from(logged_workouts)
    .where(
      and(
        eq(logged_workouts.log_date, logDate),
        eq(logged_workouts.template_id, templateId)
      )
    )
    .get()

  return !!existing
}
