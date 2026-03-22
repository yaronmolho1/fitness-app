import { eq, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { workout_templates, mesocycles, exercise_slots } from '@/lib/db/schema'

export type BrowseTemplate = {
  id: number
  name: string
  canonical_name: string
  modality: 'resistance' | 'running' | 'mma' | 'mixed'
  exercise_count: number
  mesocycle_id: number
  mesocycle_name: string
}

// Fetches all templates from other mesocycles for the browse/copy dialog
export async function getBrowseTemplates(
  excludeMesocycleId: number
): Promise<BrowseTemplate[]> {
  const rows = await db
    .select({
      id: workout_templates.id,
      name: workout_templates.name,
      canonical_name: workout_templates.canonical_name,
      modality: workout_templates.modality,
      exercise_count: sql<number>`(
        SELECT COUNT(*) FROM ${exercise_slots}
        WHERE ${exercise_slots.template_id} = ${workout_templates.id}
      )`,
      mesocycle_id: workout_templates.mesocycle_id,
      mesocycle_name: mesocycles.name,
    })
    .from(workout_templates)
    .innerJoin(mesocycles, eq(mesocycles.id, workout_templates.mesocycle_id))
    .where(ne(workout_templates.mesocycle_id, excludeMesocycleId))
    .all()

  return rows as BrowseTemplate[]
}
