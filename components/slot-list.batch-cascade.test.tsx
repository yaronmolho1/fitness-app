// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: vi.fn(),
  removeExerciseSlot: vi.fn(),
  addExerciseSlot: vi.fn(),
  reorderExerciseSlots: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-actions', () => ({
  getCascadePreview: vi.fn().mockResolvedValue({
    success: true,
    data: {
      totalTargets: 2,
      skippedCount: 0,
      targets: [
        { id: 10, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
        { id: 20, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
      ],
    },
  }),
}))

vi.mock('@/lib/templates/cascade-slot-params', () => ({
  cascadeSlotParams: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-slot-ops', () => ({
  cascadeAddSlot: vi.fn(),
  cascadeRemoveSlot: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-batch', () => ({
  batchCascadeSlotEdits: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { SlotList } from './slot-list'
import { updateExerciseSlot } from '@/lib/templates/slot-actions'
import { batchCascadeSlotEdits } from '@/lib/templates/cascade-batch'
import { getCascadePreview } from '@/lib/templates/cascade-actions'
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
  overrideCount: 0,
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
  { id: 3, name: 'Row', modality: 'resistance' as const, muscle_group: 'Back', equipment: 'Barbell', created_at: new Date() },
]

// Helper: defer-save a slot edit (client-only, no DB write)
async function deferSaveSlot(user: ReturnType<typeof userEvent.setup>, rowIndex: number, field: RegExp, value: string) {
  const rows = screen.getAllByTestId('slot-row')
  await user.click(within(rows[rowIndex]).getByRole('button', { name: /edit/i }))
  const input = screen.getByLabelText(field)
  await user.clear(input)
  await user.type(input, value)
  await user.click(screen.getByRole('button', { name: /save for later/i }))
}

describe('SlotList batch cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 2,
        skippedCount: 0,
        targets: [
          { id: 10, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
          { id: 20, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
        ],
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  // ---- AC1: Per-slot cascade unchanged (backwards compatible) ----

  describe('AC1: per-slot cascade unchanged', () => {
    it('single slot edit still triggers per-slot cascade selector', async () => {
      vi.mocked(updateExerciseSlot).mockResolvedValue({
        success: true,
        data: makeSlot({ sets: 5 }),
      })

      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={10} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      const setsInput = screen.getByLabelText(/sets/i)
      await user.clear(setsInput)
      await user.type(setsInput, '5')
      // Click "Save" (not "Save for later") for per-slot cascade
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      // Per-slot cascade selector should still appear
      await waitFor(() => {
        expect(updateExerciseSlot).toHaveBeenCalled()
      })
      expect(await screen.findByText('This only')).toBeInTheDocument()
      expect(screen.getByText('This + future')).toBeInTheDocument()
      expect(screen.getByText('All phases')).toBeInTheDocument()
    })
  })

  // ---- AC6: Visual indicators on edited slots ----

  describe('AC6: pending edit visual indicators', () => {
    it('shows visual indicator on slots with pending edits', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      // "Save for later" is now client-only — no DB write
      await deferSaveSlot(user, 0, /sets/i, '5')

      // updateExerciseSlot should NOT be called
      expect(updateExerciseSlot).not.toHaveBeenCalled()

      // First slot should have pending edit indicator
      const updatedRows = screen.getAllByTestId('slot-row')
      expect(within(updatedRows[0]).getByTestId('pending-edit-indicator')).toBeInTheDocument()
      // Second slot should NOT have indicator
      expect(within(updatedRows[1]).queryByTestId('pending-edit-indicator')).not.toBeInTheDocument()
    })

    it('displays pending values in slot display', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, sets: 3, reps: '10', exercise_name: 'Bench Press' }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')

      // Should display pending value (5) not original (3)
      const row = screen.getByTestId('slot-row')
      expect(row).toHaveTextContent('5')
    })
  })

  // ---- AC2: "Apply Changes" button appears when multiple slots have pending edits ----

  describe('AC2: Apply Changes button', () => {
    it('shows "Apply Changes" when slot has pending edits', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      // No Apply Changes button initially
      expect(screen.queryByRole('button', { name: /apply changes/i })).not.toBeInTheDocument()

      // Defer-save first slot (client-only)
      await deferSaveSlot(user, 0, /sets/i, '5')

      // Apply Changes button should be visible after one edit
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()

      // Defer-save second slot
      await deferSaveSlot(user, 1, /reps/i, '12')

      // Still visible
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
    })

    it('does NOT show "Apply Changes" when no pending edits', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      expect(screen.queryByRole('button', { name: /apply changes/i })).not.toBeInTheDocument()
    })
  })

  // ---- AC3: Single cascade scope selector for batch mode ----

  describe('AC3: batch cascade scope selector', () => {
    it('clicking "Apply Changes" opens cascade scope selector for all pending edits', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')
      await deferSaveSlot(user, 1, /reps/i, '12')

      // Click Apply Changes
      await user.click(screen.getByRole('button', { name: /apply changes/i }))

      // Should show cascade scope options
      expect(await screen.findByText('This only')).toBeInTheDocument()
      expect(screen.getByText('This + future')).toBeInTheDocument()
      expect(screen.getByText('All phases')).toBeInTheDocument()
    })
  })

  // ---- AC4 & AC5: Batch applies atomically ----

  describe('AC4+AC5: batch cascade applies atomically', () => {
    it('calls batchCascadeSlotEdits with all pending edits and chosen scope', async () => {
      vi.mocked(batchCascadeSlotEdits).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')
      await deferSaveSlot(user, 1, /reps/i, '12')

      // Apply Changes -> Select scope -> Confirm
      await user.click(screen.getByRole('button', { name: /apply changes/i }))
      await user.click(await screen.findByText('This + future'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(batchCascadeSlotEdits).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: 10,
            scope: 'this-and-future',
            edits: expect.arrayContaining([
              expect.objectContaining({ slotId: 1 }),
              expect.objectContaining({ slotId: 2 }),
            ]),
          })
        )
      })
    })

    it('does not call updateExerciseSlot on "Save for later" — DB write deferred to batch', async () => {
      const user = userEvent.setup()
      const slots = [makeSlot({ id: 1, order: 1 })]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')

      expect(updateExerciseSlot).not.toHaveBeenCalled()
    })
  })

  // ---- AC8: "Discard Changes" reverts all pending edits ----

  describe('AC8: Discard Changes', () => {
    it('shows "Discard Changes" alongside "Apply Changes" when edits pending', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')

      expect(screen.getByRole('button', { name: /discard changes/i })).toBeInTheDocument()
    })

    it('clicking "Discard Changes" clears all pending edits and indicators', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')

      // Click Discard
      await user.click(screen.getByRole('button', { name: /discard changes/i }))

      // No more pending indicators
      expect(screen.queryByTestId('pending-edit-indicator')).not.toBeInTheDocument()
      // No more Apply/Discard buttons
      expect(screen.queryByRole('button', { name: /apply changes/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /discard changes/i })).not.toBeInTheDocument()
    })

    it('"Discard Changes" reverts displayed values to original (no DB was written)', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, sets: 3, reps: '10', exercise_name: 'Bench Press' }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')

      // Pending value should show
      expect(screen.getByTestId('slot-row')).toHaveTextContent('5')

      // Discard
      await user.click(screen.getByRole('button', { name: /discard changes/i }))

      // Should revert to original value
      expect(screen.getByTestId('slot-row')).toHaveTextContent('3')
      // No DB writes happened at all
      expect(updateExerciseSlot).not.toHaveBeenCalled()
    })
  })

  // ---- AC7: Navigate-away warning ----

  describe('AC7: navigate-away warning', () => {
    it('registers beforeunload handler when edits are pending', async () => {
      const addEventSpy = vi.spyOn(window, 'addEventListener')

      const user = userEvent.setup()
      const slots = [makeSlot({ id: 1, order: 1 })]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')

      expect(addEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      addEventSpy.mockRestore()
    })
  })

  // ---- AC9: Sonner toast aggregate summary ----

  describe('AC9: aggregate toast', () => {
    it('fires aggregate toast after batch cascade completes', async () => {
      vi.mocked(batchCascadeSlotEdits).mockResolvedValue({
        success: true,
        data: { updated: 4, skipped: 1, skippedCompleted: 0, skippedNoMatch: 1 },
      })

      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      await deferSaveSlot(user, 0, /sets/i, '5')
      await deferSaveSlot(user, 1, /reps/i, '12')

      // Apply Changes -> Select scope -> Confirm
      await user.click(screen.getByRole('button', { name: /apply changes/i }))
      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      // Batch cascade completes — pending edits should be cleared
      await waitFor(() => {
        expect(batchCascadeSlotEdits).toHaveBeenCalled()
      })

      // Pending edits cleared after success
      await waitFor(() => {
        expect(screen.queryByTestId('pending-edit-indicator')).not.toBeInTheDocument()
      })
    })
  })

  // ---- AC10: Per-slot and batch modes coexist ----

  describe('AC10: per-slot and batch coexist', () => {
    it('per-slot save triggers per-slot cascade, not batch', async () => {
      vi.mocked(updateExerciseSlot).mockResolvedValue({
        success: true,
        data: makeSlot({ sets: 5 }),
      })

      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={10} exercises={exercises} isCompleted={false} />)

      // Normal edit + save (not "save for later")
      const rows = screen.getAllByTestId('slot-row')
      await user.click(within(rows[0]).getByRole('button', { name: /edit/i }))
      await user.clear(screen.getByLabelText(/sets/i))
      await user.type(screen.getByLabelText(/sets/i), '5')
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() => {
        expect(updateExerciseSlot).toHaveBeenCalled()
      })

      // Should see per-slot cascade, not batch
      expect(await screen.findByText('This only')).toBeInTheDocument()
      // batchCascadeSlotEdits should NOT be called
      expect(batchCascadeSlotEdits).not.toHaveBeenCalled()
    })
  })
})
