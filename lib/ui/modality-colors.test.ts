import { describe, it, expect } from 'vitest'
import { getModalityClasses, getModalityBadgeClasses, getModalityAccentClass, MODALITY_COLORS } from './modality-colors'

describe('getModalityClasses', () => {
  it('returns blue-based classes for resistance', () => {
    const classes = getModalityClasses('resistance')
    expect(classes).toContain('bg-blue-100')
    expect(classes).toContain('border-blue-300')
    expect(classes).toContain('text-blue-900')
    expect(classes).toContain('dark:bg-blue-900/30')
    expect(classes).toContain('modality-resistance')
  })

  it('returns emerald-based classes for running', () => {
    const classes = getModalityClasses('running')
    expect(classes).toContain('bg-emerald-100')
    expect(classes).toContain('border-emerald-300')
    expect(classes).toContain('modality-running')
  })

  it('returns amber-based classes for mma', () => {
    const classes = getModalityClasses('mma')
    expect(classes).toContain('bg-amber-100')
    expect(classes).toContain('border-amber-300')
    expect(classes).toContain('modality-mma')
  })

  it('returns gray fallback for unknown modality', () => {
    const classes = getModalityClasses('yoga')
    expect(classes).toContain('bg-gray-100')
    expect(classes).toContain('modality-unknown')
  })

  it('returns gray fallback for empty string', () => {
    const classes = getModalityClasses('')
    expect(classes).toContain('bg-gray-100')
  })
})

describe('getModalityBadgeClasses', () => {
  it('returns badge-appropriate classes for resistance', () => {
    const classes = getModalityBadgeClasses('resistance')
    expect(classes).toContain('bg-blue-100')
    expect(classes).toContain('text-blue-800')
    expect(classes).toContain('dark:bg-blue-900/40')
    expect(classes).toContain('dark:text-blue-200')
  })

  it('returns badge-appropriate classes for running', () => {
    const classes = getModalityBadgeClasses('running')
    expect(classes).toContain('bg-emerald-100')
    expect(classes).toContain('text-emerald-800')
  })

  it('returns badge-appropriate classes for mma', () => {
    const classes = getModalityBadgeClasses('mma')
    expect(classes).toContain('bg-amber-100')
    expect(classes).toContain('text-amber-800')
  })

  it('returns gray fallback for unknown modality', () => {
    const classes = getModalityBadgeClasses('pilates')
    expect(classes).toContain('bg-gray-100')
    expect(classes).toContain('text-gray-800')
  })
})

describe('getModalityAccentClass', () => {
  it('returns blue accent for resistance', () => {
    expect(getModalityAccentClass('resistance')).toContain('blue')
  })

  it('returns emerald accent for running', () => {
    expect(getModalityAccentClass('running')).toContain('emerald')
  })

  it('returns amber accent for mma', () => {
    expect(getModalityAccentClass('mma')).toContain('amber')
  })

  it('returns gray accent for unknown', () => {
    expect(getModalityAccentClass('unknown')).toContain('gray')
  })
})

describe('MODALITY_COLORS', () => {
  it('exports color definitions for resistance, running, mma', () => {
    expect(MODALITY_COLORS).toHaveProperty('resistance')
    expect(MODALITY_COLORS).toHaveProperty('running')
    expect(MODALITY_COLORS).toHaveProperty('mma')
  })

  it('all known modalities have dark mode variants', () => {
    for (const key of ['resistance', 'running', 'mma'] as const) {
      const config = MODALITY_COLORS[key]
      expect(config.cell).toContain('dark:')
      expect(config.badge).toContain('dark:')
    }
  })
})

// T123: mixed modality colors
describe('mixed modality (T123)', () => {
  it('returns distinct cell classes for mixed modality', () => {
    const classes = getModalityClasses('mixed')
    expect(classes).toContain('modality-mixed')
    expect(classes).not.toContain('modality-unknown')
  })

  it('returns distinct badge classes for mixed modality', () => {
    const classes = getModalityBadgeClasses('mixed')
    expect(classes).not.toContain('bg-gray-100')
  })

  it('returns distinct accent class for mixed modality', () => {
    const accent = getModalityAccentClass('mixed')
    expect(accent).not.toContain('gray')
  })

  it('MODALITY_COLORS includes mixed entry', () => {
    expect(MODALITY_COLORS).toHaveProperty('mixed')
  })

  it('mixed modality has dark mode variants', () => {
    const config = MODALITY_COLORS['mixed']
    expect(config.cell).toContain('dark:')
    expect(config.badge).toContain('dark:')
  })

  it('mixed color is distinct from resistance, running, and mma', () => {
    const mixed = getModalityClasses('mixed')
    const resistance = getModalityClasses('resistance')
    const running = getModalityClasses('running')
    const mma = getModalityClasses('mma')
    expect(mixed).not.toBe(resistance)
    expect(mixed).not.toBe(running)
    expect(mixed).not.toBe(mma)
  })
})
