import { describe, it, expect } from 'vitest'
import { generateCanonicalName } from './utils'

describe('generateCanonicalName', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateCanonicalName('Push A')).toBe('push-a')
  })

  it('strips parentheses and special chars', () => {
    expect(generateCanonicalName('Push A (Main)')).toBe('push-a-main')
  })

  it('collapses multiple hyphens', () => {
    expect(generateCanonicalName('Push---A')).toBe('push-a')
  })

  it('trims hyphens from edges', () => {
    expect(generateCanonicalName('--Push A--')).toBe('push-a')
  })

  it('handles all-caps input', () => {
    expect(generateCanonicalName('UPPER BODY')).toBe('upper-body')
  })

  it('handles mixed case', () => {
    expect(generateCanonicalName('Lower Body B')).toBe('lower-body-b')
  })

  it('strips ampersands and other symbols', () => {
    expect(generateCanonicalName('Push & Pull')).toBe('push-pull')
  })

  it('handles numbers', () => {
    expect(generateCanonicalName('Day 1 Upper')).toBe('day-1-upper')
  })

  it('returns empty string for all-special-char input', () => {
    expect(generateCanonicalName('!@#$%^&*()')).toBe('')
  })

  it('trims whitespace before processing', () => {
    expect(generateCanonicalName('  Push A  ')).toBe('push-a')
  })

  it('handles long names (255 chars)', () => {
    const longName = 'A'.repeat(255)
    const result = generateCanonicalName(longName)
    expect(result).toBe('a'.repeat(255))
  })
})
