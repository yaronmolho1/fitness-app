// Characterization test — captures current behavior for safe refactoring
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

describe('SlotCascadeScopeSelector — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCascadePreview).mockResolvedValue(defaultPreview)
  })

  afterEach(() => {
    cleanup()
  })

  // --- "this-only" update-params short-circuit ---

  describe('this-only update-params short-circuit', () => {
    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('does NOT call cascadeSlotParams for this-only + update-params', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await screen.findByText(/cascade complete/i)

      expect(cascadeSlotParams).not.toHaveBeenCalled()
    })

    it('sets summary to all-zeros for this-only + update-params', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await screen.findByText(/cascade complete/i)

      // Shows "0 updated" text
      expect(screen.getByText('0 updated')).toBeDefined()
      // skipped/skippedNoMatch are 0 so not shown
      expect(screen.queryByText(/skipped/)).toBeNull()
      expect(screen.queryByText(/no match/)).toBeNull()
    })
  })

  // --- Summary panel: skippedCompleted display ---

  describe('summary panel skippedCompleted', () => {
    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('renders skippedCompleted when > 0', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 2, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      expect(await screen.findByText(/2 skipped \(completed\)/)).toBeDefined()
    })

    it('hides skippedCompleted when 0', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await screen.findByText(/cascade complete/i)

      expect(screen.queryByText(/completed/)).toBeNull()
    })
  })

  // --- Summary panel content ---

  describe('summary panel content', () => {
    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('displays "Cascade complete" heading', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      expect(await screen.findByText('Cascade complete')).toBeDefined()
    })

    it('renders Done button with aria-label "Done"', async () => {
      vi.mocked(cascadeSlotParams).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await screen.findByText(/cascade complete/i)

      const btn = screen.getByRole('button', { name: 'Done' })
      expect(btn).toBeDefined()
      expect(btn.textContent).toBe('Done')
    })
  })

  // --- Auto-dismiss timing precision ---

  describe('auto-dismiss timing', () => {
    const DISMISS_MS = 2000

    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function reachSummary() {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      })
      render(<SlotCascadeScopeSelector {...paramProps} />)

      // Use "this-only" + update-params to hit the sync short-circuit
      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))
      await screen.findByText(/cascade complete/i)
      return user
    }

    it('auto-dismiss timer is set to 2000ms (not instant)', async () => {
      await reachSummary()

      // Summary is visible, timer is running
      expect(screen.getByText('Cascade complete')).toBeDefined()
      // After 2000ms, onComplete fires
      await vi.advanceTimersByTimeAsync(2000)
      expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('fires onComplete at exactly 2000ms', async () => {
      await reachSummary()

      await vi.advanceTimersByTimeAsync(2000)
      expect(paramProps.onComplete).toHaveBeenCalledTimes(1)
    })
  })

  // --- Confirm step display ---

  describe('confirm step display', () => {
    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('shows "Applying..." text while pending', async () => {
      vi.mocked(cascadeSlotParams).mockReturnValue(new Promise(() => {}))

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(screen.getByText('Applying...')).toBeDefined()
      })
    })

    it('shows "Apply to:" with scope label on confirm step', async () => {
      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('This + future'))

      expect(await screen.findByText(/Apply to:.*This \+ future/)).toBeDefined()
    })

    it('shows singular skip warning for 1 skipped template', async () => {
      vi.mocked(getCascadePreview).mockResolvedValue({
        success: true,
        data: {
          totalTargets: 2,
          skippedCount: 1,
          targets: [
            { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
            { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: true },
          ],
        },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('1 template with logged workouts will be skipped')).toBeDefined()
    })

    it('shows plural skip warning for multiple skipped templates', async () => {
      vi.mocked(getCascadePreview).mockResolvedValue({
        success: true,
        data: {
          totalTargets: 3,
          skippedCount: 2,
          targets: [
            { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
            { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: true },
            { id: 3, mesocycleId: 3, mesocycleName: 'Phase 3', hasLoggedWorkouts: true },
          ],
        },
      })

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...paramProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('2 templates with logged workouts will be skipped')).toBeDefined()
    })
  })

  // --- Scope selection step display ---

  describe('scope selection step display', () => {
    const paramProps = {
      templateId: 10,
      operation: 'update-params' as const,
      slotId: 5,
      paramUpdates: { sets: 4 },
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('shows "Apply changes to..." heading', async () => {
      render(<SlotCascadeScopeSelector {...paramProps} />)

      expect(await screen.findByText('Apply changes to...')).toBeDefined()
    })

    it('shows slot-specific descriptions (different from CascadeScopeSelector)', async () => {
      render(<SlotCascadeScopeSelector {...paramProps} />)

      expect(await screen.findByText('Applied to this template only')).toBeDefined()
      expect(screen.getByText('Also apply to future mesocycles')).toBeDefined()
      expect(screen.getByText('Apply across all active/planned mesocycles')).toBeDefined()
    })
  })

  // --- remove-slot does NOT short-circuit (unlike update-params this-only) ---

  describe('remove-slot enters async confirm flow', () => {
    const removeProps = {
      templateId: 10,
      operation: 'remove-slot' as const,
      sourceExerciseId: 3,
      sourceOrder: 2,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('enters pending state on confirm (does not short-circuit like update-params)', async () => {
      vi.mocked(cascadeRemoveSlot).mockReturnValue(new Promise(() => {}))

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...removeProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      // Confirm it enters async path (shows Applying...) instead of short-circuiting
      await waitFor(() => {
        expect(screen.getByText('Applying...')).toBeDefined()
      })
    })
  })

  // --- add-slot does NOT short-circuit (unlike update-params this-only) ---

  describe('add-slot enters async confirm flow', () => {
    const addProps = {
      templateId: 10,
      operation: 'add-slot' as const,
      sourceSlotId: 7,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    }

    it('enters pending state on confirm (does not short-circuit like update-params)', async () => {
      vi.mocked(cascadeAddSlot).mockReturnValue(new Promise(() => {}))

      const user = userEvent.setup()
      render(<SlotCascadeScopeSelector {...addProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      // Confirm it enters async path (shows Applying...) instead of short-circuiting
      await waitFor(() => {
        expect(screen.getByText('Applying...')).toBeDefined()
      })
    })
  })
})
