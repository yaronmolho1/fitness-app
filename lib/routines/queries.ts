import { and, desc, eq, gte, lte, ne, isNotNull, sql } from 'drizzle-orm'
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

// Helper: format YYYY-MM-DD from a UTC Date
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Get previous day as YYYY-MM-DD
function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return formatDate(d)
}

// Streak = consecutive calendar days with status='done' ending on today (or yesterday if today has no log).
// Skipped or missing day breaks streak.
export async function getStreak(
  routineItemId: number,
  today: string
): Promise<number> {
  // Cap lookback to 90 days to bound memory usage
  const floor = new Date(today + 'T00:00:00Z')
  floor.setUTCDate(floor.getUTCDate() - 90)
  const floorDate = formatDate(floor)

  const logs = await db
    .select({
      log_date: routine_logs.log_date,
      status: routine_logs.status,
    })
    .from(routine_logs)
    .where(
      and(
        eq(routine_logs.routine_item_id, routineItemId),
        lte(routine_logs.log_date, today),
        gte(routine_logs.log_date, floorDate)
      )
    )
    .orderBy(desc(routine_logs.log_date))
    .all()

  const logMap = new Map(logs.map((l) => [l.log_date, l.status]))

  // Determine anchor: today if logged as done, else yesterday
  let anchor = today
  if (logMap.get(today) === 'done') {
    anchor = today
  } else if (logMap.get(today) === 'skipped') {
    return 0
  } else {
    // No log today — anchor to yesterday
    anchor = prevDay(today)
  }

  // Walk backwards from anchor counting consecutive 'done' days
  let streak = 0
  let current = anchor
  while (logMap.get(current) === 'done') {
    streak++
    current = prevDay(current)
  }

  return streak
}

// Batch fetch streaks for multiple routine items
export async function getStreaks(
  routineItemIds: number[],
  today: string
): Promise<Map<number, number>> {
  if (routineItemIds.length === 0) return new Map()

  const map = new Map<number, number>()
  // For now, fetch individually. Can optimize with a single query later if needed.
  for (const id of routineItemIds) {
    map.set(id, await getStreak(id, today))
  }
  return map
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

export async function getDistinctRoutineCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: routine_items.category })
    .from(routine_items)
    .where(
      and(isNotNull(routine_items.category), ne(routine_items.category, ''))
    )
    .all()

  return rows
    .map((r) => r.category!)
    .sort((a, b) => a.localeCompare(b))
}
