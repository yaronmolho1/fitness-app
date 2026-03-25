import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWhere = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}))

import { getAthleteProfile } from './queries'

describe('getAthleteProfile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
  })

  it('returns null when no profile exists', async () => {
    mockWhere.mockResolvedValue([])
    const result = await getAthleteProfile()
    expect(result).toBeNull()
  })

  it('returns profile data when exists', async () => {
    const profile = {
      id: 1,
      age: 30,
      weight_kg: 85.5,
      height_cm: 180,
      gender: 'male',
      training_age_years: 5,
      primary_goal: 'hypertrophy',
      injury_history: 'left shoulder',
      created_at: new Date(),
      updated_at: new Date(),
    }
    mockWhere.mockResolvedValue([profile])
    const result = await getAthleteProfile()
    expect(result).toEqual(profile)
  })
})
