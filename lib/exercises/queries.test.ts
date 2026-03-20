import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAll = vi.fn()
const mockWhere = vi.fn()
const mockFrom = vi.fn()
const mockSelectDistinct = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    selectDistinct: (...args: unknown[]) => mockSelectDistinct(...args),
  },
  sqlite: {},
}))

import { getDistinctExerciseValues } from './queries'

describe('getDistinctExerciseValues', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelectDistinct.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ all: mockAll })
  })

  it('returns sorted unique equipment values', async () => {
    // First call: equipment
    mockAll.mockResolvedValueOnce([
      { equipment: 'dumbbell' },
      { equipment: 'barbell' },
      { equipment: 'cable' },
    ])
    // Second call: muscle_group
    mockAll.mockResolvedValueOnce([
      { muscle_group: 'chest' },
    ])

    const result = await getDistinctExerciseValues()
    expect(result.equipment).toEqual(['barbell', 'cable', 'dumbbell'])
  })

  it('returns sorted unique muscle_group values', async () => {
    mockAll.mockResolvedValueOnce([
      { equipment: 'barbell' },
    ])
    mockAll.mockResolvedValueOnce([
      { muscle_group: 'shoulders' },
      { muscle_group: 'chest' },
      { muscle_group: 'legs' },
    ])

    const result = await getDistinctExerciseValues()
    expect(result.muscle_groups).toEqual(['chest', 'legs', 'shoulders'])
  })

  it('returns empty arrays when no data', async () => {
    mockAll.mockResolvedValueOnce([])
    mockAll.mockResolvedValueOnce([])

    const result = await getDistinctExerciseValues()
    expect(result).toEqual({ equipment: [], muscle_groups: [] })
  })

  it('calls selectDistinct twice (equipment + muscle_group)', async () => {
    mockAll.mockResolvedValueOnce([])
    mockAll.mockResolvedValueOnce([])

    await getDistinctExerciseValues()
    expect(mockSelectDistinct).toHaveBeenCalledTimes(2)
  })
})
