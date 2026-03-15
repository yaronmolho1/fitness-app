import { describe, it, expect } from 'vitest'
import { filterActiveRoutineItems, isDeloadWeek } from './scope-filter'
import type { RoutineItemRow, MesocycleRow } from './scope-filter'

// Helper to build a routine item with defaults
function makeItem(overrides: Partial<RoutineItemRow> = {}): RoutineItemRow {
  return {
    id: 1,
    name: 'Test Item',
    category: null,
    has_weight: false,
    has_length: false,
    has_duration: true,
    has_sets: false,
    has_reps: false,
    frequency_target: 7,
    scope: 'global',
    mesocycle_id: null,
    start_date: null,
    end_date: null,
    skip_on_deload: false,
    created_at: null,
    ...overrides,
  }
}

function makeMeso(overrides: Partial<MesocycleRow> = {}): MesocycleRow {
  return {
    id: 1,
    name: 'Block 1',
    start_date: '2026-03-01',
    end_date: '2026-04-04',
    work_weeks: 4,
    has_deload: true,
    status: 'active',
    created_at: null,
    ...overrides,
  }
}

describe('isDeloadWeek', () => {
  it('returns true when today is in the last week of a mesocycle with deload', () => {
    // Meso: 4 work weeks + deload, start 2026-03-01, end 2026-04-04
    // Deload week = week 5 = days 28-34 from start = Mar 29 - Apr 4
    const meso = makeMeso()
    expect(isDeloadWeek('2026-03-29', meso)).toBe(true)
    expect(isDeloadWeek('2026-04-04', meso)).toBe(true)
  })

  it('returns false during work weeks', () => {
    const meso = makeMeso()
    expect(isDeloadWeek('2026-03-15', meso)).toBe(false)
  })

  it('returns false when mesocycle has no deload', () => {
    const meso = makeMeso({ has_deload: false, end_date: '2026-03-28' })
    expect(isDeloadWeek('2026-03-22', meso)).toBe(false)
  })

  it('returns false for dates outside the mesocycle', () => {
    const meso = makeMeso()
    expect(isDeloadWeek('2026-02-28', meso)).toBe(false)
    expect(isDeloadWeek('2026-04-05', meso)).toBe(false)
  })
})

