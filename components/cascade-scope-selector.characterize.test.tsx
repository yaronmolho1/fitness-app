// Characterization test — captures current behavior for safe refactoring
// Updated for T136: summary panel replaced with toast notifications
// @vitest-environment jsdom
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

  // --- Toast notification behavior (replaces summary panel) ---

  describe('toast notifications on cascade complete', () => {
    async function completeCascadeWith(
      scope: 'This only' | 'All phases',
      summaryData: { updated: number; skipped: number; skippedCompleted: number; skippedNoMatch: number },
    ) {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: summaryData,
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText(scope))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled()
      })
      return user
    }

    it('fires success toast with "Template updated" for this-only scope', async () => {
      await completeCascadeWith('This only', { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(toast.success).toHaveBeenCalledWith('Template updated')
    })

    it('fires success toast with count for multi-template cascade', async () => {
      await completeCascadeWith('All phases', { updated: 4, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(toast.success).toHaveBeenCalledWith('4 templates updated')
    })

    it('fires warning toast when skipped > 0', async () => {
      await completeCascadeWith('All phases', { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(toast.warning).toHaveBeenCalledWith('2 updated, 1 skipped — has logs')
    })

    it('does not show summary panel — no "Cascade complete" text', async () => {
      await completeCascadeWith('This only', { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(screen.queryByText('Cascade complete')).toBeNull()
    })

    it('does not render a Done button', async () => {
      await completeCascadeWith('This only', { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 })

      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    })

    it('calls onComplete immediately — no auto-dismiss timer', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      // onComplete fires synchronously after cascade resolves, no timer
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
      })
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
      vi.mocked(cascadeUpdateTemplates).mockReturnValue(new Promise(() => {}))

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
      await user.click(confirmBtn)

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

      expect(await screen.findByText('Applied to this template only')).toBeDefined()
      expect(screen.getByText('Also apply to future mesocycles')).toBeDefined()
      expect(screen.getByText('Apply across all active/planned mesocycles')).toBeDefined()
    })
  })
})
