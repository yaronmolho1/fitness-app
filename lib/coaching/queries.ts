import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { athlete_profile } from '@/lib/db/schema'

export async function getAthleteProfile() {
  const rows = await db
    .select()
    .from(athlete_profile)
    .where(eq(athlete_profile.id, 1))

  return rows[0] ?? null
}
