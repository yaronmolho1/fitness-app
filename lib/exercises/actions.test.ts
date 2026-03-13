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
const mockDeleteWhere = vi.fn()
const mockDeleteReturning = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  sqlite: {},
}))

import { createExercise, deleteExercise } from './actions'

describe('createExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{
      id: 1, name: 'Squat', modality: 'resistance',
      muscle_group: null, equipment: null, created_at: new Date(),
    }])
  })

  it('returns error when name is missing', async () => {
    const result = await createExercise({ name: '', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error when modality is missing', async () => {
    const result = await createExercise({ name: 'Squat', modality: '' as 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/modality/i)
  })

  it('returns error for invalid modality', async () => {
    const result = await createExercise({ name: 'Squat', modality: 'yoga' as 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/modality/i)
  })

  it('returns error for whitespace-only name', async () => {
    const result = await createExercise({ name: '   ', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error when name exceeds 255 chars', async () => {
    const result = await createExercise({ name: 'a'.repeat(256), modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns success for valid input', async () => {
    const result = await createExercise({ name: 'Squat', modality: 'resistance' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveProperty('id')
      expect(result.data.name).toBe('Squat')
    }
  })

  it('returns error for case-insensitive duplicate name', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Squat' }])
    const result = await createExercise({ name: 'squat', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/exists/i)
  })

  it('trims whitespace from name', async () => {
    const result = await createExercise({ name: '  Squat  ', modality: 'resistance' })
    expect(result.success).toBe(true)
  })

  it('accepts optional muscle_group and equipment', async () => {
    const result = await createExercise({
      name: 'Squat', modality: 'resistance',
      muscle_group: 'Legs', equipment: 'Barbell',
    })
    expect(result.success).toBe(true)
  })
})

describe('deleteExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: select chain for existence + slots checks
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    // Default: delete chain
    mockDelete.mockReturnValue({ where: mockDeleteWhere })
    mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning })
  })

  it('returns not-found error for non-existent exercise', async () => {
    // First select (existence check) returns empty
    mockWhere.mockResolvedValueOnce([])

    const result = await deleteExercise(999)
    expect(result).toEqual({ success: false, error: 'Exercise not found' })
  })

  it('returns protection error when exercise has associated slots', async () => {
    // First select (existence check) returns exercise
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Squat' }])
    // Second select (slots check) returns a slot
    mockWhere.mockResolvedValueOnce([{ id: 10, exercise_id: 1 }])

    const result = await deleteExercise(1)
    expect(result).toEqual({
      success: false,
      error: 'Exercise is in use and cannot be deleted',
    })
  })

  it('successfully deletes exercise with no slots', async () => {
    // Existence check returns exercise
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Squat' }])
    // Slots check returns empty
    mockWhere.mockResolvedValueOnce([])
    // Delete returns affected row
    mockDeleteReturning.mockResolvedValueOnce([{ id: 1 }])

    const result = await deleteExercise(1)
    expect(result).toEqual({ success: true })
  })

  it('revalidates path on successful delete', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Squat' }])
    mockWhere.mockResolvedValueOnce([])
    mockDeleteReturning.mockResolvedValueOnce([{ id: 1 }])

    await deleteExercise(1)
    expect(revalidatePath).toHaveBeenCalledWith('/exercises')
  })
})
