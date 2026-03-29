// Characterization test — captures current behavior for safe refactoring
// T199: moveWorkout (time-aware), undoScheduleMove, resetWeekSchedule
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/cache before imports
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Use hoisted to define mocks before vi.mock factory runs
const { mockTransaction } = vi.hoisted(() => {
  return {
    mockTransaction: vi.fn(),
  }
})

vi.mock('@/lib/db/index', () => ({
  db: {
    transaction: mockTransaction,
  },
}))

import { revalidatePath } from 'next/cache'
import { moveWorkout, undoScheduleMove, resetWeekSchedule } from '../override-actions'

// Helper: build a tx mock with configurable query results
function buildTx(opts: {
  meso?: Record<string, unknown> | undefined
  sourceSlot?: Record<string, unknown> | undefined
  logged?: Record<string, unknown> | undefined
}) {
  let selectCallCount = 0

  const tx = {
    select: vi.fn(() => {
      selectCallCount++
      const currentCount = selectCallCount
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => {
              if (currentCount === 1) return opts.meso
              if (currentCount === 2) return opts.sourceSlot
              return opts.logged
            }),
          })),
        })),
      }
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          run: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn(() => ({ changes: 2 })),
      })),
    })),
  }

  return tx
}

function setupTx(tx: ReturnType<typeof buildTx>) {
  mockTransaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx))
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: transaction runs cb with empty tx
  mockTransaction.mockImplementation((cb: (t: ReturnType<typeof buildTx>) => unknown) => {
    return cb(buildTx({ meso: undefined, sourceSlot: undefined, logged: undefined }))
  })
})

// ---------- moveWorkout (time-aware) ----------

