import { describe, it, expect } from 'vitest'
import { calculateEndDate } from './utils'

describe('calculateEndDate', () => {
  it('calculates end date for 4 weeks without deload', () => {
    // 2026-03-01 + (4*7) - 1 = 2026-03-01 + 27 = 2026-03-28
    expect(calculateEndDate('2026-03-01', 4, false)).toBe('2026-03-28')
  })

  it('calculates end date for 4 weeks with deload', () => {
    // 2026-03-01 + (4*7) + 7 - 1 = 2026-03-01 + 34 = 2026-04-04
    expect(calculateEndDate('2026-03-01', 4, true)).toBe('2026-04-04')
  })

  it('calculates end date for 1 week without deload', () => {
    // 2026-03-01 + 7 - 1 = 2026-03-07
    expect(calculateEndDate('2026-03-01', 1, false)).toBe('2026-03-07')
  })

  it('calculates end date for 1 week with deload', () => {
    // 2026-03-01 + 7 + 7 - 1 = 2026-03-14
    expect(calculateEndDate('2026-03-01', 1, true)).toBe('2026-03-14')
  })

  it('handles month boundary crossing', () => {
    // 2026-01-25 + (2*7) - 1 = 2026-01-25 + 13 = 2026-02-07
    expect(calculateEndDate('2026-01-25', 2, false)).toBe('2026-02-07')
  })

  it('handles year boundary crossing', () => {
    // 2026-12-15 + (4*7) - 1 = 2026-12-15 + 27 = 2027-01-11
    expect(calculateEndDate('2026-12-15', 4, false)).toBe('2027-01-11')
  })

  it('handles leap year (Feb 29)', () => {
    // 2028-02-20 + (2*7) - 1 = 2028-02-20 + 13 = 2028-03-04 (2028 is leap year)
    expect(calculateEndDate('2028-02-20', 2, false)).toBe('2028-03-04')
  })

  it('handles non-leap year (Feb 28)', () => {
    // 2027-02-20 + (2*7) - 1 = 2027-02-20 + 13 = 2027-03-05 (2027 is NOT leap year)
    expect(calculateEndDate('2027-02-20', 2, false)).toBe('2027-03-05')
  })

  it('returns YYYY-MM-DD format', () => {
    const result = calculateEndDate('2026-03-01', 4, false)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
