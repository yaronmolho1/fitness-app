// @vitest-environment jsdom
// T136: Toast notification tests for SlotCascadeScopeSelector
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
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

import { getCascadePreview } from '@/lib/templates/cascade-actions'
import { cascadeSlotParams } from '@/lib/templates/cascade-slot-params'
import { cascadeAddSlot, cascadeRemoveSlot } from '@/lib/templates/cascade-slot-ops'
import { SlotCascadeScopeSelector } from './slot-cascade-scope-selector'

const defaultPreview = {
  success: true as const,
  data: {
    totalTargets: 2,
    skippedCount: 0,
    targets: [
      { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
      { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
    ],
  },
}

const paramProps = {
  templateId: 10,
  operation: 'update-params' as const,
  slotId: 5,
  paramUpdates: { sets: 4 },
  onComplete: vi.fn(),
  onCancel: vi.fn(),
}

describe('SlotCascadeScopeSelector — toast notifications (T136)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCascadePreview).mockResolvedValue(defaultPreview)
  })

  afterEach(() => {
    cleanup()
  })

  // AC1: toast fires on cascade complete, selector closes immediately
  describe('AC1: toast + immediate close', () => {
    it('fires toast and calls onComplete immediately on cascade success', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
      expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('does not show summary panel after cascade success', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(paramProps.onComplete).toHaveBeenCalled()
      })

      expect(screen.queryByText('Cascade complete')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    })
  })

  // AC4: success toast with zero skips
  describe('AC4: success toast format', () => {
    it('shows "2 templates updated" when no skips', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('2 templates updated')
      })
    })
  })

  // AC5: warning toast with skips
  describe('AC5: warning toast with skips', () => {
    it('shows warning toast for cascadeSlotParams with skips', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('2 updated, 1 skipped — has logs')
      })
    })

    it('shows warning toast for cascadeAddSlot with skips', async () => {
      vi.mocked(cascadeAddSlot).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 2, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const addProps = {
        templateId: 10,
        operation: 'add-slot' as const,
        sourceSlotId: 7,
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...addProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('1 updated, 2 skipped — has logs')
      })
    })

    it('shows warning toast for cascadeRemoveSlot with skips', async () => {
      vi.mocked(cascadeRemoveSlot).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const removeProps = {
        templateId: 10,
        operation: 'remove-slot' as const,
        sourceExerciseId: 3,
        sourceOrder: 2,
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...removeProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('1 updated, 1 skipped — has logs')
      })
    })
  })

  // AC6: "This only" scope shows "Template updated"
  describe('AC6: this-only simplified message', () => {
    it('shows "Template updated" for this-only + update-params (short-circuit)', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Template updated')
      })
      expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('shows "Template updated" for this-only + add-slot', async () => {
      vi.mocked(cascadeAddSlot).mockResolvedValue({
        success: true,
        data: { updated: 0, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const addProps = {
        templateId: 10,
        operation: 'add-slot' as const,
        sourceSlotId: 7,
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...addProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Template updated')
      })
    })

    it('shows "Template updated" for this-only + remove-slot', async () => {
      vi.mocked(cascadeRemoveSlot).mockResolvedValue({
        success: true,
        data: { updated: 0, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const removeProps = {
        templateId: 10,
        operation: 'remove-slot' as const,
        sourceExerciseId: 3,
        sourceOrder: 2,
        onComplete: vi.fn(),
        onCancel: vi.fn(),
      }

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...removeProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Template updated')
      })
    })
  })

  // AC7: no summary step
  describe('AC7: no summary step', () => {
    it('calls onComplete immediately without showing summary', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
      })
    })
  })

  // Edge case: error on failure
  describe('error handling', () => {
    it('shows inline error on cascade failure, selector stays open', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: false,
        error: 'Slot not found',
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      expect(await screen.findByText('Slot not found')).toBeDefined()
      expect(paramProps.onComplete).not.toHaveBeenCalled()
    })
  })
})
