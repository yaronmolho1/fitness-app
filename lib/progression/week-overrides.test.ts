import { describe, it, expect } from 'vitest'
import {
  mergeSlotWithOverride,
  computeDeloadDefaults,
} from './week-overrides'

describe('mergeSlotWithOverride', () => {
  const baseSlot = {
    weight: 60,
    reps: '8-10',
    sets: 3,
    rpe: 7,
  }

  it('returns base values when override is null', () => {
    const result = mergeSlotWithOverride(baseSlot, null)
    expect(result).toEqual(baseSlot)
  })

  it('returns base values when override has all null fields', () => {
    const override = { weight: null, reps: null, sets: null, rpe: null }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result).toEqual(baseSlot)
  })

  it('overrides weight when provided', () => {
    const override = { weight: 65, reps: null, sets: null, rpe: null }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result.weight).toBe(65)
    expect(result.reps).toBe('8-10')
    expect(result.sets).toBe(3)
    expect(result.rpe).toBe(7)
  })

  it('overrides reps when provided', () => {
    const override = { weight: null, reps: '6', sets: null, rpe: null }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result.reps).toBe('6')
    expect(result.weight).toBe(60)
  })

  it('overrides sets when provided', () => {
    const override = { weight: null, reps: null, sets: 4, rpe: null }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result.sets).toBe(4)
  })

  it('overrides rpe when provided', () => {
    const override = { weight: null, reps: null, sets: null, rpe: 8.5 }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result.rpe).toBe(8.5)
  })

  it('overrides multiple fields at once', () => {
    const override = { weight: 70, reps: '6', sets: 4, rpe: 8 }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result).toEqual({ weight: 70, reps: '6', sets: 4, rpe: 8 })
  })

  it('preserves 0 as a valid override value (bodyweight exercises)', () => {
    const override = { weight: 0, reps: null, sets: null, rpe: null }
    const result = mergeSlotWithOverride(baseSlot, override)
    expect(result.weight).toBe(0)
  })

  it('handles base slot with null weight', () => {
    const baseNoWeight = { weight: null, reps: '10', sets: 3, rpe: 6 }
    const override = { weight: null, reps: null, sets: null, rpe: null }
    const result = mergeSlotWithOverride(baseNoWeight, override)
    expect(result.weight).toBeNull()
  })

  it('handles running/cardio fields', () => {
    const runBase = {
      distance: 5.0,
      duration: 25,
      pace: '5:00',
    }
    const override = { distance: 6.0, duration: null, pace: null }
    const result = mergeSlotWithOverride(runBase, override)
    expect(result.distance).toBe(6.0)
    expect(result.duration).toBe(25)
    expect(result.pace).toBe('5:00')
  })
})

describe('computeDeloadDefaults', () => {
  it('computes 60% weight, 50% sets, RPE -2', () => {
    const base = { weight: 100, sets: 4, rpe: 8 }
    const result = computeDeloadDefaults(base)
    expect(result.weight).toBe(60) // 60% of 100
    expect(result.sets).toBe(2) // 50% of 4
    expect(result.rpe).toBe(6) // 8 - 2
  })

  it('rounds sets down when odd', () => {
    const base = { weight: 80, sets: 3, rpe: 7 }
    const result = computeDeloadDefaults(base)
    expect(result.weight).toBe(48) // 60% of 80
    expect(result.sets).toBe(1) // floor(50% of 3) = 1
    expect(result.rpe).toBe(5) // 7 - 2
  })

  it('clamps RPE to minimum 1', () => {
    const base = { weight: 60, sets: 3, rpe: 2 }
    const result = computeDeloadDefaults(base)
    expect(result.rpe).toBe(1) // max(2-2, 1) = 1
  })

  it('clamps sets to minimum 1', () => {
    const base = { weight: 60, sets: 1, rpe: 7 }
    const result = computeDeloadDefaults(base)
    expect(result.sets).toBe(1) // max(floor(0.5), 1) = 1
  })

  it('handles null weight', () => {
    const base = { weight: null, sets: 4, rpe: 8 }
    const result = computeDeloadDefaults(base)
    expect(result.weight).toBeNull()
    expect(result.sets).toBe(2)
    expect(result.rpe).toBe(6)
  })

  it('handles null RPE', () => {
    const base = { weight: 100, sets: 4, rpe: null }
    const result = computeDeloadDefaults(base)
    expect(result.weight).toBe(60)
    expect(result.sets).toBe(2)
    expect(result.rpe).toBeNull()
  })

  it('does not modify reps (100% preserved)', () => {
    const base = { weight: 100, sets: 4, rpe: 8 }
    const result = computeDeloadDefaults(base)
    // reps not included — per spec "100% reps" means reps aren't changed
    expect(result).not.toHaveProperty('reps')
  })
})
