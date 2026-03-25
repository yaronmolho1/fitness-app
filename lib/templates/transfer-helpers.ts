type SlotLike = { id: number; group_id: number | null }

// Returns all slot IDs sharing the same group_id as the given slot.
// Returns empty array if the slot has no group_id or doesn't exist.
export function collectGroupSlotIds(slots: SlotLike[], slotId: number): number[] {
  const slot = slots.find(s => s.id === slotId)
  if (!slot || slot.group_id === null) return []

  return slots
    .filter(s => s.group_id === slot.group_id)
    .map(s => s.id)
}

// Returns true if the slot belongs to a superset group (has a group_id).
export function shouldPromptSuperset(slots: SlotLike[], slotId: number): boolean {
  const slot = slots.find(s => s.id === slotId)
  return slot?.group_id !== null && slot?.group_id !== undefined
}
