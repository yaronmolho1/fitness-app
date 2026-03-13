'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { workout_templates, mesocycles } from '@/lib/db/schema'
import { generateCanonicalName } from './utils'

type CreateResistanceTemplateInput = {
  name: string
  mesocycle_id: number
}

type TemplateRow = typeof workout_templates.$inferSelect

type CreateResistanceTemplateResult =
  | { success: true; data: TemplateRow }
  | { success: false; error: string }

export async function createResistanceTemplate(
  input: CreateResistanceTemplateInput
): Promise<CreateResistanceTemplateResult> {
  const name = input.name.trim()
  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  const canonicalName = generateCanonicalName(name)
  if (!canonicalName) {
    return { success: false, error: 'Name produces an empty canonical_name after slug conversion' }
  }

  // Check mesocycle exists
  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, input.mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return { success: false, error: 'Cannot create template on a completed mesocycle' }
  }

  // Check canonical_name uniqueness within mesocycle
  const existing = db
    .select()
    .from(workout_templates)
    .where(
      and(
        eq(workout_templates.mesocycle_id, input.mesocycle_id),
        eq(workout_templates.canonical_name, canonicalName)
      )
    )
    .get()

  if (existing) {
    return {
      success: false,
      error: `A template with duplicate canonical name "${canonicalName}" already exists in this mesocycle`,
    }
  }

  const created = db
    .insert(workout_templates)
    .values({
      mesocycle_id: input.mesocycle_id,
      name,
      canonical_name: canonicalName,
      modality: 'resistance',
      created_at: new Date(),
    })
    .returning()
    .get()

  revalidatePath('/templates')
  return { success: true, data: created }
}
