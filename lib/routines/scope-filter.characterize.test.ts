// Characterization test — captures current behavior for safe refactoring
// Focus: how filterActiveRoutineItems and isDeloadWeek behave today,
// especially around frequency_mode/frequency_days which T118 will add filtering for.

import { describe, it, expect } from 'vitest'
import { filterActiveRoutineItems, isDeloadWeek } from './scope-filter'
import type { RoutineItemRow, MesocycleRow } from './scope-filter'

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
    frequency_mode: 'weekly_target' as const,
    frequency_days: null,
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

describe('isDeloadWeek — characterization', () => {
  const meso = makeMeso()

  it('exact deload start boundary (day 28 from start)', () => {
    // 4 work weeks = 28 days, deload starts on day 28 = 2026-03-29
    expect(isDeloadWeek('2026-03-29', meso)).toBe(true)
  })

  it('day before deload start is not deload', () => {
    expect(isDeloadWeek('2026-03-28', meso)).toBe(false)
  })

  it('last day of meso is deload', () => {
    expect(isDeloadWeek('2026-04-04', meso)).toBe(true)
  })

  it('first day of meso is not deload', () => {
    expect(isDeloadWeek('2026-03-01', meso)).toBe(false)
  })

  it('before meso start returns false', () => {
    expect(isDeloadWeek('2026-02-28', meso)).toBe(false)
  })

  it('after meso end returns false', () => {
    expect(isDeloadWeek('2026-04-05', meso)).toBe(false)
  })

  it('no deload flag always returns false', () => {
    const noDeload = makeMeso({ has_deload: false, end_date: '2026-03-28' })
    expect(isDeloadWeek('2026-03-22', noDeload)).toBe(false)
  })

  it('works with 1 work week mesocycle', () => {
    const shortMeso = makeMeso({
      start_date: '2026-03-01',
      end_date: '2026-03-14',
      work_weeks: 1,
      has_deload: true,
    })
    // Deload starts at day 7 = 2026-03-08
    expect(isDeloadWeek('2026-03-07', shortMeso)).toBe(false)
    expect(isDeloadWeek('2026-03-08', shortMeso)).toBe(true)
  })

  it('works across month boundary', () => {
    const meso2 = makeMeso({
      start_date: '2026-01-25',
      end_date: '2026-03-07',
      work_weeks: 5,
      has_deload: true,
    })
    // Deload starts at day 35 = 2026-03-01
    expect(isDeloadWeek('2026-02-28', meso2)).toBe(false)
    expect(isDeloadWeek('2026-03-01', meso2)).toBe(true)
  })
})

describe('filterActiveRoutineItems — frequency_mode passthrough', () => {
  it('does not filter by frequency_mode=daily — item passes through scope filter unchanged', () => {
    const items = [makeItem({ frequency_mode: 'daily', frequency_target: 1 })]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).toHaveLength(1)
    expect(result[0].frequency_mode).toBe('daily')
  })

  it('filters by frequency_mode=specific_days — excludes on non-matching days (T118)', () => {
    // 2026-03-15 is a Sunday (day 0). frequency_days=[1,3] (Mon, Wed)
    const items = [
      makeItem({
        frequency_mode: 'specific_days',
        frequency_days: [1, 3], // Mon, Wed
        frequency_target: 2,
      }),
    ]
    const result = filterActiveRoutineItems(items, [], '2026-03-15') // Sunday
    expect(result).toHaveLength(0)
  })

  it('does not filter by frequency_mode=weekly_target', () => {
    const items = [makeItem({ frequency_mode: 'weekly_target', frequency_target: 3 })]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).toHaveLength(1)
  })

  it('frequency_days=null with specific_days is excluded (T118)', () => {
    const items = [
      makeItem({
        frequency_mode: 'specific_days',
        frequency_days: null,
        frequency_target: 0,
      }),
    ]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).toHaveLength(0)
  })

  it('frequency_mode does not interact with skip_on_deload', () => {
    const meso = makeMeso()
    const items = [
      makeItem({
        frequency_mode: 'daily',
        skip_on_deload: true,
      }),
    ]
    // During deload week — skip_on_deload is what matters, not frequency_mode
    const result = filterActiveRoutineItems(items, [meso], '2026-03-30')
    expect(result).toHaveLength(0)
  })
})

describe('filterActiveRoutineItems — multiple mesocycles', () => {
  it('any active mesocycle in deload triggers skip_on_deload', () => {
    const meso1 = makeMeso({ id: 1, status: 'active' })
    const meso2 = makeMeso({
      id: 2,
      status: 'active',
      start_date: '2026-01-01',
      end_date: '2026-02-28',
      work_weeks: 7,
      has_deload: true,
    })
    const items = [makeItem({ scope: 'global', skip_on_deload: true })]
    // Meso1 is in deload on Mar 30, meso2 has ended but deload check
    // only applies to has_deload + date in range
    const result = filterActiveRoutineItems(items, [meso1, meso2], '2026-03-30')
    expect(result).toHaveLength(0)
  })

  it('skip_on_deload=false not affected by deload state', () => {
    const meso = makeMeso()
    const items = [makeItem({ scope: 'global', skip_on_deload: false })]
    const result = filterActiveRoutineItems(items, [meso], '2026-03-30')
    expect(result).toHaveLength(1)
  })

  it('mesocycle-scoped item matches correct meso among multiple', () => {
    const meso1 = makeMeso({ id: 1, status: 'active' })
    const meso2 = makeMeso({
      id: 2,
      status: 'active',
      start_date: '2026-05-01',
      end_date: '2026-06-30',
    })
    const items = [
      makeItem({ id: 1, scope: 'mesocycle', mesocycle_id: 1 }),
      makeItem({ id: 2, scope: 'mesocycle', mesocycle_id: 2 }),
    ]
    const result = filterActiveRoutineItems(items, [meso1, meso2], '2026-03-15')
    // Item 1 active (in meso1 range), item 2 not (outside meso2 range)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })
})

describe('filterActiveRoutineItems — unknown scope', () => {
  it('unknown scope type is excluded (default branch)', () => {
    const items = [makeItem({ scope: 'future_scope' as 'global' })]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).toHaveLength(0)
  })
})

describe('filterActiveRoutineItems — date_range edge cases', () => {
  it('only start_date missing excludes item', () => {
    const items = [
      makeItem({ scope: 'date_range', start_date: null, end_date: '2026-12-31' }),
    ]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).toHaveLength(0)
  })

  it('only end_date missing excludes item', () => {
    const items = [
      makeItem({ scope: 'date_range', start_date: '2026-01-01', end_date: null }),
    ]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).toHaveLength(0)
  })
})

describe('filterActiveRoutineItems — empty / trivial inputs', () => {
  it('empty items array returns empty', () => {
    expect(filterActiveRoutineItems([], [], '2026-03-15')).toEqual([])
  })

  it('empty mesocycles array — global items still pass', () => {
    const items = [makeItem({ scope: 'global' })]
    expect(filterActiveRoutineItems(items, [], '2026-03-15')).toHaveLength(1)
  })

  it('preserves item order in output', () => {
    const items = [
      makeItem({ id: 3, scope: 'global' }),
      makeItem({ id: 1, scope: 'global' }),
      makeItem({ id: 2, scope: 'global' }),
    ]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result.map((i) => i.id)).toEqual([3, 1, 2])
  })

  it('returns new array (does not mutate input)', () => {
    const items = [makeItem({ scope: 'global' })]
    const result = filterActiveRoutineItems(items, [], '2026-03-15')
    expect(result).not.toBe(items)
  })
})
