// @vitest-environment jsdom
// T136: Toast notification tests for CascadeScopeSelector
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

describe('CascadeScopeSelector — toast notifications (T136)', () => {
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
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 3, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('does not show summary panel after cascade success', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalled()
      })

      // Summary panel elements should NOT exist
      expect(screen.queryByText('Cascade complete')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    })
  })

  // AC4: success toast with zero skips shows "N templates updated"
  describe('AC4: success toast format', () => {
    it('shows "3 templates updated" when no skips', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 3, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('3 templates updated')
      })
    })

    it('shows "1 template updated" (singular) for single update', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('1 template updated')
      })
    })
  })

  // AC5: warning toast with skips shows "N updated, M skipped — has logs"
  describe('AC5: warning toast with skips', () => {
    it('shows warning toast with skip count', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('All phases'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('2 updated, 1 skipped — has logs')
      })
    })
  })

  // AC6: "This only" scope shows "Template updated"
  describe('AC6: this-only simplified message', () => {
    it('shows "Template updated" for this-only scope', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Template updated')
      })
    })
  })

  // AC7: row returns to display mode immediately (no summary step)
  describe('AC7: no summary step', () => {
    it('calls onComplete immediately without showing summary', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: true,
        data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      // onComplete called immediately — no intermediate summary step
      await waitFor(() => {
        expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
      })
    })
  })

  // Edge case: error toast on failure, selector stays open
  describe('error handling', () => {
    it('shows error toast on cascade failure, selector stays open', async () => {
      vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
        success: false,
        error: 'Something went wrong',
      })

      const user = userEvent.setup()
      render(<CascadeScopeSelector {...defaultProps} />)

      await user.click(await screen.findByText('This only'))
      await user.click(await screen.findByRole('button', { name: /confirm/i }))

      // Error displayed inline — selector stays open
      expect(await screen.findByText('Something went wrong')).toBeDefined()
      expect(defaultProps.onComplete).not.toHaveBeenCalled()
    })
  })
})
