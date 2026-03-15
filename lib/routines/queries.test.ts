import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockLeftJoin = vi.fn()
const mockOrderBy = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
  sqlite: {},
}))

import { getRoutineItems } from './queries'
import { formatInputFields, formatScopeSummary } from './format'

describe('getRoutineItems', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin })
    mockLeftJoin.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockResolvedValue([])
  })

  it('returns an array', async () => {
    const result = await getRoutineItems()
    expect(Array.isArray(result)).toBe(true)
  })

  it('calls db.select', async () => {
    await getRoutineItems()
    expect(mockSelect).toHaveBeenCalled()
  })

  it('chains leftJoin and orderBy in correct sequence', async () => {
    await getRoutineItems()
    expect(mockFrom).toHaveBeenCalled()
    expect(mockLeftJoin).toHaveBeenCalled()
    expect(mockOrderBy).toHaveBeenCalled()
  })

  it('returns rows from the joined query', async () => {
    const fakeRows = [
      {
        routine_item: { id: 1, name: 'Stretch', scope: 'mesocycle', mesocycle_id: 1 },
        mesocycle_name: 'Block 1',
      },
      {
        routine_item: { id: 2, name: 'Foam Roll', scope: 'global', mesocycle_id: null },
        mesocycle_name: null,
      },
    ]
    mockOrderBy.mockResolvedValueOnce(fakeRows)
    const result = await getRoutineItems()
    expect(result).toHaveLength(2)
    expect(result[0].mesocycle_name).toBe('Block 1')
    expect(result[1].mesocycle_name).toBeNull()
  })
})

describe('formatInputFields', () => {
  it('returns comma-separated list of active fields', () => {
    const result = formatInputFields({
      has_weight: false,
      has_length: false,
      has_duration: true,
      has_sets: true,
      has_reps: true,
    })
    expect(result).toBe('duration, sets, reps')
  })

  it('returns single field', () => {
    const result = formatInputFields({
      has_weight: true,
      has_length: false,
      has_duration: false,
      has_sets: false,
      has_reps: false,
    })
    expect(result).toBe('weight')
  })

  it('returns all fields when all active', () => {
    const result = formatInputFields({
      has_weight: true,
      has_length: true,
      has_duration: true,
      has_sets: true,
      has_reps: true,
    })
    expect(result).toBe('weight, length, duration, sets, reps')
  })
})

describe('formatScopeSummary', () => {
  it('returns "Global" for global scope without skip_on_deload', () => {
    expect(formatScopeSummary('global', false, null, null, null)).toBe('Global')
  })

  it('returns "Skip on deload" for global scope with skip_on_deload', () => {
    expect(formatScopeSummary('global', true, null, null, null)).toBe(
      'Skip on deload'
    )
  })

  it('returns mesocycle name for mesocycle scope', () => {
    expect(
      formatScopeSummary('mesocycle', false, 'Hypertrophy Block 1', null, null)
    ).toBe('Mesocycle: Hypertrophy Block 1')
  })

  it('returns formatted date range', () => {
    expect(
      formatScopeSummary('date_range', false, null, '2026-03-01', '2026-04-30')
    ).toBe('Mar 1 – Apr 30')
  })

  it('handles same-year date range', () => {
    expect(
      formatScopeSummary('date_range', false, null, '2026-01-15', '2026-02-28')
    ).toBe('Jan 15 – Feb 28')
  })
})
