// Characterization test — updated after T155 fix for mergeSlotWithOverride
import { describe, it, expect } from 'vitest'
import { mergeSlotWithOverride } from './week-overrides'

describe('T155 characterize: mergeSlotWithOverride — id overwrite bug FIXED', () => {
  it('override.id does NOT overwrite slot.id (fixed)', () => {
    const baseSlot = {
      id: 100,
      template_id: 1,
      exercise_id: 10,
      sets: 3,
      reps: '8',
      weight: 80,
      rpe: 8,
      order: 1,
    }

    const overrideRow = {
      id: 5,
      exercise_slot_id: 100,
      week_number: 2,
      weight: 85,
      reps: null,
      sets: null,
      rpe: null,
      distance: null,
      duration: null,
      pace: null,
      is_deload: 0,
      created_at: new Date('2026-03-01'),
    }

    const merged = mergeSlotWithOverride(baseSlot, overrideRow)

    // FIXED: slot.id preserved
    expect(merged.id).toBe(100)
    // FIXED: metadata fields do not leak
    expect((merged as Record<string, unknown>).exercise_slot_id).toBeUndefined()
    expect((merged as Record<string, unknown>).week_number).toBeUndefined()
    expect((merged as Record<string, unknown>).is_deload).toBeUndefined()
    expect((merged as Record<string, unknown>).created_at).toBeUndefined()

    // Weight correctly overridden
    expect(merged.weight).toBe(85)
    // Null fields correctly fall back to base
    expect(merged.reps).toBe('8')
    expect(merged.sets).toBe(3)
    expect(merged.rpe).toBe(8)
  })

  it('override with only weight set: other nulls fall back to base', () => {
    const baseSlot = { weight: 60, reps: '10', sets: 3, rpe: 7 }
    const override = {
      id: 1,
      exercise_slot_id: 50,
      week_number: 1,
      weight: 65,
      reps: null,
      sets: null,
      rpe: null,
      distance: null,
      duration: null,
      pace: null,
      is_deload: 0,
      created_at: null,
    }

    const merged = mergeSlotWithOverride(baseSlot, override)
    expect(merged.weight).toBe(65)
    expect(merged.reps).toBe('10')
    expect(merged.sets).toBe(3)
    expect(merged.rpe).toBe(7)
    // FIXED: metadata does not leak
    expect((merged as Record<string, unknown>).id).toBeUndefined()
    expect((merged as Record<string, unknown>).exercise_slot_id).toBeUndefined()
    expect((merged as Record<string, unknown>).week_number).toBeUndefined()
  })

  it('null override returns shallow copy of base (no mutation)', () => {
    const baseSlot = { id: 100, weight: 60, reps: '10' }
    const merged = mergeSlotWithOverride(baseSlot, null)
    expect(merged).toEqual(baseSlot)
    expect(merged).not.toBe(baseSlot) // different reference
  })

  it('all-null override fields preserve base values', () => {
    const baseSlot = { weight: 60, reps: '10', sets: 3, rpe: 7 }
    const override = {
      id: null,
      exercise_slot_id: null,
      week_number: null,
      weight: null,
      reps: null,
      sets: null,
      rpe: null,
      distance: null,
      duration: null,
      pace: null,
      is_deload: null,
      created_at: null,
    }
    const merged = mergeSlotWithOverride(baseSlot, override)
    expect(merged).toEqual(baseSlot)
  })

  it('is_deload=1 does NOT leak onto slot (fixed)', () => {
    const baseSlot = { id: 100, weight: 60, sets: 3, rpe: 7 }
    const override = {
      id: 5,
      exercise_slot_id: 100,
      week_number: 4,
      weight: 36,
      reps: null,
      sets: 2,
      rpe: 5,
      distance: null,
      duration: null,
      pace: null,
      is_deload: 1,
      created_at: null,
    }

    const merged = mergeSlotWithOverride(baseSlot, override)
    // FIXED: is_deload does not leak
    expect((merged as Record<string, unknown>).is_deload).toBeUndefined()
    // FIXED: id preserved
    expect(merged.id).toBe(100)
    // Intended overrides work
    expect(merged.weight).toBe(36)
    expect(merged.sets).toBe(2)
    expect(merged.rpe).toBe(5)
  })
})
