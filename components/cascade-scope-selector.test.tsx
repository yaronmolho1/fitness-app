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

const defaultProps = {
  templateId: 1,
  updates: { name: 'Push B' },
  onComplete: vi.fn(),
  onCancel: vi.fn(),
}

describe('CascadeScopeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders three scope options', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 3,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
          { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
          { id: 3, mesocycleId: 3, mesocycleName: 'Phase 3', hasLoggedWorkouts: false },
        ],
      },
    })

    render(<CascadeScopeSelector {...defaultProps} />)

    expect(await screen.findByText('This only')).toBeDefined()
    expect(screen.getByText('This + future')).toBeDefined()
    expect(screen.getByText('All phases')).toBeDefined()
  })

  it('shows cancel button that calls onCancel', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 1,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
        ],
      },
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const cancelBtn = await screen.findByRole('button', { name: /cancel/i })
    await user.click(cancelBtn)

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls cascadeUpdateTemplates with this-only scope and shows summary', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 1,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
        ],
      },
    })
    vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
      success: true,
      data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const thisOnlyBtn = await screen.findByText('This only')
    await user.click(thisOnlyBtn)

    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(cascadeUpdateTemplates).toHaveBeenCalledWith({
        templateId: 1,
        scope: 'this-only',
        updates: { name: 'Push B' },
      })
    })

    // Summary shown
    expect(await screen.findByText(/1 updated/i)).toBeDefined()
  })

  it('calls cascadeUpdateTemplates with all-phases scope', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 3,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
          { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
          { id: 3, mesocycleId: 3, mesocycleName: 'Phase 3', hasLoggedWorkouts: false },
        ],
      },
    })
    vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
      success: true,
      data: { updated: 3, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const allPhasesBtn = await screen.findByText('All phases')
    await user.click(allPhasesBtn)

    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(cascadeUpdateTemplates).toHaveBeenCalledWith({
        templateId: 1,
        scope: 'all-phases',
        updates: { name: 'Push B' },
      })
    })
  })

  it('shows skipped count in summary when templates have logged workouts', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 3,
        skippedCount: 1,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
          { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: true },
          { id: 3, mesocycleId: 3, mesocycleName: 'Phase 3', hasLoggedWorkouts: false },
        ],
      },
    })
    vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
      success: true,
      data: { updated: 2, skipped: 1, skippedCompleted: 0, skippedNoMatch: 0 },
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const allPhasesBtn = await screen.findByText('All phases')
    await user.click(allPhasesBtn)

    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText(/2 updated/i)).toBeDefined()
    })
    expect(screen.getByText(/1 skipped/i)).toBeDefined()
  })

  it('shows error message when cascade fails', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 1,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
        ],
      },
    })
    vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
      success: false,
      error: 'Something went wrong',
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const thisOnlyBtn = await screen.findByText('This only')
    await user.click(thisOnlyBtn)

    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    expect(await screen.findByText('Something went wrong')).toBeDefined()
  })

  it('calls onComplete after dismissing summary', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 1,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
        ],
      },
    })
    vi.mocked(cascadeUpdateTemplates).mockResolvedValue({
      success: true,
      data: { updated: 1, skipped: 0, skippedCompleted: 0, skippedNoMatch: 0 },
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const thisOnlyBtn = await screen.findByText('This only')
    await user.click(thisOnlyBtn)

    const confirmBtn = await screen.findByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    const doneBtn = await screen.findByRole('button', { name: /done/i })
    await user.click(doneBtn)

    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
  })

  it('shows preview of affected templates when a scope is selected', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 2,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
          { id: 2, mesocycleId: 2, mesocycleName: 'Phase 2', hasLoggedWorkouts: false },
        ],
      },
    })

    const user = userEvent.setup()
    render(<CascadeScopeSelector {...defaultProps} />)

    const allPhasesBtn = await screen.findByText('All phases')
    await user.click(allPhasesBtn)

    // Preview shows affected mesocycle names
    expect(await screen.findByText(/Phase 1/)).toBeDefined()
    expect(screen.getByText(/Phase 2/)).toBeDefined()
  })

  // --- Auto-dismiss tests ---

  describe('auto-dismiss', () => {
    const DISMISS_MS = 2000

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(getCascadePreview).mockResolvedValue({
        success: true,
        data: {
          totalTargets: 1,
          skippedCount: 0,
          targets: [
            { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
          ],
        },
      })
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

    it('auto-dismisses summary after 2 seconds', async () => {
      await reachSummary()

      expect(defaultProps.onComplete).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(DISMISS_MS)

      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('dismisses immediately on Done click and cancels timer', async () => {
      const user = await reachSummary()

      await user.click(screen.getByRole('button', { name: /done/i }))
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(DISMISS_MS)
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1)
    })

    it('cleans up timeout on unmount', async () => {
      await reachSummary()

      cleanup()

      await vi.advanceTimersByTimeAsync(DISMISS_MS)
      expect(defaultProps.onComplete).not.toHaveBeenCalled()
    })
  })

  it('fetches previews for all three scopes on mount', async () => {
    vi.mocked(getCascadePreview).mockResolvedValue({
      success: true,
      data: {
        totalTargets: 1,
        skippedCount: 0,
        targets: [
          { id: 1, mesocycleId: 1, mesocycleName: 'Phase 1', hasLoggedWorkouts: false },
        ],
      },
    })

    render(<CascadeScopeSelector {...defaultProps} />)

    await waitFor(() => {
      expect(getCascadePreview).toHaveBeenCalledWith(1, 'all-phases')
    })
  })
})
