import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revalidatePath } from 'next/cache'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockWhere = vi.fn()
const mockReturning = vi.fn()
const mockValues = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdateSet = vi.fn()
const mockUpdateWhere = vi.fn()
const mockUpdateReturning = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))

import { saveAthleteProfile } from './actions'

const validProfile = {
  age: 30,
  weight_kg: 85.5,
  height_cm: 180,
  gender: 'male',
  training_age_years: 5,
  primary_goal: 'hypertrophy',
  injury_history: 'left shoulder',
}

describe('saveAthleteProfile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: no existing profile (insert path)
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    // Insert chain
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{ id: 1, ...validProfile, created_at: new Date(), updated_at: new Date() }])
    // Update chain
    mockUpdate.mockReturnValue({ set: mockUpdateSet })
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning })
    mockUpdateReturning.mockResolvedValue([{ id: 1, ...validProfile, created_at: new Date(), updated_at: new Date() }])
  })

  it('creates new profile when none exists (insert)', async () => {
    mockWhere.mockResolvedValue([]) // no existing row
    const result = await saveAthleteProfile(validProfile)
    expect(result.success).toBe(true)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('updates existing profile (upsert)', async () => {
    mockWhere.mockResolvedValue([{ id: 1, ...validProfile }]) // existing row
    const result = await saveAthleteProfile({ age: 31 })
    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('validates input with zod — rejects invalid age type', async () => {
    const result = await saveAthleteProfile({ age: 'not-a-number' as unknown as number })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('validates input with zod — rejects negative weight', async () => {
    const result = await saveAthleteProfile({ weight_kg: -10 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('validates input with zod — rejects negative height', async () => {
    const result = await saveAthleteProfile({ height_cm: -5 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('accepts all-null/empty partial input', async () => {
    const result = await saveAthleteProfile({})
    expect(result.success).toBe(true)
  })

  it('calls revalidatePath for /coaching', async () => {
    await saveAthleteProfile(validProfile)
    expect(revalidatePath).toHaveBeenCalledWith('/coaching')
  })

  it('accepts nullable fields', async () => {
    const result = await saveAthleteProfile({
      age: null,
      weight_kg: null,
      gender: null,
    })
    expect(result.success).toBe(true)
  })
})
