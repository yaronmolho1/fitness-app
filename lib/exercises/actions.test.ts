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
const mockUpdateSet = vi.fn()
const mockUpdateWhere = vi.fn()
const mockUpdateReturning = vi.fn()
const mockUpdate = vi.fn()

const mockTx = {
  select: (...args: unknown[]) => mockSelect(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  delete: (...args: unknown[]) => mockDelete(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
}

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
  sqlite: {},
}))

import { createExercise, deleteExercise, editExercise } from './actions'

describe('createExercise', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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

describe('editExercise', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // select().from().where() for duplicate check
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    // update().set().where().returning()
    mockUpdate.mockReturnValue({ set: mockUpdateSet })
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning })
    mockUpdateReturning.mockResolvedValue([{
      id: 1, name: 'Squat Updated', modality: 'resistance',
      muscle_group: null, equipment: null, created_at: new Date(),
    }])
  })

  it('returns error when name is empty', async () => {
    const result = await editExercise({ id: 1, name: '', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error when name is whitespace only', async () => {
    const result = await editExercise({ id: 1, name: '   ', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error for invalid modality', async () => {
    const result = await editExercise({ id: 1, name: 'Squat', modality: 'yoga' as 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/modality/i)
  })

  it('returns error when name belongs to a different exercise', async () => {
    // Duplicate check returns a different exercise with same name
    mockWhere.mockResolvedValueOnce([{ id: 2, name: 'Bench Press' }])
    const result = await editExercise({ id: 1, name: 'Bench Press', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/exists/i)
  })

  it('allows saving with same name as current exercise', async () => {
    // Duplicate check returns the same exercise (id matches)
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Squat' }])
    const result = await editExercise({ id: 1, name: 'Squat', modality: 'resistance' })
    expect(result.success).toBe(true)
  })

  it('updates exercise with valid data', async () => {
    const result = await editExercise({
      id: 1, name: 'Squat Updated', modality: 'running',
      muscle_group: 'Legs', equipment: 'None',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Squat Updated')
    }
  })

  it('allows clearing muscle_group and equipment', async () => {
    mockUpdateReturning.mockResolvedValueOnce([{
      id: 1, name: 'Squat', modality: 'resistance',
      muscle_group: null, equipment: null, created_at: new Date(),
    }])
    const result = await editExercise({
      id: 1, name: 'Squat', modality: 'resistance',
      muscle_group: '', equipment: '',
    })
    expect(result.success).toBe(true)
  })

  it('allows changing modality', async () => {
    mockUpdateReturning.mockResolvedValueOnce([{
      id: 1, name: 'Sprint', modality: 'running',
      muscle_group: null, equipment: null, created_at: new Date(),
    }])
    const result = await editExercise({ id: 1, name: 'Sprint', modality: 'running' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.modality).toBe('running')
  })

  it('returns not-found when exercise does not exist', async () => {
    mockUpdateReturning.mockResolvedValueOnce([])
    const result = await editExercise({ id: 999, name: 'Ghost', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('revalidates path on success', async () => {
    await editExercise({ id: 1, name: 'Squat', modality: 'resistance' })
    expect(revalidatePath).toHaveBeenCalledWith('/exercises')
  })

  it('returns error for invalid ID', async () => {
    const result = await editExercise({ id: 0, name: 'Squat', modality: 'resistance' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/invalid/i)
  })
})

describe('deleteExercise', () => {
  const mockAll = vi.fn()
  const mockRun = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    // Inside transaction, select uses .all() instead of awaiting
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockReturnValue({ all: mockAll })
    // Delete chain uses .run()
    mockDelete.mockReturnValue({ where: mockDeleteWhere })
    mockDeleteWhere.mockReturnValue({ run: mockRun })
  })

  it('returns invalid ID error for bad input', async () => {
    const result = await deleteExercise(0)
    expect(result).toEqual({ success: false, error: 'Invalid exercise ID' })
  })

  it('returns not-found error for non-existent exercise', async () => {
    mockAll.mockReturnValueOnce([])

    const result = await deleteExercise(999)
    expect(result).toEqual({ success: false, error: 'Exercise not found' })
  })

  it('returns protection error when exercise has associated slots', async () => {
    // First .all() (existence check) returns exercise
    mockAll.mockReturnValueOnce([{ id: 1, name: 'Squat' }])
    // Second .all() (slots check) returns a slot
    mockAll.mockReturnValueOnce([{ id: 10, exercise_id: 1 }])

    const result = await deleteExercise(1)
    expect(result).toEqual({
      success: false,
      error: 'Exercise is in use and cannot be deleted',
    })
  })

  it('successfully deletes exercise with no slots', async () => {
    mockAll.mockReturnValueOnce([{ id: 1, name: 'Squat' }])
    mockAll.mockReturnValueOnce([])

    const result = await deleteExercise(1)
    expect(result).toEqual({ success: true })
  })

  it('revalidates path on successful delete', async () => {
    mockAll.mockReturnValueOnce([{ id: 1, name: 'Squat' }])
    mockAll.mockReturnValueOnce([])

    await deleteExercise(1)
    expect(revalidatePath).toHaveBeenCalledWith('/exercises')
  })
})
