import { describe, it, expect } from 'vitest'
import {
  derivePeriod,
  getEndTime,
  checkOverlap,
  timeSlotSchema,
  durationSchema,
  type Period,
} from './time-utils'

describe('derivePeriod', () => {
  it('returns morning for hour < 12', () => {
    expect(derivePeriod('06:30')).toBe('morning')
  })

  it('returns morning for 00:00 (midnight)', () => {
    expect(derivePeriod('00:00')).toBe('morning')
  })

  it('returns morning for 11:59 (boundary before noon)', () => {
    expect(derivePeriod('11:59')).toBe('morning')
  })

  it('returns afternoon for 12:00 (boundary)', () => {
    expect(derivePeriod('12:00')).toBe('afternoon')
  })

  it('returns afternoon for 14:00', () => {
    expect(derivePeriod('14:00')).toBe('afternoon')
  })

  it('returns afternoon for 16:59 (boundary before evening)', () => {
    expect(derivePeriod('16:59')).toBe('afternoon')
  })

  it('returns evening for 17:00 (boundary)', () => {
    expect(derivePeriod('17:00')).toBe('evening')
  })

  it('returns evening for 19:00', () => {
    expect(derivePeriod('19:00')).toBe('evening')
  })

  it('returns evening for 23:59', () => {
    expect(derivePeriod('23:59')).toBe('evening')
  })
})

describe('getEndTime', () => {
  it('adds duration to start time', () => {
    expect(getEndTime('07:00', 60)).toBe('08:00')
  })

  it('handles partial hour durations', () => {
    expect(getEndTime('09:30', 45)).toBe('10:15')
  })

  it('wraps past midnight', () => {
    expect(getEndTime('23:30', 90)).toBe('01:00')
  })

  it('handles exactly midnight result', () => {
    expect(getEndTime('23:00', 60)).toBe('00:00')
  })

  it('handles zero-crossing with small duration', () => {
    expect(getEndTime('23:50', 20)).toBe('00:10')
  })

  it('handles start at 00:00', () => {
    expect(getEndTime('00:00', 30)).toBe('00:30')
  })

  it('handles large duration within same day', () => {
    expect(getEndTime('06:00', 480)).toBe('14:00')
  })
})

describe('checkOverlap', () => {
  it('detects overlap when new workout starts during existing', () => {
    const existing = [{ time_slot: '07:00', duration: 90 }]
    expect(checkOverlap(existing, '08:00', 60)).toBe(true)
  })

  it('detects overlap when existing starts during new workout', () => {
    const existing = [{ time_slot: '09:00', duration: 60 }]
    expect(checkOverlap(existing, '08:30', 60)).toBe(true)
  })

  it('returns false when no overlap (new after existing)', () => {
    const existing = [{ time_slot: '07:00', duration: 60 }]
    expect(checkOverlap(existing, '08:00', 60)).toBe(false)
  })

  it('returns false when no overlap (new before existing)', () => {
    const existing = [{ time_slot: '10:00', duration: 60 }]
    expect(checkOverlap(existing, '08:00', 60)).toBe(false)
  })

  it('returns false for adjacent but non-overlapping (back to back)', () => {
    const existing = [{ time_slot: '07:00', duration: 60 }]
    expect(checkOverlap(existing, '08:00', 60)).toBe(false)
  })

  it('returns false when no existing entries', () => {
    expect(checkOverlap([], '08:00', 60)).toBe(false)
  })

  it('detects overlap with any of multiple entries', () => {
    const existing = [
      { time_slot: '07:00', duration: 60 },
      { time_slot: '14:00', duration: 90 },
    ]
    expect(checkOverlap(existing, '15:00', 60)).toBe(true)
  })

  it('returns false when no overlap with any entry', () => {
    const existing = [
      { time_slot: '07:00', duration: 60 },
      { time_slot: '14:00', duration: 60 },
    ]
    expect(checkOverlap(existing, '10:00', 60)).toBe(false)
  })

  it('detects full containment (new inside existing)', () => {
    const existing = [{ time_slot: '07:00', duration: 120 }]
    expect(checkOverlap(existing, '07:30', 30)).toBe(true)
  })

  it('detects full containment (existing inside new)', () => {
    const existing = [{ time_slot: '08:00', duration: 30 }]
    expect(checkOverlap(existing, '07:00', 120)).toBe(true)
  })

  it('detects overlap with identical time ranges', () => {
    const existing = [{ time_slot: '07:00', duration: 60 }]
    expect(checkOverlap(existing, '07:00', 60)).toBe(true)
  })
})

describe('timeSlotSchema', () => {
  it('accepts valid HH:MM format', () => {
    expect(timeSlotSchema.safeParse('07:00').success).toBe(true)
    expect(timeSlotSchema.safeParse('23:59').success).toBe(true)
    expect(timeSlotSchema.safeParse('00:00').success).toBe(true)
    expect(timeSlotSchema.safeParse('12:30').success).toBe(true)
  })

  it('rejects non-zero-padded hours', () => {
    expect(timeSlotSchema.safeParse('7:00').success).toBe(false)
  })

  it('rejects invalid hours', () => {
    expect(timeSlotSchema.safeParse('24:00').success).toBe(false)
    expect(timeSlotSchema.safeParse('25:00').success).toBe(false)
  })

  it('rejects invalid minutes', () => {
    expect(timeSlotSchema.safeParse('12:60').success).toBe(false)
  })

  it('rejects non-HH:MM formats', () => {
    expect(timeSlotSchema.safeParse('noon').success).toBe(false)
    expect(timeSlotSchema.safeParse('12').success).toBe(false)
    expect(timeSlotSchema.safeParse('').success).toBe(false)
  })
})

describe('durationSchema', () => {
  it('accepts positive integers', () => {
    expect(durationSchema.safeParse(30).success).toBe(true)
    expect(durationSchema.safeParse(90).success).toBe(true)
    expect(durationSchema.safeParse(1).success).toBe(true)
  })

  it('rejects zero', () => {
    expect(durationSchema.safeParse(0).success).toBe(false)
  })

  it('rejects negative values', () => {
    expect(durationSchema.safeParse(-10).success).toBe(false)
  })

  it('rejects non-integers', () => {
    expect(durationSchema.safeParse(30.5).success).toBe(false)
  })
})
