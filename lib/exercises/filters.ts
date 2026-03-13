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

  return list.filter((exercise) => {
    if (modality !== 'all' && exercise.modality !== modality) return false
    if (trimmed === '') return true
    const pattern = new RegExp(escapeRegex(trimmed), 'i')
    return pattern.test(exercise.name)
  })
}
