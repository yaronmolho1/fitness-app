// Shared superset grouping logic for display components

export type SlotWithGroup = {
  id: number
  group_id: number | null
  group_rest_seconds: number | null
  [key: string]: unknown
}

export type GroupedSlotItem<T extends SlotWithGroup> =
  | { type: 'slot'; slot: T }
  | { type: 'group'; groupId: number; slots: T[]; groupRestSeconds: number }

// Groups contiguous slots by group_id, preserving order
export function groupSlotsByGroupId<T extends SlotWithGroup>(slots: T[]): GroupedSlotItem<T>[] {
  const items: GroupedSlotItem<T>[] = []
  let i = 0

  while (i < slots.length) {
    const slot = slots[i]
    if (slot.group_id !== null) {
      const groupId = slot.group_id
      const groupSlots: T[] = []
      while (i < slots.length && slots[i].group_id === groupId) {
        groupSlots.push(slots[i])
        i++
      }
      items.push({
        type: 'group',
        groupId,
        slots: groupSlots,
        groupRestSeconds: groupSlots[0].group_rest_seconds ?? 0,
      })
    } else {
      items.push({ type: 'slot', slot })
      i++
    }
  }

  return items
}

export function getGroupLabel(count: number): string {
  if (count === 2) return 'Superset'
  if (count === 3) return 'Tri-set'
  return 'Giant set'
}

export function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}
