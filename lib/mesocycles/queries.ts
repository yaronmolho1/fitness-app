import { asc, count, desc, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mesocycles, workout_templates, weekly_schedule, routine_items } from '@/lib/db/schema'

export type CascadeSummary = {
  templates: number
  schedules: number
  routineItems: number
}

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

export async function getActiveMesocycle() {
  return db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.status, 'active'))
    .get()
}

export async function getNonCompletedMesocycles() {
  return db
    .select()
    .from(mesocycles)
    .where(ne(mesocycles.status, 'completed'))
    .orderBy(asc(mesocycles.start_date))
    .all()
}

export async function getMesocycleCascadeSummary(id: number): Promise<CascadeSummary> {
  const [tplRow, schedRow, riRow] = [
    db.select({ c: count() }).from(workout_templates)
      .where(eq(workout_templates.mesocycle_id, id)).get(),
    db.select({ c: count() }).from(weekly_schedule)
      .where(eq(weekly_schedule.mesocycle_id, id)).get(),
    db.select({ c: count() }).from(routine_items)
      .where(eq(routine_items.mesocycle_id, id)).get(),
  ]

  return {
    templates: tplRow?.c ?? 0,
    schedules: schedRow?.c ?? 0,
    routineItems: riRow?.c ?? 0,
  }
}
