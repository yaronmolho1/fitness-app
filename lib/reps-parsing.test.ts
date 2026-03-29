import { describe, it, expect } from 'vitest'
import { parseRepsLowerBound, isRepsRange } from './reps-parsing'

describe('parseRepsLowerBound', () => {
  it('returns lower bound from range "8-12"', () => {
    expect(parseRepsLowerBound('8-12')).toBe(8)
  })

  it('returns lower bound from range "10-15"', () => {
    expect(parseRepsLowerBound('10-15')).toBe(10)
  })

  it('returns single integer as number', () => {
    expect(parseRepsLowerBound('8')).toBe(8)
  })

  it('returns single integer "10"', () => {
    expect(parseRepsLowerBound('10')).toBe(10)
  })

  it('returns null for "AMRAP"', () => {
    expect(parseRepsLowerBound('AMRAP')).toBeNull()
  })

  it('returns null for non-numeric string', () => {
    expect(parseRepsLowerBound('max')).toBeNull()
  })

  it('returns 5 for degenerate range "5-5"', () => {
    expect(parseRepsLowerBound('5-5')).toBe(5)
  })

  it('returns null for empty string', () => {
    expect(parseRepsLowerBound('')).toBeNull()
  })

  it('handles whitespace around values', () => {
    expect(parseRepsLowerBound(' 8-12 ')).toBe(8)
  })
})

describe('isRepsRange', () => {
  it('returns true for "8-12" (different bounds)', () => {
    expect(isRepsRange('8-12')).toBe(true)
  })

  it('returns false for "5-5" (equal bounds)', () => {
    expect(isRepsRange('5-5')).toBe(false)
  })

  it('returns false for single integer "8"', () => {
    expect(isRepsRange('8')).toBe(false)
  })

  it('returns false for "AMRAP"', () => {
    expect(isRepsRange('AMRAP')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isRepsRange('')).toBe(false)
  })
})
