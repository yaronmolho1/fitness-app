// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

import { getCascadePreview } from '@/lib/templates/cascade-actions'
import { cascadeSlotParams } from '@/lib/templates/cascade-slot-params'
import { cascadeAddSlot, cascadeRemoveSlot } from '@/lib/templates/cascade-slot-ops'
import { SlotCascadeScopeSelector } from './slot-cascade-scope-selector'

const mockPreview = {
  success: true as const,
  data: {
    totalTargets: 3,
    skippedCount: 1,
    targets: [
      { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
      { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: true },
      { id: 3, mesocycleId: 3, mesocycleName: 'Phase 3', hasLoggedWorkouts: false },
    ],
  },
}

describe('SlotCascadeScopeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCascadePreview).mockResolvedValue(mockPreview)
  })

  afterEach(() => {
    cleanup()
  })

  // --- Slot param edit cascade ---

  describe('slot param edit cascade', () => {
    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4, reps: 12 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('renders three scope options for param edits', async () => {
      render(<SlotCascadeScopeSelector {...paramProps} />)

      expect(await screen.findByText('This only')).toBeDefined()
      expect(screen.getByText('This + future')).toBeDefined()
      expect(screen.getByText('All phases')).toBeDefined()
    })

    it('shows preview of affected templates after selecting scope', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('Phase 1')).toBeDefined()
      expect(screen.getByText('Phase 2')).toBeDefined()
      expect(screen.getByText('Phase 3')).toBeDefined()
    })

    it('shows logged-workout skip warning in preview', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText(/1 template.*with logged workouts will be skipped/i)).toBeDefined()
    })

    it('calls cascadeSlotParams with correct args after confirm', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(cascadeSlotParams).toHaveBeenCalledWith({
          slotId: 5,
          scope: 'all-phases',
          updates: { sets: 4, reps: 12 },
        })
      })
    })

    it('calls onComplete immediately after cascade (toast replaces summary)', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
      })
    })

    it('calls onComplete immediately on this+future cascade', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('This + future'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
      })
    })

    it('calls onCancel from scope selection', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByRole('button', { name: /cancel/i }))
      expect(paramProps.onCancel).toHaveBeenCalledTimes(1)
    })
  })

  // --- Slot add cascade ---

  describe('slot add cascade', () => {
    const addProps = {
      templateId: 10,
      operation: 'add-slot' as const,
      sourceSlotId: 7,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('renders scope options for add operation', async () => {
      render(<SlotCascadeScopeSelector {...addProps} />)

      expect(await screen.findByText('This only')).toBeDefined()
      expect(screen.getByText('This + future')).toBeDefined()
      expect(screen.getByText('All phases')).toBeDefined()
    })

    it('calls cascadeAddSlot with correct args', async () => {
      vi.mocked(cascadeAddSlot).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...addProps} />)

      await user.click(await screen.findByText('This + future'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(cascadeAddSlot).toHaveBeenCalledWith({
          sourceSlotId: 7,
          scope: 'this-and-future',
        })
      })
    })

    it('calls onComplete immediately after add cascade', async () => {
      vi.mocked(cascadeAddSlot).mockResolvedValue({
        success: true,
        data: { updated: 3, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...addProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(addProps.onComplete).toHaveBeenCalledTimes(1)
      })
    })

    it('this-only skips cascade for add (no SA call)', async () => {
      vi.mocked(cascadeAddSlot).mockResolvedValue({
        success: true,
        data: { updated: 0, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...addProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(cascadeAddSlot).toHaveBeenCalledWith({
          sourceSlotId: 7,
          scope: 'this-only',
        })
      })
    })
  })

  // --- Slot remove cascade ---

  describe('slot remove cascade', () => {
    const removeProps = {
      templateId: 10,
      operation: 'remove-slot' as const,
      sourceExerciseId: 3,
      sourceOrder: 2,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('renders scope options for remove operation', async () => {
      render(<SlotCascadeScopeSelector {...removeProps} />)

      expect(await screen.findByText('This only')).toBeDefined()
      expect(screen.getByText('This + future')).toBeDefined()
      expect(screen.getByText('All phases')).toBeDefined()
    })

    it('calls cascadeRemoveSlot with correct args', async () => {
      vi.mocked(cascadeRemoveSlot).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...removeProps} />)

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

    it('calls onComplete immediately after remove cascade', async () => {
      vi.mocked(cascadeRemoveSlot).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 1 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...removeProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(removeProps.onComplete).toHaveBeenCalledTimes(1)
      })
    })
  })

  // --- Error handling ---

  describe('error handling', () => {
    it('shows error when cascade action fails', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: false,
        error: 'Slot not found',
      })

      const props = {
        templateId: 10,
        operation: 'update-params' as const,
        slotId: 5,
        paramUpdates: { sets: 4 },
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...props} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      expect(await screen.findByText('Slot not found')).toBeDefined()
    })

    it('shows error when preview fetch fails', async () => {
      vi.mocked(getCascadePreview).mockResolvedValue({
        success: false,
        error: 'Template not found',
      })

      const props = {
        templateId: 10,
        operation: 'update-params' as const,
        slotId: 5,
        paramUpdates: { sets: 4 },
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...props} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('Template not found')).toBeDefined()
    })

    it('cancel from confirm step returns to scope selection', async () => {
      const props = {
        templateId: 10,
        operation: 'update-params' as const,
        slotId: 5,
        paramUpdates: { sets: 4 },
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...props} />)

      // Select scope -> go to confirm
      await user.click(await screen.findByText('All phases'))
      expect(await screen.findByRole('button', { name: /confirm/i })).toBeDefined()

      // Cancel from confirm -> calls onCancel
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(props.onCancel).toHaveBeenCalledTimes(1)
    })
  })
})
