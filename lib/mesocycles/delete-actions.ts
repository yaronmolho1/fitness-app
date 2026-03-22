'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import { mesocycles, routine_items } from '@/lib/db/schema'

type DeleteResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteMesocycle(id: number): Promise<DeleteResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid mesocycle ID' }
  }

  return db.transaction((tx) => {
    const meso = tx
      .select({ id: mesocycles.id, status: mesocycles.status })
      .from(mesocycles)
      .where(eq(mesocycles.id, id))
      .get()

    if (!meso) {
      return { success: false, error: 'Mesocycle not found' } as const
    }

    if (meso.status === 'active') {
      return {
        success: false,
        error: 'Cannot delete an active mesocycle. Complete it first.',
      } as const
    }

    // Promote mesocycle-scoped routine items to global before cascade delete
    tx.update(routine_items)
      .set({ mesocycle_id: null, scope: 'global' })
      .where(eq(routine_items.mesocycle_id, id))
      .run()

    // Delete mesocycle — templates, slots, sections, schedule cascade via FK
    tx.delete(mesocycles).where(eq(mesocycles.id, id)).run()

    revalidatePath('/mesocycles')
    return { success: true } as const
  })
}
