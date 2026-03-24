// Characterization test — captures current behavior for safe refactoring
import { describe, it, expect } from 'vitest'
import { mergeSlotWithOverride } from './week-overrides'

describe('T155 characterize: mergeSlotWithOverride — id overwrite bug', () => {
  // NOTE: BUG — when mergeSlotWithOverride receives a full DB override row,
  // it iterates ALL keys including id, exercise_slot_id, week_number, is_deload,
  // created_at. These overwrite the base slot's own id field, breaking identity.
  // T155 should fix this by filtering to only the parameter fields.

  it('override.id overwrites slot.id (known bug)', () => {
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

    // Simulates a full slot_week_overrides row from DB
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

    // BUG: override.id (5) overwrites slot.id (100)
    expect(merged.id).toBe(5) // Should be 100 after fix
    // BUG: exercise_slot_id leaks onto the slot
    expect((merged as Record<string, unknown>).exercise_slot_id).toBe(100)
    // BUG: week_number leaks onto the slot
    expect((merged as Record<string, unknown>).week_number).toBe(2)
    // BUG: is_deload (0 is falsy but not null/undefined) does NOT overwrite
    // because 0 is falsy in JS — the condition `override[key] !== null && override[key] !== undefined`
    // passes for 0, so is_deload DOES get set
    expect((merged as Record<string, unknown>).is_deload).toBe(0)
    // BUG: created_at from override leaks onto slot
    expect((merged as Record<string, unknown>).created_at).toBeInstanceOf(Date)

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
    // BUG: id leaks from override
    expect((merged as Record<string, unknown>).id).toBe(1)
    // BUG: exercise_slot_id leaks
    expect((merged as Record<string, unknown>).exercise_slot_id).toBe(50)
    // BUG: week_number leaks
    expect((merged as Record<string, unknown>).week_number).toBe(1)
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

  it('is_deload=1 (truthy) leaks onto slot', () => {
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
    // BUG: is_deload leaks
    expect((merged as Record<string, unknown>).is_deload).toBe(1)
    // BUG: id overwritten
    expect(merged.id).toBe(5)
    // Intended overrides work
    expect(merged.weight).toBe(36)
    expect(merged.sets).toBe(2)
    expect(merged.rpe).toBe(5)
  })
})
