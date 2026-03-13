import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { exercises } from '@/lib/db/schema'

export async function getExercises() {
  return db.select().from(exercises).orderBy(desc(exercises.created_at))
}
