'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { athlete_profile } from '@/lib/db/schema'

const profileSchema = z.object({
  age: z.number().int().positive().nullish(),
  weight_kg: z.number().positive().nullish(),
  height_cm: z.number().positive().nullish(),
  gender: z.string().nullish(),
  training_age_years: z.number().int().nonnegative().nullish(),
  primary_goal: z.string().nullish(),
  injury_history: z.string().nullish(),
})

type ProfileInput = z.input<typeof profileSchema>

type ProfileRow = typeof athlete_profile.$inferSelect

type SaveProfileResult =
  | { success: true; data: ProfileRow }
  | { success: false; error: string }

export async function saveAthleteProfile(input: ProfileInput): Promise<SaveProfileResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const data = parsed.data
  const now = new Date()

  // Check if profile already exists
  const existing = await db
    .select()
    .from(athlete_profile)
    .where(eq(athlete_profile.id, 1))

  try {
    let row: ProfileRow

    if (existing.length === 0) {
      // Insert new profile
      const [created] = await db
        .insert(athlete_profile)
        .values({
          age: data.age ?? null,
          weight_kg: data.weight_kg ?? null,
          height_cm: data.height_cm ?? null,
          gender: data.gender ?? null,
          training_age_years: data.training_age_years ?? null,
          primary_goal: data.primary_goal ?? null,
          injury_history: data.injury_history ?? null,
          created_at: now,
          updated_at: now,
        })
        .returning()
      row = created
    } else {
      // Update existing profile — only set provided fields
      const updates: Record<string, unknown> = { updated_at: now }
      if ('age' in data) updates.age = data.age ?? null
      if ('weight_kg' in data) updates.weight_kg = data.weight_kg ?? null
      if ('height_cm' in data) updates.height_cm = data.height_cm ?? null
      if ('gender' in data) updates.gender = data.gender ?? null
      if ('training_age_years' in data) updates.training_age_years = data.training_age_years ?? null
      if ('primary_goal' in data) updates.primary_goal = data.primary_goal ?? null
      if ('injury_history' in data) updates.injury_history = data.injury_history ?? null

      const [updated] = await db
        .update(athlete_profile)
        .set(updates)
        .where(eq(athlete_profile.id, 1))
        .returning()
      row = updated
    }

    revalidatePath('/coaching')
    return { success: true, data: row }
  } catch {
    return { success: false, error: 'Failed to save athlete profile' }
  }
}