describe('filterActiveRoutineItems', () => {
  describe('global scope', () => {
    it('always includes global items', () => {
      const items = [makeItem({ scope: 'global' })]
      const result = filterActiveRoutineItems(items, [], '2026-03-15')
      expect(result).toHaveLength(1)
    })

    it('includes global items even with no mesocycles', () => {
      const items = [makeItem({ scope: 'global' })]
      const result = filterActiveRoutineItems(items, [], '2030-01-01')
      expect(result).toHaveLength(1)
    })
  })

  describe('mesocycle scope', () => {
    it('includes item when referenced mesocycle is active and today in range', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 1 })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-15')
      expect(result).toHaveLength(1)
    })

    it('excludes item when mesocycle is not active (planned)', () => {
      const meso = makeMeso({ id: 1, status: 'planned' })
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 1 })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-15')
      expect(result).toHaveLength(0)
    })

    it('excludes item when mesocycle is completed', () => {
      const meso = makeMeso({ id: 1, status: 'completed' })
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 1 })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-15')
      expect(result).toHaveLength(0)
    })

    it('excludes item when today is outside mesocycle date range', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 1 })]
      const result = filterActiveRoutineItems(items, [meso], '2026-05-01')
      expect(result).toHaveLength(0)
    })

    it('includes item on start date boundary', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 1 })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-01')
      expect(result).toHaveLength(1)
    })

    it('includes item on end date boundary', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 1 })]
      const result = filterActiveRoutineItems(items, [meso], '2026-04-04')
      expect(result).toHaveLength(1)
    })

    it('excludes item when mesocycle_id not found', () => {
      const items = [makeItem({ scope: 'mesocycle', mesocycle_id: 999 })]
      const result = filterActiveRoutineItems(items, [], '2026-03-15')
      expect(result).toHaveLength(0)
    })
  })

  describe('date_range scope', () => {
    it('includes item when today is within date range', () => {
      const items = [
        makeItem({
          scope: 'date_range',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
        }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-03-15')
      expect(result).toHaveLength(1)
    })

    it('includes item on start date boundary', () => {
      const items = [
        makeItem({
          scope: 'date_range',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
        }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-03-01')
      expect(result).toHaveLength(1)
    })

    it('includes item on end date boundary', () => {
      const items = [
        makeItem({
          scope: 'date_range',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
        }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-03-31')
      expect(result).toHaveLength(1)
    })

    it('excludes item when today is before date range', () => {
      const items = [
        makeItem({
          scope: 'date_range',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
        }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-02-28')
      expect(result).toHaveLength(0)
    })

    it('excludes item when today is after date range', () => {
      const items = [
        makeItem({
          scope: 'date_range',
          start_date: '2026-03-01',
          end_date: '2026-03-31',
        }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-04-01')
      expect(result).toHaveLength(0)
    })

    it('excludes item with missing start_date or end_date', () => {
      const items = [
        makeItem({ scope: 'date_range', start_date: null, end_date: null }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-03-15')
      expect(result).toHaveLength(0)
    })
  })

  describe('skip_on_deload', () => {
    it('excludes item during deload week of active mesocycle', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      // Deload week = Mar 29 - Apr 4
      const items = [makeItem({ scope: 'global', skip_on_deload: true })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-30')
      expect(result).toHaveLength(0)
    })

    it('includes item during work weeks of active mesocycle', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [makeItem({ scope: 'global', skip_on_deload: true })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-15')
      expect(result).toHaveLength(1)
    })

    it('includes item when no active mesocycle exists', () => {
      const items = [makeItem({ scope: 'global', skip_on_deload: true })]
      const result = filterActiveRoutineItems(items, [], '2026-03-15')
      expect(result).toHaveLength(1)
    })

    it('includes item when active mesocycle has no deload', () => {
      const meso = makeMeso({
        id: 1,
        status: 'active',
        has_deload: false,
        end_date: '2026-03-28',
      })
      const items = [makeItem({ scope: 'global', skip_on_deload: true })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-22')
      expect(result).toHaveLength(1)
    })

    it('includes item when only non-active mesocycles exist', () => {
      const meso = makeMeso({ id: 1, status: 'completed' })
      const items = [makeItem({ scope: 'global', skip_on_deload: true })]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-30')
      expect(result).toHaveLength(1)
    })

    it('works with mesocycle scope + skip_on_deload', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [
        makeItem({ scope: 'mesocycle', mesocycle_id: 1, skip_on_deload: true }),
      ]
      // During deload week — excluded
      const result = filterActiveRoutineItems(items, [meso], '2026-03-30')
      expect(result).toHaveLength(0)
    })

    it('works with date_range scope + skip_on_deload during deload', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [
        makeItem({
          scope: 'date_range',
          start_date: '2026-03-01',
          end_date: '2026-04-30',
          skip_on_deload: true,
        }),
      ]
      const result = filterActiveRoutineItems(items, [meso], '2026-03-30')
      expect(result).toHaveLength(0)
    })
  })

  describe('mixed items', () => {
    it('filters correctly with multiple items of different scopes', () => {
      const meso = makeMeso({ id: 1, status: 'active' })
      const items = [
        makeItem({ id: 1, scope: 'global' }),
        makeItem({ id: 2, scope: 'mesocycle', mesocycle_id: 1 }),
        makeItem({
          id: 3,
          scope: 'date_range',
          start_date: '2026-01-01',
          end_date: '2026-02-28',
        }),
        makeItem({ id: 4, scope: 'global', skip_on_deload: true }),
      ]
      // Mar 15 = within mesocycle, not deload week, outside date_range
      const result = filterActiveRoutineItems(items, [meso], '2026-03-15')
      expect(result).toHaveLength(3)
      expect(result.map((i) => i.id)).toEqual([1, 2, 4])
    })

    it('returns empty array when no items are active', () => {
      const items = [
        makeItem({
          id: 1,
          scope: 'date_range',
          start_date: '2025-01-01',
          end_date: '2025-12-31',
        }),
      ]
      const result = filterActiveRoutineItems(items, [], '2026-03-15')
      expect(result).toHaveLength(0)
    })

    it('returns empty array when given no items', () => {
      const result = filterActiveRoutineItems([], [], '2026-03-15')
      expect(result).toHaveLength(0)
    })
  })
})
