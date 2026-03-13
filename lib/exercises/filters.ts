import type { exercises } from '@/lib/db/schema'

export type Exercise = typeof exercises.$inferSelect
export type Modality = Exercise['modality'] | 'all'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function filterExercises(
  list: Exercise[],
  search: string,
  modality: Modality
): Exercise[] {
  const trimmed = search.trim()
  const pattern = trimmed ? new RegExp(escapeRegex(trimmed), 'i') : null

  return list.filter((exercise) => {
    if (modality !== 'all' && exercise.modality !== modality) return false
    if (!pattern) return true
    return pattern.test(exercise.name)
  })
}
