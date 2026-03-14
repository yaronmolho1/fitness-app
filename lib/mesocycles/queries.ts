import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mesocycles } from '@/lib/db/schema'

export async function getMesocycles() {
  return db.select().from(mesocycles).orderBy(desc(mesocycles.id))
}

export async function getMesocycleById(id: number) {
  return db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, id))
    .get()
}
