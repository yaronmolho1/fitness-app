// T208: Tests for projectAffectedDates and deleteEventsForMesocycle
import { describe, it, expect } from 'vitest'
import { projectAffectedDates } from './sync-helpers'

describe('projectAffectedDates', () => {
  it('returns all Mondays (day 0) in a 4-week range', () => {
    // start=Monday 2026-03-02, end=Sunday 2026-03-29
    const dates = projectAffectedDates('2026-03-02', '2026-03-29', 0)
    expect(dates).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
    ])
  })

  it('returns all Wednesdays (day 2) in a 4-week range', () => {
    const dates = projectAffectedDates('2026-03-02', '2026-03-29', 2)
    expect(dates).toEqual([
      '2026-03-04',
      '2026-03-11',
      '2026-03-18',
      '2026-03-25',
    ])
  })

  it('returns all Sundays (day 6) in a 4-week range', () => {
    const dates = projectAffectedDates('2026-03-02', '2026-03-29', 6)
    expect(dates).toEqual([
      '2026-03-08',
      '2026-03-15',
      '2026-03-22',
      '2026-03-29',
    ])
  })

  it('returns empty array when day does not fall in range', () => {
    // start=Monday, end=Tuesday (2 days, no Wednesday)
    const dates = projectAffectedDates('2026-03-02', '2026-03-03', 2)
    expect(dates).toEqual([])
  })

  it('handles single-day range matching', () => {
    const dates = projectAffectedDates('2026-03-02', '2026-03-02', 0)
    expect(dates).toEqual(['2026-03-02'])
  })

  it('handles single-day range not matching', () => {
    const dates = projectAffectedDates('2026-03-02', '2026-03-02', 1)
    expect(dates).toEqual([])
  })

  it('returns dates for specific week_type "deload" constraint via week filter', () => {
    // 4 work weeks + 1 deload = 5 weeks total
    // start=2026-03-02, end=2026-04-05
    const dates = projectAffectedDates('2026-03-02', '2026-04-05', 0)
    expect(dates).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
      '2026-03-23',
      '2026-03-30',
    ])
  })

  it('computes week dates for resetWeekSchedule (all 7 days of a week)', () => {
    // Week 2 of mesocycle starting 2026-03-02 = days 2026-03-09 to 2026-03-15
    const weekDates = projectWeekDates('2026-03-02', 2)
    expect(weekDates).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
    ])
  })

  it('computes week 1 dates correctly', () => {
    const weekDates = projectWeekDates('2026-03-02', 1)
    expect(weekDates).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ])
  })
})

// Import will be added after implementation
import { projectWeekDates } from './sync-helpers'
