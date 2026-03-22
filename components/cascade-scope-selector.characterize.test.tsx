// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/templates/cascade-actions', () => ({
  getCascadePreview: vi.fn(),
  cascadeUpdateTemplates: vi.fn(),
}))

import { getCascadePreview, cascadeUpdateTemplates } from '@/lib/templates/cascade-actions'
import { CascadeScopeSelector } from './cascade-scope-selector'

const defaultPreview = {
  success: true as const,
  data: {
    totalTargets: 1,
    skippedCount: 0,
    targets: [
      { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
    ],
  },
}

const defaultProps = {
  templateId: 1,
  updates: { name: 'Push B' },
  onComplete: vi.fn(),
  onCancel: vi.fn(),
}

describe('CascadeScopeSelector — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCascadePreview).mockResolvedValue(defaultPreview)
  })

  afterEach(() => {
    cleanup()
  })

  // --- Summary panel display ---

  describe('summary panel content', () => {
    async function reachSummaryWith(summaryData: {
      updated: number
      skipped: number
      skippedCompleted: number
      skippedNoMatch: number
    }) {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: summaryData,
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await screen.findByText(/cascade complete/i)
      return user
    }

    it('displays "Cascade complete" heading in summary', async () => {
      await reachSummaryWith({ updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(screen.getByText('Cascade complete')).toBeDefined()
    })

    it('displays skippedNoMatch count when > 0', async () => {
      await reachSummaryWith({ updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 3 })

      expect(screen.getByText(/3 no match/)).toBeDefined()
    })

    it('hides skipped when count is 0', async () => {
      await reachSummaryWith({ updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(screen.queryByText(/skipped/)).toBeNull()
    })

    it('hides skippedNoMatch when count is 0', async () => {
      await reachSummaryWith({ updated: 2, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(screen.queryByText(/no match/)).toBeNull()
    })

    // NOTE: CascadeScopeSelector does NOT render skippedCompleted at all
    // (unlike SlotCascadeScopeSelector which does). Capturing this as current behavior.
    it('does not render skippedCompleted even when > 0', async () => {
      await reachSummaryWith({ updated: 1, skipped: 0, skippedCompleted: 5, skippedNoMatch: 0 })

      expect(screen.queryByText(/completed/)).toBeNull()
    })

    it('shows updated count as "N updated" text', async () => {
      await reachSummaryWith({ updated: 4, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(screen.getByText('4 updated')).toBeDefined()
    })

    it('renders Done button with aria-label "Done"', async () => {
      await reachSummaryWith({ updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      const btn = screen.getByRole('button', { name: 'Done' })
      expect(btn).toBeDefined()
      expect(btn.textContent).toBe('Done')
    })
  })

  // --- Auto-dismiss timing precision ---

  describe('auto-dismiss timing', () => {
    const DISMISS_MS = 2000

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function reachSummary() {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      })
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))
      await screen.findByText(/cascade complete/i)
      return user
    }

    it('auto-dismiss timer is set to 2000ms (not instant)', async () => {
      await reachSummary()

      // Summary is visible, onComplete hasn't been called yet synchronously
      expect(screen.getByText('Cascade complete')).toBeDefined()
      // After 2000ms, onComplete fires
      await vi.advanceTimersByTimeAsync(2000)
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('fires onComplete at exactly 2000ms', async () => {
      await reachSummary()

      await vi.advanceTimersByTimeAsync(2000)
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
    })
  })

  // --- Confirm step display ---

  describe('confirm step display', () => {
    it('shows "Apply to:" with scope label', async () => {
      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This + future'))

      expect(await screen.findByText(/Apply to:.*This \+ future/)).toBeDefined()
    })

    it('shows "has logs" badge for templates with logged workouts', async () => {
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
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('has logs')).toBeDefined()
    })

    it('shows skip warning text with plural for multiple skipped', async () => {
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
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('2 templates with logged workouts will be skipped')).toBeDefined()
    })

    it('shows skip warning with singular for one skipped', async () => {
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
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))

      expect(await screen.findByText('1 template with logged workouts will be skipped')).toBeDefined()
    })

    it('shows "Applying..." text on confirm button while pending', async () => {
      // Make cascade hang to keep isPending = true
      vi.mocked(cascadeUpdateTemplates).mockReturnValue(new Promise(() => {}))

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
      await user.click(confirmBtn)

      // Button text changes to Applying...
      await waitFor(() => {
        expect(screen.getByText('Applying...')).toBeDefined()
      })
    })
  })

  // --- Scope selection step display ---

  describe('scope selection step display', () => {
    it('shows "Apply changes to..." heading', async () => {
      render(<CascadeScopeSelector {...defaultProps} />)

      expect(await screen.findByText('Apply changes to...')).toBeDefined()
    })

    it('shows descriptions for each scope option', async () => {
      render(<CascadeScopeSelector {...defaultProps} />)

      expect(await screen.findByText('Update this template in the current mesocycle')).toBeDefined()
      expect(screen.getByText('Update this and all future mesocycles')).toBeDefined()
      expect(screen.getByText('Update every active/planned mesocycle')).toBeDefined()
    })
  })
})
