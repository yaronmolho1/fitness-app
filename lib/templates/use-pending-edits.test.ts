// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { usePendingEdits } from './use-pending-edits'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

const makeSlot = (overrides: Partial<SlotWithExercise> = {}): SlotWithExercise => ({
  id: 1,
  template_id: 1,
  exercise_id: 1,
  section_id: null,
  sets: 3,
  reps: '10',
  weight: 80,
  rpe: 8,
  rest_seconds: 120,
  group_id: null,
  group_rest_seconds: null,
  guidelines: 'Slow eccentric',
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  ...overrides,
})

describe('usePendingEdits', () => {
  it('starts with no pending edits', () => {
    const { result } = renderHook(() => usePendingEdits())
    expect(result.current.hasPendingEdits).toBe(false)
    expect(result.current.pendingEditIds).toEqual([])
    expect(result.current.pendingEdits.size).toBe(0)
  })

  it('marks a slot as edited with diff', () => {
    const { result } = renderHook(() => usePendingEdits())
    const slot = makeSlot({ id: 1 })

    act(() => {
      result.current.markEdited(slot, { sets: 5 })
    })

    expect(result.current.hasPendingEdits).toBe(true)
    expect(result.current.pendingEditIds).toEqual([1])
    expect(result.current.pendingEdits.get(1)).toEqual({
      slot,
      diff: { sets: 5 },
    })
  })

  it('overwrites previous edit for same slot (latest wins)', () => {
    const { result } = renderHook(() => usePendingEdits())
    const slot = makeSlot({ id: 1 })

    act(() => {
      result.current.markEdited(slot, { sets: 5 })
    })
    act(() => {
      result.current.markEdited(slot, { sets: 8, reps: 12 })
    })

    expect(result.current.pendingEditIds).toEqual([1])
    expect(result.current.pendingEdits.get(1)?.diff).toEqual({ sets: 8, reps: 12 })
  })

  it('tracks multiple slots independently', () => {
    const { result } = renderHook(() => usePendingEdits())
    const slot1 = makeSlot({ id: 1 })
    const slot2 = makeSlot({ id: 2, exercise_name: 'Squat' })

    act(() => {
      result.current.markEdited(slot1, { sets: 5 })
      result.current.markEdited(slot2, { reps: 8 })
    })

    expect(result.current.pendingEditIds).toHaveLength(2)
    expect(result.current.pendingEditIds).toContain(1)
    expect(result.current.pendingEditIds).toContain(2)
  })

  it('clearAll removes all pending edits', () => {
    const { result } = renderHook(() => usePendingEdits())

    act(() => {
      result.current.markEdited(makeSlot({ id: 1 }), { sets: 5 })
      result.current.markEdited(makeSlot({ id: 2 }), { reps: 8 })
    })

    expect(result.current.hasPendingEdits).toBe(true)

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.hasPendingEdits).toBe(false)
    expect(result.current.pendingEdits.size).toBe(0)
  })

  it('clearOne removes a single pending edit', () => {
    const { result } = renderHook(() => usePendingEdits())

    act(() => {
      result.current.markEdited(makeSlot({ id: 1 }), { sets: 5 })
      result.current.markEdited(makeSlot({ id: 2 }), { reps: 8 })
    })

    act(() => {
      result.current.clearOne(1)
    })

    expect(result.current.pendingEditIds).toEqual([2])
    expect(result.current.pendingEdits.has(1)).toBe(false)
  })

  it('isEdited returns true for edited slots', () => {
    const { result } = renderHook(() => usePendingEdits())

    act(() => {
      result.current.markEdited(makeSlot({ id: 1 }), { sets: 5 })
    })

    expect(result.current.isEdited(1)).toBe(true)
    expect(result.current.isEdited(2)).toBe(false)
  })
})
