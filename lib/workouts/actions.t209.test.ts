import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock the core save functions
const mockSaveWorkoutCore = vi.fn()
const mockSaveRunningWorkoutCore = vi.fn()
const mockSaveMmaWorkoutCore = vi.fn()
const mockSaveMixedWorkoutCore = vi.fn()

vi.mock('./save-workout', () => ({
  saveWorkoutCore: (...args: unknown[]) => mockSaveWorkoutCore(...args),
}))
vi.mock('./save-running-workout', () => ({
  saveRunningWorkoutCore: (...args: unknown[]) => mockSaveRunningWorkoutCore(...args),
}))
vi.mock('./save-mma-workout', () => ({
  saveMmaWorkoutCore: (...args: unknown[]) => mockSaveMmaWorkoutCore(...args),
}))
vi.mock('./save-mixed-workout', () => ({
  saveMixedWorkoutCore: (...args: unknown[]) => mockSaveMixedWorkoutCore(...args),
}))

// Mock db with a select chain to return mesocycle_id
const mockGet = vi.fn()
const mockWhere = vi.fn(() => ({ get: mockGet }))
const mockFrom = vi.fn(() => ({ where: mockWhere }))
const mockSelect = vi.fn(() => ({ from: mockFrom }))

vi.mock('@/lib/db', () => ({
  db: {
    select: () => mockSelect(),
  },
  sqlite: {},
}))

// Mock syncCompletion
const mockSyncCompletion = vi.fn()
vi.mock('@/lib/google/sync', () => ({
  syncCompletion: (...args: unknown[]) => mockSyncCompletion(...args),
}))

import {
  saveWorkout,
  saveRunningWorkout,
  saveMmaWorkout,
  saveMixedWorkout,
} from './actions'

describe('T209: completion sync after workout logging', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default: template lookup returns mesocycle_id=1
    mockGet.mockResolvedValue({ mesocycle_id: 1 })
    // syncCompletion resolves (fire-and-forget)
    mockSyncCompletion.mockResolvedValue({ created: 0, updated: 1, deleted: 0, failed: 0, errors: [] })
  })

  describe('saveWorkout', () => {
    const input = { templateId: 5, logDate: '2026-03-15', exercises: [], rating: null, notes: null }

    it('calls syncCompletion with correct args after successful save', async () => {
      mockSaveWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 1 } })

      await saveWorkout(input)

      expect(mockSyncCompletion).toHaveBeenCalledWith(1, 5, '2026-03-15')
    })

    it('does not call syncCompletion when save fails', async () => {
      mockSaveWorkoutCore.mockResolvedValue({ success: false, error: 'validation error' })

      await saveWorkout(input)

      expect(mockSyncCompletion).not.toHaveBeenCalled()
    })

    it('still returns success even if syncCompletion rejects', async () => {
      mockSaveWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 1 } })
      mockSyncCompletion.mockRejectedValue(new Error('Google API down'))

      const result = await saveWorkout(input)

      expect(result.success).toBe(true)
    })

    it('does not await syncCompletion (fire-and-forget pattern)', async () => {
      mockSaveWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 1 } })
      // syncCompletion that never resolves — should not block
      let resolveSync: () => void
      mockSyncCompletion.mockReturnValue(new Promise<void>((r) => { resolveSync = r }))

      const result = await saveWorkout(input)

      expect(result.success).toBe(true)
      // Clean up
      resolveSync!()
    })
  })

  describe('saveRunningWorkout', () => {
    const input = {
      templateId: 10, logDate: '2026-03-20',
      actualDistance: null, actualAvgPace: null, actualAvgHr: null,
      rating: null, notes: null,
    }

    it('calls syncCompletion after successful save', async () => {
      mockSaveRunningWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 2 } })

      await saveRunningWorkout(input)

      expect(mockSyncCompletion).toHaveBeenCalledWith(1, 10, '2026-03-20')
    })

    it('does not call syncCompletion when save fails', async () => {
      mockSaveRunningWorkoutCore.mockResolvedValue({ success: false, error: 'bad input' })

      await saveRunningWorkout(input)

      expect(mockSyncCompletion).not.toHaveBeenCalled()
    })
  })

  describe('saveMmaWorkout', () => {
    const input = {
      templateId: 15, logDate: '2026-03-22',
      actualDurationMinutes: null, feeling: null, notes: null,
    }

    it('calls syncCompletion after successful save', async () => {
      mockSaveMmaWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 3 } })

      await saveMmaWorkout(input)

      expect(mockSyncCompletion).toHaveBeenCalledWith(1, 15, '2026-03-22')
    })

    it('does not call syncCompletion when save fails', async () => {
      mockSaveMmaWorkoutCore.mockResolvedValue({ success: false, error: 'not mma' })

      await saveMmaWorkout(input)

      expect(mockSyncCompletion).not.toHaveBeenCalled()
    })
  })

  describe('saveMixedWorkout', () => {
    const input = {
      templateId: 20, logDate: '2026-03-25',
      sections: [], rating: null, notes: null,
    }

    it('calls syncCompletion after successful save', async () => {
      mockSaveMixedWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 4 } })

      await saveMixedWorkout(input)

      expect(mockSyncCompletion).toHaveBeenCalledWith(1, 20, '2026-03-25')
    })

    it('does not call syncCompletion when save fails', async () => {
      mockSaveMixedWorkoutCore.mockResolvedValue({ success: false, error: 'not mixed' })

      await saveMixedWorkout(input)

      expect(mockSyncCompletion).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('skips syncCompletion if template lookup returns null (no mesocycle_id)', async () => {
      mockSaveWorkoutCore.mockResolvedValue({ success: true, data: { workoutId: 1 } })
      mockGet.mockResolvedValue(null)

      const result = await saveWorkout({
        templateId: 5, logDate: '2026-03-15', exercises: [], rating: null, notes: null,
      })

      expect(result.success).toBe(true)
      expect(mockSyncCompletion).not.toHaveBeenCalled()
    })
  })
})
