import { describe, it, expect } from 'vitest'
import { formatDateBanner } from './date-format'

describe('formatDateBanner', () => {
  it('formats YYYY-MM-DD as dd/Mon/yyyy', () => {
    expect(formatDateBanner('2026-03-20')).toBe('20/Mar/2026')
  })

  it('handles single-digit day/month', () => {
    expect(formatDateBanner('2026-01-05')).toBe('05/Jan/2026')
  })

  it('handles December', () => {
    expect(formatDateBanner('2025-12-31')).toBe('31/Dec/2025')
  })
})
