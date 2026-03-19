import { describe, it, expect } from 'vitest'
import { findMatchingSlots, type SlotIdentifier } from './slot-matching'

// Helper to create slot identifiers
function slot(exerciseId: number, order: number, id = 0): SlotIdentifier {
  return { id, exercise_id: exerciseId, order }
}

describe('findMatchingSlots', () => {
  describe('primary match: exercise_id + order', () => {
    it('matches slots with identical exercise_id and order', () => {
      const sourceSlots: SlotIdentifier[] = [
        slot(1, 0, 10),
        slot(2, 1, 11),
        slot(3, 2, 12),
      ]
      const targetSlots: SlotIdentifier[] = [
        slot(1, 0, 20),
        slot(2, 1, 21),
        slot(3, 2, 22),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches).toEqual(
        new Map([
          [10, { targetSlotId: 20, matchType: 'exact' }],
          [11, { targetSlotId: 21, matchType: 'exact' }],
          [12, { targetSlotId: 22, matchType: 'exact' }],
        ])
      )
      expect(result.skipped).toEqual(new Map())
    })

    it('matches single source slot to target at same position', () => {
      const sourceSlots: SlotIdentifier[] = [slot(5, 2, 10)]
      const targetSlots: SlotIdentifier[] = [
        slot(4, 0, 20),
        slot(5, 2, 22),
        slot(6, 3, 23),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.get(10)).toEqual({
        targetSlotId: 22,
        matchType: 'exact',
      })
    })
  })

  describe('fallback match: exercise_id at any position', () => {
    it('falls back to exercise_id match when order differs', () => {
      // Source has Bench at order 0, target has Bench at order 2
      const sourceSlots: SlotIdentifier[] = [slot(1, 0, 10)]
      const targetSlots: SlotIdentifier[] = [
        slot(2, 0, 20),
        slot(3, 1, 21),
        slot(1, 2, 22),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.get(10)).toEqual({
        targetSlotId: 22,
        matchType: 'fallback',
      })
    })

    it('uses fallback only when exact match fails', () => {
      // exercise 1 at order 0 in source, exercise 1 at order 0 AND order 2 in target
      // Order 0 matches exactly — should use exact, not fallback
      const sourceSlots: SlotIdentifier[] = [slot(1, 0, 10)]
      const targetSlots: SlotIdentifier[] = [
        slot(1, 0, 20),
        slot(2, 1, 21),
        slot(1, 2, 22),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.get(10)).toEqual({
        targetSlotId: 20,
        matchType: 'exact',
      })
    })
  })

  describe('ambiguous fallback: skip when multiple matches', () => {
    it('skips when exercise_id appears multiple times in target at different positions', () => {
      // Source: exercise 1 at order 0. Target: exercise 1 at order 1 and order 2
      // No exact match (order 0 doesn't have exercise 1 in target), fallback is ambiguous
      const sourceSlots: SlotIdentifier[] = [slot(1, 0, 10)]
      const targetSlots: SlotIdentifier[] = [
        slot(2, 0, 20),
        slot(1, 1, 21),
        slot(1, 2, 22),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.has(10)).toBe(false)
      expect(result.skipped.get(10)).toBe('ambiguous')
    })
  })

  describe('no match: exercise not in target', () => {
    it('skips when exercise_id not found in target at all', () => {
      const sourceSlots: SlotIdentifier[] = [slot(1, 0, 10)]
      const targetSlots: SlotIdentifier[] = [
        slot(2, 0, 20),
        slot(3, 1, 21),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.has(10)).toBe(false)
      expect(result.skipped.get(10)).toBe('no-match')
    })
  })

  describe('empty inputs', () => {
    it('returns empty maps when source is empty', () => {
      const result = findMatchingSlots([], [slot(1, 0, 20)])

      expect(result.matches.size).toBe(0)
      expect(result.skipped.size).toBe(0)
    })

    it('skips all source slots when target is empty', () => {
      const sourceSlots: SlotIdentifier[] = [slot(1, 0, 10), slot(2, 1, 11)]

      const result = findMatchingSlots(sourceSlots, [])

      expect(result.matches.size).toBe(0)
      expect(result.skipped.get(10)).toBe('no-match')
      expect(result.skipped.get(11)).toBe('no-match')
    })
  })

  describe('edge case from spec: diverged templates', () => {
    it('matches Bench and OHP, skips Squat in diverged template', () => {
      // Phase 1: [Bench(1), Squat(2), OHP(3)]
      // Phase 2 diverged: [Bench(1), Deadlift(4), OHP(3)]
      const sourceSlots: SlotIdentifier[] = [
        slot(1, 0, 10), // Bench
        slot(2, 1, 11), // Squat
        slot(3, 2, 12), // OHP
      ]
      const targetSlots: SlotIdentifier[] = [
        slot(1, 0, 20), // Bench
        slot(4, 1, 21), // Deadlift
        slot(3, 2, 22), // OHP
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      // Bench: exact match
      expect(result.matches.get(10)).toEqual({
        targetSlotId: 20,
        matchType: 'exact',
      })
      // Squat: not in target
      expect(result.skipped.get(11)).toBe('no-match')
      // OHP: exact match
      expect(result.matches.get(12)).toEqual({
        targetSlotId: 22,
        matchType: 'exact',
      })
    })
  })

  describe('mixed exact and fallback', () => {
    it('handles some slots matching exactly and others by fallback', () => {
      // Source: [Bench(1) @ 0, Squat(2) @ 1, OHP(3) @ 2]
      // Target: [Bench(1) @ 0, OHP(3) @ 1, Squat(2) @ 2]
      // Bench: exact. Squat: fallback (order 1 -> found at order 2, single match). OHP: fallback (order 2 -> found at order 1, single match).
      const sourceSlots: SlotIdentifier[] = [
        slot(1, 0, 10),
        slot(2, 1, 11),
        slot(3, 2, 12),
      ]
      const targetSlots: SlotIdentifier[] = [
        slot(1, 0, 20),
        slot(3, 1, 21),
        slot(2, 2, 22),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.get(10)).toEqual({
        targetSlotId: 20,
        matchType: 'exact',
      })
      expect(result.matches.get(11)).toEqual({
        targetSlotId: 22,
        matchType: 'fallback',
      })
      expect(result.matches.get(12)).toEqual({
        targetSlotId: 21,
        matchType: 'fallback',
      })
      expect(result.skipped.size).toBe(0)
    })
  })

  describe('duplicate exercises in source', () => {
    it('matches duplicate exercises at different orders independently', () => {
      // Source: [Bench(1) @ 0, Bench(1) @ 1]
      // Target: [Bench(1) @ 0, Bench(1) @ 1]
      const sourceSlots: SlotIdentifier[] = [
        slot(1, 0, 10),
        slot(1, 1, 11),
      ]
      const targetSlots: SlotIdentifier[] = [
        slot(1, 0, 20),
        slot(1, 1, 21),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.matches.get(10)).toEqual({
        targetSlotId: 20,
        matchType: 'exact',
      })
      expect(result.matches.get(11)).toEqual({
        targetSlotId: 21,
        matchType: 'exact',
      })
    })

    it('skips duplicate exercise when no exact match and fallback is ambiguous', () => {
      // Source: [Bench(1) @ 0, Bench(1) @ 1]
      // Target: [Squat(2) @ 0, Bench(1) @ 1, Bench(1) @ 2]
      // Slot 10 (Bench @ 0): no exact match at order 0, fallback finds 2 Benches -> ambiguous
      // Slot 11 (Bench @ 1): exact match at order 1
      const sourceSlots: SlotIdentifier[] = [
        slot(1, 0, 10),
        slot(1, 1, 11),
      ]
      const targetSlots: SlotIdentifier[] = [
        slot(2, 0, 20),
        slot(1, 1, 21),
        slot(1, 2, 22),
      ]

      const result = findMatchingSlots(sourceSlots, targetSlots)

      expect(result.skipped.get(10)).toBe('ambiguous')
      expect(result.matches.get(11)).toEqual({
        targetSlotId: 21,
        matchType: 'exact',
      })
    })
  })
})