describe('moveWorkout', () => {
  const validInput = {
    mesocycle_id: 1,
    week_number: 1,
    schedule_id: 1,
    target_day: 2,
    target_time_slot: '18:00',
    target_duration: 60,
    scope: 'this_week' as const,
  }

  const activeMeso = {
    id: 1,
    name: 'Test',
    start_date: '2026-03-23',
    end_date: '2026-04-20',
    work_weeks: 4,
    has_deload: false,
    status: 'active',
  }

  const sourceSlot = {
    id: 1,
    mesocycle_id: 1,
    day_of_week: 0,
    template_id: 10,
    week_type: 'normal',
    period: 'morning',
    time_slot: '07:00',
    duration: 90,
  }

  describe('Zod validation', () => {
    it('rejects negative mesocycle_id', async () => {
      const result = await moveWorkout({ ...validInput, mesocycle_id: -1 })
      expect(result).toEqual({ success: false, error: 'Invalid mesocycle ID' })
    })

    it('rejects mesocycle_id = 0', async () => {
      const result = await moveWorkout({ ...validInput, mesocycle_id: 0 })
      expect(result).toEqual({ success: false, error: 'Invalid mesocycle ID' })
    })

    it('rejects target_day > 6', async () => {
      const result = await moveWorkout({ ...validInput, target_day: 7 })
      expect(result.success).toBe(false)
    })

    it('rejects invalid scope', async () => {
      const result = await moveWorkout({ ...validInput, scope: 'all_weeks' as 'this_week' })
      expect(result.success).toBe(false)
    })

    it('rejects week_number 0', async () => {
      const result = await moveWorkout({ ...validInput, week_number: 0 })
      expect(result).toEqual({ success: false, error: 'Invalid week number' })
    })

    it('rejects target_week_offset outside [-1, 1]', async () => {
      const result = await moveWorkout({ ...validInput, target_week_offset: 2 })
      expect(result.success).toBe(false)
    })

    it('rejects invalid time_slot format', async () => {
      const result = await moveWorkout({ ...validInput, target_time_slot: '25:00' })
      expect(result.success).toBe(false)
    })

    it('rejects non-positive duration', async () => {
      const result = await moveWorkout({ ...validInput, target_duration: 0 })
      expect(result.success).toBe(false)
    })

    it('defaults target_week_offset to 0', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result.success).toBe(true)
    })
  })

  describe('same-slot no-op guard', () => {
    it('returns error when source day+time and target day+time are identical (offset=0)', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({
        mesocycle_id: 1, week_number: 1,
        schedule_id: 1,
        target_day: 0, // same as source day_of_week
        target_time_slot: '07:00', // same as source time_slot
        target_duration: 60,
        scope: 'this_week',
      })
      expect(result).toEqual({ success: false, error: 'Cannot move to the same day and time' })
    })

    it('allows same day if target_time_slot differs', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({
        mesocycle_id: 1, week_number: 1,
        schedule_id: 1,
        target_day: 0,
        target_time_slot: '18:00',
        target_duration: 60,
        scope: 'this_week',
      })
      expect(result.success).toBe(true)
    })

    it('allows same day+time if target_week_offset != 0', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({
        mesocycle_id: 1, week_number: 1,
        schedule_id: 1,
        target_day: 0,
        target_time_slot: '07:00',
        target_duration: 60,
        scope: 'this_week',
        target_week_offset: 1,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('mesocycle guards', () => {
    it('returns error if mesocycle not found', async () => {
      const tx = buildTx({ meso: undefined, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result).toEqual({ success: false, error: 'Mesocycle not found' })
    })

    it('returns error if mesocycle is completed', async () => {
      const tx = buildTx({ meso: { ...activeMeso, status: 'completed' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result).toEqual({ success: false, error: 'Cannot modify schedule of a completed mesocycle' })
    })

    it('allows active mesocycle', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result.success).toBe(true)
    })

    it('allows planned mesocycle', async () => {
      const tx = buildTx({ meso: { ...activeMeso, status: 'planned' }, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result.success).toBe(true)
    })
  })

  describe('week_number upper bound', () => {
    it('rejects week > work_weeks when no deload', async () => {
      const tx = buildTx({ meso: { ...activeMeso, work_weeks: 4, has_deload: false }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({ ...validInput, week_number: 5 })
      expect(result).toEqual({ success: false, error: 'Invalid week number' })
    })

    it('allows week = work_weeks + 1 when has_deload', async () => {
      const tx = buildTx({ meso: { ...activeMeso, work_weeks: 4, has_deload: true }, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({ ...validInput, week_number: 5 })
      expect(result.success).toBe(true)
    })
  })

  describe('source slot guard', () => {
    it('returns error if source slot not found', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result).toEqual({ success: false, error: 'Source schedule entry not found or has no template' })
    })

    it('returns error if source slot has null template_id', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot: { ...sourceSlot, template_id: null }, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result).toEqual({ success: false, error: 'Source schedule entry not found or has no template' })
    })
  })

  describe('logged workout guard', () => {
    it('rejects this_week scope when workout is logged', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: { id: 99 } })
      setupTx(tx)
      const result = await moveWorkout({ ...validInput, scope: 'this_week' })
      expect(result).toEqual({ success: false, error: 'Cannot move an already-logged workout' })
    })

    it('skips logged weeks for remaining_weeks, all logged => error', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: { id: 99 } })
      setupTx(tx)
      const result = await moveWorkout({ ...validInput, scope: 'remaining_weeks' })
      expect(result).toEqual({ success: false, error: 'No weeks available to move (all logged)' })
    })
  })

  describe('override creation — this_week', () => {
    it('creates two override rows and returns override_group', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout(validInput)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.override_group).toMatch(/^move-/)
      }
      // 2 inserts: source null-out + target place
      expect(tx.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('override creation — remaining_weeks', () => {
    it('creates overrides for each remaining week', async () => {
      const tx = buildTx({ meso: { ...activeMeso, work_weeks: 4 }, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({ ...validInput, week_number: 2, scope: 'remaining_weeks' })
      expect(result.success).toBe(true)
      // Weeks 2,3,4 = 3 * 2 = 6 inserts
      expect(tx.insert).toHaveBeenCalledTimes(6)
    })
  })

  describe('target_week_offset bounds', () => {
    it('returns error when target week outside mesocycle (this_week)', async () => {
      const tx = buildTx({ meso: { ...activeMeso, work_weeks: 4, has_deload: false }, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({
        ...validInput, week_number: 4, scope: 'this_week', target_week_offset: 1,
      })
      expect(result).toEqual({ success: false, error: 'Target week is outside the mesocycle' })
    })

    it('skips OOB target weeks for remaining_weeks', async () => {
      const tx = buildTx({ meso: { ...activeMeso, work_weeks: 4, has_deload: false }, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({
        ...validInput, week_number: 3, scope: 'remaining_weeks', target_week_offset: 1,
      })
      expect(result.success).toBe(true)
      // Week 3: target=4 OK => 2 inserts. Week 4: target=5 OOB => skipped.
      expect(tx.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('revalidation', () => {
    it('calls revalidatePath on success', async () => {
      const tx = buildTx({ meso: activeMeso, sourceSlot, logged: undefined })
      setupTx(tx)
      await moveWorkout(validInput)
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
    })

    it('does not revalidate on failure', async () => {
      const tx = buildTx({ meso: undefined, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      await moveWorkout(validInput)
      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })

  // NOTE: possible bug — remaining_weeks scope uses work_weeks as upper bound,
  // so deload week (work_weeks+1) is never included in the iteration range.
  describe('remaining_weeks excludes deload week', () => {
    it('does NOT include deload week in remaining_weeks range', async () => {
      const tx = buildTx({ meso: { ...activeMeso, work_weeks: 4, has_deload: true }, sourceSlot, logged: undefined })
      setupTx(tx)
      const result = await moveWorkout({ ...validInput, week_number: 4, scope: 'remaining_weeks' })
      expect(result.success).toBe(true)
      // Only week 4, not week 5. 1 * 2 = 2 inserts
      expect(tx.insert).toHaveBeenCalledTimes(2)
    })
  })
})

// ---------- undoScheduleMove ----------

describe('undoScheduleMove', () => {
  describe('input validation', () => {
    it('rejects empty override_group', async () => {
      const result = await undoScheduleMove('', 1)
      expect(result).toEqual({ success: false, error: 'Missing override_group or mesocycle_id' })
    })

    it('rejects mesocycleId = 0 (falsy)', async () => {
      const result = await undoScheduleMove('move-123', 0)
      expect(result).toEqual({ success: false, error: 'Missing override_group or mesocycle_id' })
    })
  })

  describe('mesocycle guards', () => {
    it('returns error if mesocycle not found', async () => {
      const tx = buildTx({ meso: undefined, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await undoScheduleMove('move-123', 1)
      expect(result).toEqual({ success: false, error: 'Mesocycle not found' })
    })

    it('returns error if mesocycle is completed', async () => {
      const tx = buildTx({ meso: { id: 1, status: 'completed' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await undoScheduleMove('move-123', 1)
      expect(result).toEqual({ success: false, error: 'Cannot modify schedule of a completed mesocycle' })
    })
  })

  describe('successful undo', () => {
    it('deletes overrides and returns changes count', async () => {
      const tx = buildTx({ meso: { id: 1, status: 'active' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await undoScheduleMove('move-123', 1)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.deleted).toBe(2)
      }
      expect(tx.delete).toHaveBeenCalledTimes(1)
    })

    it('calls revalidatePath', async () => {
      const tx = buildTx({ meso: { id: 1, status: 'active' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      await undoScheduleMove('move-123', 1)
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
    })
  })
})

// ---------- resetWeekSchedule ----------

describe('resetWeekSchedule', () => {
  describe('input validation', () => {
    it('rejects mesocycleId = 0 (falsy)', async () => {
      const result = await resetWeekSchedule(0, 1)
      expect(result).toEqual({ success: false, error: 'Missing mesocycle_id or week_number' })
    })

    it('rejects weekNumber = 0 (falsy)', async () => {
      const result = await resetWeekSchedule(1, 0)
      expect(result).toEqual({ success: false, error: 'Missing mesocycle_id or week_number' })
    })
  })

  describe('mesocycle guards', () => {
    it('returns error if mesocycle not found', async () => {
      const tx = buildTx({ meso: undefined, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await resetWeekSchedule(1, 1)
      expect(result).toEqual({ success: false, error: 'Mesocycle not found' })
    })

    it('returns error if mesocycle is completed', async () => {
      const tx = buildTx({ meso: { id: 1, status: 'completed' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await resetWeekSchedule(1, 1)
      expect(result).toEqual({ success: false, error: 'Cannot modify schedule of a completed mesocycle' })
    })
  })

  describe('successful reset', () => {
    it('deletes overrides and returns changes count', async () => {
      const tx = buildTx({ meso: { id: 1, status: 'active' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      const result = await resetWeekSchedule(1, 2)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.deleted).toBe(2)
      }
      expect(tx.delete).toHaveBeenCalledTimes(1)
    })

    it('calls revalidatePath', async () => {
      const tx = buildTx({ meso: { id: 1, status: 'active' }, sourceSlot: undefined, logged: undefined })
      setupTx(tx)
      await resetWeekSchedule(1, 2)
      expect(revalidatePath).toHaveBeenCalledWith('/mesocycles', 'layout')
    })
  })
})
