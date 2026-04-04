import { describe, it, expect } from 'vitest'
import { getModalityClasses, getModalityBadgeClasses, getModalityAccentClass, MODALITY_COLORS } from './modality-colors'

describe('getModalityClasses', () => {
  it('returns slate-based classes for resistance', () => {
    const classes = getModalityClasses('resistance')
    expect(classes).toContain('bg-slate-50')
    expect(classes).toContain('border-slate-300')
    expect(classes).toContain('text-slate-900')
    expect(classes).toContain('dark:bg-slate-900/20')
    expect(classes).toContain('modality-resistance')
  })

  it('returns teal-based classes for running', () => {
    const classes = getModalityClasses('running')
    expect(classes).toContain('bg-teal-50')
    expect(classes).toContain('border-teal-300')
    expect(classes).toContain('modality-running')
  })

  it('returns rose-based classes for mma', () => {
    const classes = getModalityClasses('mma')
    expect(classes).toContain('bg-rose-50')
    expect(classes).toContain('border-rose-300')
    expect(classes).toContain('modality-mma')
  })

  it('returns zinc fallback for unknown modality', () => {
    const classes = getModalityClasses('yoga')
    expect(classes).toContain('bg-zinc-50')
    expect(classes).toContain('modality-unknown')
  })

  it('returns zinc fallback for empty string', () => {
    const classes = getModalityClasses('')
    expect(classes).toContain('bg-zinc-50')
  })
})

describe('getModalityBadgeClasses', () => {
  it('returns badge-appropriate classes for resistance', () => {
    const classes = getModalityBadgeClasses('resistance')
    expect(classes).toContain('bg-slate-100')
    expect(classes).toContain('text-slate-700')
    expect(classes).toContain('dark:bg-slate-800/50')
    expect(classes).toContain('dark:text-slate-300')
  })

  it('returns badge-appropriate classes for running', () => {
    const classes = getModalityBadgeClasses('running')
    expect(classes).toContain('bg-teal-100')
    expect(classes).toContain('text-teal-700')
  })

  it('returns badge-appropriate classes for mma', () => {
    const classes = getModalityBadgeClasses('mma')
    expect(classes).toContain('bg-rose-100')
    expect(classes).toContain('text-rose-700')
  })

  it('returns zinc fallback for unknown modality', () => {
    const classes = getModalityBadgeClasses('pilates')
    expect(classes).toContain('bg-zinc-100')
    expect(classes).toContain('text-zinc-600')
  })
})

describe('getModalityAccentClass', () => {
  it('returns slate accent for resistance', () => {
    expect(getModalityAccentClass('resistance')).toContain('slate')
  })

  it('returns teal accent for running', () => {
    expect(getModalityAccentClass('running')).toContain('teal')
  })

  it('returns rose accent for mma', () => {
    expect(getModalityAccentClass('mma')).toContain('rose')
  })

  it('returns zinc accent for unknown', () => {
    expect(getModalityAccentClass('unknown')).toContain('zinc')
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
    expect(classes).not.toContain('bg-zinc-100')
  })

  it('returns distinct accent class for mixed modality', () => {
    const accent = getModalityAccentClass('mixed')
    expect(accent).not.toContain('zinc')
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
