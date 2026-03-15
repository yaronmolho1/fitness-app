import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { routine_items, mesocycles } from '@/lib/db/schema'

export type RoutineItemWithMesocycle = {
  routine_item: typeof routine_items.$inferSelect
  mesocycle_name: string | null
}

export async function getRoutineItems(): Promise<RoutineItemWithMesocycle[]> {
  const rows = await db
    .select({
      routine_item: routine_items,
      mesocycle_name: mesocycles.name,
    })
    .from(routine_items)
    .leftJoin(mesocycles, eq(routine_items.mesocycle_id, mesocycles.id))
    .orderBy(desc(routine_items.created_at))

  return rows
}
