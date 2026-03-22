'use client'

import { useState, useCallback, useMemo } from 'react'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

export type PendingEdit = {
  slot: SlotWithExercise
  diff: Record<string, unknown>
}

export function usePendingEdits() {
  const [edits, setEdits] = useState<Map<number, PendingEdit>>(new Map())

  const markEdited = useCallback((slot: SlotWithExercise, diff: Record<string, unknown>) => {
    setEdits(prev => {
      const next = new Map(prev)
      next.set(slot.id, { slot, diff })
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setEdits(new Map())
  }, [])

  const clearOne = useCallback((slotId: number) => {
    setEdits(prev => {
      const next = new Map(prev)
      next.delete(slotId)
      return next
    })
  }, [])

  const isEdited = useCallback((slotId: number) => {
    return edits.has(slotId)
  }, [edits])

  const hasPendingEdits = edits.size > 0

  const pendingEditIds = useMemo(
    () => Array.from(edits.keys()),
    [edits]
  )

  return {
    pendingEdits: edits,
    hasPendingEdits,
    pendingEditIds,
    markEdited,
    clearAll,
    clearOne,
    isEdited,
  }
}
