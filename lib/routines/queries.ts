import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { routine_items, routine_logs, mesocycles } from '@/lib/db/schema'

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

export async function getRoutineLogsForDate(logDate: string) {
  return db
    .select()
    .from(routine_logs)
    .where(eq(routine_logs.log_date, logDate))
}

// Get Monday of the ISO week (Mon-Sun) containing the given date
export function getWeekMonday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  date.setUTCDate(date.getUTCDate() - diff)
  return date.toISOString().slice(0, 10)
}

// Get Sunday of the ISO week (Mon-Sun) containing the given date
function getWeekSunday(dateStr: string): string {
  const monday = getWeekMonday(dateStr)
  const date = new Date(monday + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + 6)
  return date.toISOString().slice(0, 10)
}

// Count routine_logs with status='done' in the Mon-Sun week containing `date`
export async function getWeeklyCompletionCount(
  routineItemId: number,
  date: string
): Promise<number> {
  const monday = getWeekMonday(date)
  const sunday = getWeekSunday(date)

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(routine_logs)
    .where(
      and(
        eq(routine_logs.routine_item_id, routineItemId),
        eq(routine_logs.status, 'done'),
        gte(routine_logs.log_date, monday),
        lte(routine_logs.log_date, sunday)
      )
    )
    .get()

  return result?.count ?? 0
}

// Batch fetch weekly counts for multiple routine items
export async function getWeeklyCompletionCounts(
  routineItemIds: number[],
  date: string
): Promise<Map<number, number>> {
  if (routineItemIds.length === 0) return new Map()

  const monday = getWeekMonday(date)
  const sunday = getWeekSunday(date)

  const rows = await db
    .select({
      routine_item_id: routine_logs.routine_item_id,
      count: sql<number>`count(*)`,
    })
    .from(routine_logs)
    .where(
      and(
        eq(routine_logs.status, 'done'),
        gte(routine_logs.log_date, monday),
        lte(routine_logs.log_date, sunday)
      )
    )
    .groupBy(routine_logs.routine_item_id)
    .all()

  const map = new Map<number, number>()
  for (const row of rows) {
    if (routineItemIds.includes(row.routine_item_id)) {
      map.set(row.routine_item_id, row.count)
    }
  }
  return map
}
