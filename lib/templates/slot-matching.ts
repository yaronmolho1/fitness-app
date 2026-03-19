// Slot matching for cascade operations across sibling templates

export type SlotIdentifier = {
  id: number
  exercise_id: number
  order: number
}

export type MatchType = 'exact' | 'fallback'

export type SlotMatch = {
  targetSlotId: number
  matchType: MatchType
}

export type SkipReason = 'no-match' | 'ambiguous'

export type SlotMatchResult = {
  /** Maps source slot id -> matched target slot */
  matches: Map<number, SlotMatch>
  /** Maps source slot id -> reason it was skipped */
  skipped: Map<number, SkipReason>
}

/**
 * Match source template slots to target template slots.
 *
 * Strategy:
 * 1. Primary: exercise_id + order (exact position match)
 * 2. Fallback: exercise_id at any position, only if single match in target
 * 3. Skip with reason if no match or ambiguous
 */
export function findMatchingSlots(
  sourceSlots: SlotIdentifier[],
  targetSlots: SlotIdentifier[]
): SlotMatchResult {
  const matches = new Map<number, SlotMatch>()
  const skipped = new Map<number, SkipReason>()

  // Index target slots by (exercise_id, order) for O(1) exact lookup
  const targetByKey = new Map<string, SlotIdentifier>()
  for (const t of targetSlots) {
    targetByKey.set(`${t.exercise_id}:${t.order}`, t)
  }

  // Index target slots by exercise_id for fallback lookup
  const targetByExercise = new Map<number, SlotIdentifier[]>()
  for (const t of targetSlots) {
    const existing = targetByExercise.get(t.exercise_id)
    if (existing) {
      existing.push(t)
    } else {
      targetByExercise.set(t.exercise_id, [t])
    }
  }

  for (const source of sourceSlots) {
    const key = `${source.exercise_id}:${source.order}`
    const exactMatch = targetByKey.get(key)

    if (exactMatch) {
      matches.set(source.id, {
        targetSlotId: exactMatch.id,
        matchType: 'exact',
      })
      continue
    }

    // Fallback: find by exercise_id at any position
    const candidates = targetByExercise.get(source.exercise_id)

    if (!candidates || candidates.length === 0) {
      skipped.set(source.id, 'no-match')
      continue
    }

    if (candidates.length === 1) {
      matches.set(source.id, {
        targetSlotId: candidates[0].id,
        matchType: 'fallback',
      })
      continue
    }

    // Multiple candidates — ambiguous
    skipped.set(source.id, 'ambiguous')
  }

  return { matches, skipped }
}
