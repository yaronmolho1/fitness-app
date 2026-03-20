import { desc, isNotNull, ne, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { exercises } from '@/lib/db/schema'

export async function getExercises() {
  return db.select().from(exercises).orderBy(desc(exercises.created_at))
}

export async function getDistinctExerciseValues(): Promise<{
  equipment: string[]
  muscle_groups: string[]
}> {
  const [equipmentRows, muscleGroupRows] = await Promise.all([
    db
      .selectDistinct({ equipment: exercises.equipment })
      .from(exercises)
      .where(and(isNotNull(exercises.equipment), ne(exercises.equipment, '')))
      .all(),
    db
      .selectDistinct({ muscle_group: exercises.muscle_group })
      .from(exercises)
      .where(
        and(isNotNull(exercises.muscle_group), ne(exercises.muscle_group, ''))
      )
      .all(),
  ])

  return {
    equipment: equipmentRows
      .map((r) => r.equipment!)
      .sort((a, b) => a.localeCompare(b)),
    muscle_groups: muscleGroupRows
      .map((r) => r.muscle_group!)
      .sort((a, b) => a.localeCompare(b)),
  }
}
