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

type InputFieldFlags = {
  has_weight: boolean
  has_length: boolean
  has_duration: boolean
  has_sets: boolean
  has_reps: boolean
}

const FIELD_LABELS: [keyof InputFieldFlags, string][] = [
  ['has_weight', 'weight'],
  ['has_length', 'length'],
  ['has_duration', 'duration'],
  ['has_sets', 'sets'],
  ['has_reps', 'reps'],
]

export function formatInputFields(item: InputFieldFlags): string {
  return FIELD_LABELS.filter(([key]) => item[key])
    .map(([, label]) => label)
    .join(', ')
}

export function formatScopeSummary(
  scope: string,
  skipOnDeload: boolean,
  mesocycleName: string | null,
  startDate: string | null,
  endDate: string | null
): string {
  if (skipOnDeload) return 'Skip on deload'

  if (scope === 'mesocycle' && mesocycleName) {
    return `Mesocycle: ${mesocycleName}`
  }

  if (scope === 'date_range' && startDate && endDate) {
    const fmt = (d: string) => {
      const date = new Date(d + 'T00:00:00')
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return `${fmt(startDate)} – ${fmt(endDate)}`
  }

  return 'Global'
}
