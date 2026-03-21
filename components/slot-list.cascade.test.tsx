// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: vi.fn(),
  removeExerciseSlot: vi.fn(),
  addExerciseSlot: vi.fn(),
  reorderExerciseSlots: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-actions', () => ({
  getCascadePreview: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-slot-params', () => ({
  cascadeSlotParams: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-slot-ops', () => ({
  cascadeAddSlot: vi.fn(),
  cascadeRemoveSlot: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { SlotList } from './slot-list'
import { updateExerciseSlot, removeExerciseSlot, addExerciseSlot } from '@/lib/templates/slot-actions'
import { getCascadePreview } from '@/lib/templates/cascade-actions'
import { cascadeSlotParams } from '@/lib/templates/cascade-slot-params'
import { cascadeRemoveSlot } from '@/lib/templates/cascade-slot-ops'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

const makeSlot = (overrides: Partial<SlotWithExercise> = {}): SlotWithExercise => ({
  id: 1,
  template_id: 10,
  exercise_id: 1,
  section_id: null,
  sets: 3,
  reps: '10',
  weight: 80,
  rpe: 8,
  rest_seconds: 120,
  group_id: null,
  group_rest_seconds: null,
  guidelines: 'Slow eccentric',
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
]

const mockPreview = {
  success: true as const,
  data: {
    totalTargets: 2,
    skippedCount: 0,
    targets: [
      { id: 10, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
      { id: 20, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
    ],
  },
}

describe('SlotList cascade integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCascadePreview).mockResolvedValue(mockPreview)
  })

  afterEach(() => {
    cleanup()
  })

  describe('slot param edit triggers cascade', () => {
    it('shows cascade selector after saving slot params', async () => {
      vi.mocked(updateExerciseSlot).mockResolvedValue({
        success: true,
        data: makeSlot({ sets: 5 }),
      })

      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={10} exercises={exercises} isCompleted={false} />)

      // Enter edit mode
      await user.click(screen.getByRole('button', { name: /edit/i }))
      const setsInput = screen.getByLabelText(/sets/i)
      await user.clear(setsInput)
      await user.type(setsInput, '5')
      await user.click(screen.getByRole('button', { name: /save/i }))

      // After local save, cascade selector should appear
      await waitFor(() => {
        expect(updateExerciseSlot).toHaveBeenCalled()
      })
      expect(await screen.findByText('This only')).toBeDefined()
      expect(screen.getByText('This + future')).toBeDefined()
      expect(screen.getByText('All phases')).toBeDefined()
    })

    it('completes cascade flow for slot param edit', async () => {
      vi.mocked(updateExerciseSlot).mockResolvedValue({
        success: true,
        data: makeSlot({ sets: 5 }),
      })
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={10} exercises={exercises} isCompleted={false} />)

      // Edit -> Save -> Cascade
      await user.click(screen.getByRole('button', { name: /edit/i }))
      const setsInput = screen.getByLabelText(/sets/i)
      await user.clear(setsInput)
      await user.type(setsInput, '5')
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(updateExerciseSlot).toHaveBeenCalled()
      })

      // Select scope
      await user.click(await screen.findByText('This + future'))
      // Confirm
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(cascadeSlotParams).toHaveBeenCalled()
      })

      // Summary
      expect(await screen.findByText(/2 updated/)).toBeDefined()
    })
  })

  describe('slot remove triggers cascade', () => {
    it('shows cascade selector after confirming slot removal', async () => {
      vi.mocked(removeExerciseSlot).mockResolvedValue({ success: true })

      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={10} exercises={exercises} isCompleted={false} />)

      // Remove -> Confirm
      await user.click(screen.getByRole('button', { name: /remove/i }))
      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(removeExerciseSlot).toHaveBeenCalledWith(1)
      })

      // Cascade selector should appear
      expect(await screen.findByText('This only')).toBeDefined()
      expect(screen.getByText('All phases')).toBeDefined()
    })

    it('calls cascadeRemoveSlot with correct args', async () => {
      vi.mocked(removeExerciseSlot).mockResolvedValue({ success: true })
      vi.mocked(cascadeRemoveSlot).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      const slot = makeSlot({ exercise_id: 3, order: 2 })
      render(<SlotList slots={[slot]} templateId={10} exercises={exercises} isCompleted={false} />)

      // Remove -> Confirm
      await user.click(screen.getByRole('button', { name: /remove/i }))
      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(removeExerciseSlot).toHaveBeenCalled()
      })

      // Cascade flow
      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(cascadeRemoveSlot).toHaveBeenCalledWith({
          sourceExerciseId: 3,
          sourceOrder: 2,
          templateId: 10,
          scope: 'all-phases',
        })
      })
    })
  })

  describe('slot add triggers cascade', () => {
    it('shows cascade selector after adding a new exercise slot', async () => {
      vi.mocked(addExerciseSlot).mockResolvedValue({
        success: true,
        data: makeSlot({ id: 99, exercise_id: 2, exercise_name: 'Squat' }),
      })

      const user = userEvent.setup()
      render(<SlotList slots={[]} templateId={10} exercises={exercises} isCompleted={false} />)

      // Open picker
      await user.click(screen.getByRole('button', { name: /add exercise/i }))
      // Select exercise
      await user.click(screen.getByText('Squat'))

      await waitFor(() => {
        expect(addExerciseSlot).toHaveBeenCalled()
      })

      // Cascade selector should appear
      expect(await screen.findByText('This only')).toBeDefined()
      expect(screen.getByText('All phases')).toBeDefined()
    })
  })
})
