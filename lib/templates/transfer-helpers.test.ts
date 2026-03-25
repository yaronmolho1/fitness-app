import { describe, it, expect } from 'vitest'
import { collectGroupSlotIds, shouldPromptSuperset } from './transfer-helpers'

type MinimalSlot = { id: number; group_id: number | null }

const slots: MinimalSlot[] = [
  { id: 1, group_id: 1 },
  { id: 2, group_id: 1 },
  { id: 3, group_id: 1 },
  { id: 4, group_id: null },
  { id: 5, group_id: 2 },
  { id: 6, group_id: 2 },
]

describe('collectGroupSlotIds', () => {
  it('returns all slot ids sharing the same group_id', () => {
    expect(collectGroupSlotIds(slots, 1)).toEqual([1, 2, 3])
  })

  it('returns slot ids for a different group', () => {
    expect(collectGroupSlotIds(slots, 5)).toEqual([5, 6])
  })

  it('returns empty array for a standalone slot', () => {
    expect(collectGroupSlotIds(slots, 4)).toEqual([])
  })

  it('returns empty array for a non-existent slot id', () => {
    expect(collectGroupSlotIds(slots, 99)).toEqual([])
  })
})

describe('shouldPromptSuperset', () => {
  it('returns true when slot belongs to a group', () => {
    expect(shouldPromptSuperset(slots, 1)).toBe(true)
  })

  it('returns false for standalone slot', () => {
    expect(shouldPromptSuperset(slots, 4)).toBe(false)
  })

  it('returns false for non-existent slot', () => {
    expect(shouldPromptSuperset(slots, 99)).toBe(false)
  })
})
