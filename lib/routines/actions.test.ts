import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockWhere = vi.fn()
const mockReturning = vi.fn()
const mockValues = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockDeleteWhere = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateSet = vi.fn()
const mockUpdateWhere = vi.fn()
const mockUpdateReturning = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  sqlite: {},
}))

import {
  createRoutineItem,
  updateRoutineItem,
  deleteRoutineItem,
  markRoutineDone,
  markRoutineSkipped,
} from './actions'

// Valid base input for reuse
const validGlobal = {
  name: 'Morning Stretch',
  input_fields: ['duration'] as const,
  frequency_target: 3,
  scope_type: 'global' as const,
}

describe('createRoutineItem', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{
      id: 1, name: 'Morning Stretch', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'global',
      mesocycle_id: null, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
    // For mesocycle existence check
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
  })

  // --- Validation: name ---
  it('returns error when name is empty', async () => {
    const result = await createRoutineItem({ ...validGlobal, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error when name is whitespace only', async () => {
    const result = await createRoutineItem({ ...validGlobal, name: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error when name exceeds 255 chars', async () => {
    const result = await createRoutineItem({ ...validGlobal, name: 'a'.repeat(256) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  // --- Validation: input_fields ---
  it('returns error when no input fields selected', async () => {
    const result = await createRoutineItem({ ...validGlobal, input_fields: [] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/input field/i)
  })

  it('returns error for invalid input field value', async () => {
    const result = await createRoutineItem({
      ...validGlobal,
      input_fields: ['invalid' as 'weight'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts multiple valid input fields', async () => {
    mockReturning.mockResolvedValueOnce([{
      id: 1, name: 'Shoulder Mobility', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: true, has_reps: true,
      frequency_target: 3, scope: 'global',
      mesocycle_id: null, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await createRoutineItem({
      ...validGlobal,
      name: 'Shoulder Mobility',
      input_fields: ['duration', 'sets', 'reps'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts all 5 input fields', async () => {
    const result = await createRoutineItem({
      ...validGlobal,
      input_fields: ['weight', 'length', 'duration', 'sets', 'reps'],
    })
    expect(result.success).toBe(true)
  })

  // --- Validation: frequency_target ---
  it('returns error when frequency_target is 0', async () => {
    const result = await createRoutineItem({ ...validGlobal, frequency_target: 0 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/frequency/i)
  })

  it('returns error when frequency_target is negative', async () => {
    const result = await createRoutineItem({ ...validGlobal, frequency_target: -1 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/frequency/i)
  })

  it('returns error when frequency_target is not integer', async () => {
    const result = await createRoutineItem({ ...validGlobal, frequency_target: 2.5 })
    expect(result.success).toBe(false)
  })

  // --- Validation: scope_type global ---
  it('creates global item successfully', async () => {
    const result = await createRoutineItem(validGlobal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Morning Stretch')
      expect(result.data.scope).toBe('global')
    }
  })

  // --- Validation: scope_type per_mesocycle ---
  it('returns error when per_mesocycle missing mesocycle_id', async () => {
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'per_mesocycle',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mesocycle/i)
  })

  it('returns error when per_mesocycle has non-existent mesocycle_id', async () => {
    mockWhere.mockResolvedValueOnce([]) // no mesocycle found
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'per_mesocycle',
      mesocycle_id: 999,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mesocycle/i)
  })

  it('creates per_mesocycle item when mesocycle exists', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Block 1' }])
    mockReturning.mockResolvedValueOnce([{
      id: 2, name: 'Morning Stretch', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'mesocycle',
      mesocycle_id: 1, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'per_mesocycle',
      mesocycle_id: 1,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.scope).toBe('mesocycle')
  })

  // --- Validation: scope_type date_range ---
  it('returns error when date_range missing start_date', async () => {
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'date_range',
      end_date: '2026-04-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/start_date/i)
  })

  it('returns error when date_range missing end_date', async () => {
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'date_range',
      start_date: '2026-03-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/end_date/i)
  })

  it('returns error when end_date is before start_date', async () => {
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'date_range',
      start_date: '2026-04-01',
      end_date: '2026-03-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/end_date/i)
  })

  it('allows date_range where start_date equals end_date', async () => {
    mockReturning.mockResolvedValueOnce([{
      id: 3, name: 'Morning Stretch', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'date_range',
      mesocycle_id: null, start_date: '2026-03-15', end_date: '2026-03-15',
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'date_range',
      start_date: '2026-03-15',
      end_date: '2026-03-15',
    })
    expect(result.success).toBe(true)
  })

  it('creates date_range item with valid dates', async () => {
    mockReturning.mockResolvedValueOnce([{
      id: 4, name: 'Morning Stretch', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'date_range',
      mesocycle_id: null, start_date: '2026-03-01', end_date: '2026-04-01',
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'date_range',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scope).toBe('date_range')
      expect(result.data.start_date).toBe('2026-03-01')
      expect(result.data.end_date).toBe('2026-04-01')
    }
  })

  // --- Validation: scope_type skip_on_deload ---
  it('creates skip_on_deload item (maps to global scope + flag)', async () => {
    mockReturning.mockResolvedValueOnce([{
      id: 5, name: 'Morning Stretch', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'global',
      mesocycle_id: null, start_date: null, end_date: null,
      skip_on_deload: true, created_at: new Date(),
    }])
    const result = await createRoutineItem({
      ...validGlobal,
      scope_type: 'skip_on_deload',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.skip_on_deload).toBe(true)
    }
  })

  // --- Optional fields ---
  it('accepts optional category', async () => {
    mockReturning.mockResolvedValueOnce([{
      id: 6, name: 'Morning Stretch', category: 'mobility',
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'global',
      mesocycle_id: null, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await createRoutineItem({
      ...validGlobal,
      category: 'mobility',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.category).toBe('mobility')
  })

  it('trims name whitespace', async () => {
    const result = await createRoutineItem({ ...validGlobal, name: '  Morning Stretch  ' })
    expect(result.success).toBe(true)
  })
})

describe('updateRoutineItem', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    mockUpdate.mockReturnValue({ set: mockUpdateSet })
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning })
    mockUpdateReturning.mockResolvedValue([{
      id: 1, name: 'Updated Item', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'global',
      mesocycle_id: null, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
  })

  it('returns error for invalid ID', async () => {
    const result = await updateRoutineItem({ id: 0, ...validGlobal })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/id/i)
  })

  it('returns error when name is empty', async () => {
    const result = await updateRoutineItem({ id: 1, ...validGlobal, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/name/i)
  })

  it('returns error when no input fields', async () => {
    const result = await updateRoutineItem({ id: 1, ...validGlobal, input_fields: [] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/input field/i)
  })

  it('updates item with valid data', async () => {
    const result = await updateRoutineItem({ id: 1, ...validGlobal, name: 'Updated Item' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Updated Item')
  })

  it('returns not-found for non-existent item', async () => {
    mockUpdateReturning.mockResolvedValueOnce([])
    const result = await updateRoutineItem({ id: 999, ...validGlobal })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('clears mesocycle_id when scope changes from per_mesocycle to global', async () => {
    const result = await updateRoutineItem({
      id: 1,
      ...validGlobal,
      scope_type: 'global',
    })
    expect(result.success).toBe(true)
    // Verify .set() was called with mesocycle_id: null
    const setArg = mockUpdateSet.mock.calls[0][0]
    expect(setArg.mesocycle_id).toBeNull()
    expect(setArg.start_date).toBeNull()
    expect(setArg.end_date).toBeNull()
  })

  it('clears start_date and end_date when scope changes from date_range to global', async () => {
    const result = await updateRoutineItem({
      id: 1,
      ...validGlobal,
      scope_type: 'global',
      // These should be ignored and cleared
      start_date: '2026-03-01',
      end_date: '2026-04-30',
    })
    expect(result.success).toBe(true)
    const setArg = mockUpdateSet.mock.calls[0][0]
    expect(setArg.start_date).toBeNull()
    expect(setArg.end_date).toBeNull()
    expect(setArg.mesocycle_id).toBeNull()
  })

  it('clears mesocycle_id when scope changes to date_range', async () => {
    mockUpdateReturning.mockResolvedValueOnce([{
      id: 1, name: 'Updated Item', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'date_range',
      mesocycle_id: null, start_date: '2026-03-01', end_date: '2026-04-30',
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await updateRoutineItem({
      id: 1,
      ...validGlobal,
      scope_type: 'date_range',
      start_date: '2026-03-01',
      end_date: '2026-04-30',
    })
    expect(result.success).toBe(true)
    const setArg = mockUpdateSet.mock.calls[0][0]
    expect(setArg.mesocycle_id).toBeNull()
    expect(setArg.start_date).toBe('2026-03-01')
    expect(setArg.end_date).toBe('2026-04-30')
  })

  it('clears date fields when scope changes to per_mesocycle', async () => {
    // Mock mesocycle exists
    mockWhere.mockResolvedValueOnce([{ id: 1, name: 'Block 1' }])
    mockUpdateReturning.mockResolvedValueOnce([{
      id: 1, name: 'Updated Item', category: null,
      has_weight: false, has_length: false, has_duration: true,
      has_sets: false, has_reps: false,
      frequency_target: 3, scope: 'mesocycle',
      mesocycle_id: 1, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await updateRoutineItem({
      id: 1,
      ...validGlobal,
      scope_type: 'per_mesocycle',
      mesocycle_id: 1,
    })
    expect(result.success).toBe(true)
    const setArg = mockUpdateSet.mock.calls[0][0]
    expect(setArg.mesocycle_id).toBe(1)
    expect(setArg.start_date).toBeNull()
    expect(setArg.end_date).toBeNull()
  })

  it('updates input field columns when adding/removing fields', async () => {
    mockUpdateReturning.mockResolvedValueOnce([{
      id: 1, name: 'Updated Item', category: null,
      has_weight: true, has_length: false, has_duration: false,
      has_sets: true, has_reps: false,
      frequency_target: 3, scope: 'global',
      mesocycle_id: null, start_date: null, end_date: null,
      skip_on_deload: false, created_at: new Date(),
    }])
    const result = await updateRoutineItem({
      id: 1,
      ...validGlobal,
      input_fields: ['weight', 'sets'],
    })
    expect(result.success).toBe(true)
    const setArg = mockUpdateSet.mock.calls[0][0]
    expect(setArg.has_weight).toBe(true)
    expect(setArg.has_length).toBe(false)
    expect(setArg.has_duration).toBe(false)
    expect(setArg.has_sets).toBe(true)
    expect(setArg.has_reps).toBe(false)
  })

  it('validates scope fields same as create', async () => {
    const result = await updateRoutineItem({
      id: 1,
      ...validGlobal,
      scope_type: 'per_mesocycle',
      // missing mesocycle_id
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/mesocycle/i)
  })
})

describe('deleteRoutineItem', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    mockDelete.mockReturnValue({ where: mockDeleteWhere })
    mockDeleteWhere.mockResolvedValue(undefined)
  })

  it('returns error for invalid ID', async () => {
    const result = await deleteRoutineItem(0)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/id/i)
  })

  it('returns not-found for non-existent item', async () => {
    mockWhere.mockResolvedValueOnce([])
    const result = await deleteRoutineItem(999)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('deletes existing item successfully and calls db.delete', async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: 1 }]) // item exists
      .mockResolvedValueOnce([]) // no logs
    const result = await deleteRoutineItem(1)
    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })

  it('preserves routine_logs by refusing to delete when logs exist', async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: 1 }]) // item exists
      .mockResolvedValueOnce([{ id: 10, routine_item_id: 1 }]) // has logs
    const result = await deleteRoutineItem(1)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/existing logs/i)
    }
    // Verify db.delete was NOT called — logs are preserved
    expect(mockDelete).not.toHaveBeenCalled()
  })
})

// Shared routine item fixture for log tests
const mockRoutineItem = {
  id: 1, name: 'Body Weight', category: 'tracking',
  has_weight: true, has_length: false, has_duration: false,
  has_sets: false, has_reps: false,
  frequency_target: 7, scope: 'global',
  mesocycle_id: null, start_date: null, end_date: null,
  skip_on_deload: false, created_at: new Date(),
}

const mockMultiFieldItem = {
  ...mockRoutineItem,
  id: 2, name: 'Shoulder Mobility',
  has_weight: false, has_duration: true, has_sets: true, has_reps: true,
}

describe('markRoutineDone', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: item exists, no existing log
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{
      id: 1, routine_item_id: 1, log_date: '2026-03-15',
      status: 'done', value_weight: 72.5, value_length: null,
      value_duration: null, value_sets: null, value_reps: null,
      created_at: new Date(),
    }])
  })

  it('creates routine_log with status done and field values', async () => {
    // First call: item lookup; second call: duplicate check
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([]) // no existing log
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: { weight: 72.5 },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('done')
      expect(result.data.value_weight).toBe(72.5)
    }
  })

  it('returns error when routine_item_id is invalid', async () => {
    const result = await markRoutineDone({
      routine_item_id: 0,
      log_date: '2026-03-15',
      values: { weight: 72.5 },
    })
    expect(result.success).toBe(false)
  })

  it('returns error for invalid date format', async () => {
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '03-15-2026',
      values: { weight: 72.5 },
    })
    expect(result.success).toBe(false)
  })

  it('returns error when routine item not found', async () => {
    mockWhere.mockResolvedValueOnce([]) // item not found
    const result = await markRoutineDone({
      routine_item_id: 999,
      log_date: '2026-03-15',
      values: { weight: 72.5 },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('blocks duplicate: same item + same date', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem]) // item exists
      .mockResolvedValueOnce([{ id: 10 }]) // existing log found
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: { weight: 72.5 },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/already logged/i)
  })

  it('requires at least one field value', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([])
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: {},
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/at least one/i)
  })

  it('rejects negative values', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([])
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: { weight: -1 },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/negative/i)
  })

  it('accepts value of 0', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([])
    mockReturning.mockResolvedValueOnce([{
      id: 2, routine_item_id: 1, log_date: '2026-03-15',
      status: 'done', value_weight: 0, value_length: null,
      value_duration: null, value_sets: null, value_reps: null,
      created_at: new Date(),
    }])
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: { weight: 0 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer sets value', async () => {
    mockWhere
      .mockResolvedValueOnce([mockMultiFieldItem])
      .mockResolvedValueOnce([])
    const result = await markRoutineDone({
      routine_item_id: 2,
      log_date: '2026-03-15',
      values: { sets: 2.5 },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/integer/i)
  })

  it('rejects non-integer reps value', async () => {
    mockWhere
      .mockResolvedValueOnce([mockMultiFieldItem])
      .mockResolvedValueOnce([])
    const result = await markRoutineDone({
      routine_item_id: 2,
      log_date: '2026-03-15',
      values: { reps: 1.5 },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/integer/i)
  })

  it('only saves values for fields the item has enabled', async () => {
    // Item only has_weight=true, tries to set duration too
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([])
    mockReturning.mockResolvedValueOnce([{
      id: 3, routine_item_id: 1, log_date: '2026-03-15',
      status: 'done', value_weight: 72.5, value_length: null,
      value_duration: null, value_sets: null, value_reps: null,
      created_at: new Date(),
    }])
    const result = await markRoutineDone({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: { weight: 72.5, duration: 30 },
    })
    expect(result.success).toBe(true)
    // Insert should only include weight, not duration
    const insertValues = mockValues.mock.calls[0][0]
    expect(insertValues.value_weight).toBe(72.5)
    expect(insertValues.value_duration).toBeNull()
  })

  it('accepts partial field fill on multi-field item', async () => {
    mockWhere
      .mockResolvedValueOnce([mockMultiFieldItem])
      .mockResolvedValueOnce([])
    mockReturning.mockResolvedValueOnce([{
      id: 4, routine_item_id: 2, log_date: '2026-03-15',
      status: 'done', value_weight: null, value_length: null,
      value_duration: 15, value_sets: null, value_reps: null,
      created_at: new Date(),
    }])
    const result = await markRoutineDone({
      routine_item_id: 2,
      log_date: '2026-03-15',
      values: { duration: 15 },
    })
    expect(result.success).toBe(true)
  })
})

describe('markRoutineSkipped', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelect.mockReturnValue({ from: mockFrom })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockWhere.mockResolvedValue([])
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{
      id: 1, routine_item_id: 1, log_date: '2026-03-15',
      status: 'skipped', value_weight: null, value_length: null,
      value_duration: null, value_sets: null, value_reps: null,
      created_at: new Date(),
    }])
  })

  it('creates routine_log with status skipped and null values', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([])
    const result = await markRoutineSkipped({
      routine_item_id: 1,
      log_date: '2026-03-15',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('skipped')
      expect(result.data.value_weight).toBeNull()
    }
  })

  it('returns error for invalid routine_item_id', async () => {
    const result = await markRoutineSkipped({
      routine_item_id: -1,
      log_date: '2026-03-15',
    })
    expect(result.success).toBe(false)
  })

  it('returns error for invalid date format', async () => {
    const result = await markRoutineSkipped({
      routine_item_id: 1,
      log_date: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('returns error when routine item not found', async () => {
    mockWhere.mockResolvedValueOnce([])
    const result = await markRoutineSkipped({
      routine_item_id: 999,
      log_date: '2026-03-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('blocks duplicate: same item + same date', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([{ id: 10 }])
    const result = await markRoutineSkipped({
      routine_item_id: 1,
      log_date: '2026-03-15',
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/already logged/i)
  })

  it('inserts all field values as null', async () => {
    mockWhere
      .mockResolvedValueOnce([mockRoutineItem])
      .mockResolvedValueOnce([])
    await markRoutineSkipped({
      routine_item_id: 1,
      log_date: '2026-03-15',
    })
    const insertValues = mockValues.mock.calls[0][0]
    expect(insertValues.value_weight).toBeNull()
    expect(insertValues.value_length).toBeNull()
    expect(insertValues.value_duration).toBeNull()
    expect(insertValues.value_sets).toBeNull()
    expect(insertValues.value_reps).toBeNull()
  })
})
