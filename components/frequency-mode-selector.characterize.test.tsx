// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { FrequencyModeSelector } from './frequency-mode-selector'
import type { FrequencyMode } from './frequency-mode-selector'

function renderSelector(overrides: Partial<Parameters<typeof FrequencyModeSelector>[0]> = {}) {
  const defaults = {
    mode: 'weekly_target' as FrequencyMode,
    weeklyTarget: 3,
    selectedDays: [] as number[],
    onModeChange: vi.fn(),
    onWeeklyTargetChange: vi.fn(),
    onSelectedDaysChange: vi.fn(),
  }
  const props = { ...defaults, ...overrides }
  return { ...render(<FrequencyModeSelector {...props} />), props }
}

describe('FrequencyModeSelector number input — characterization', () => {
  afterEach(() => cleanup())

  describe('weekly target input attributes', () => {
    it('renders with type="text" and inputMode="numeric"', () => {
      renderSelector()
      const input = screen.getByLabelText(/times per week/i) as HTMLInputElement
      expect(input.type).toBe('text')
      expect(input.inputMode).toBe('numeric')
    })

    it('shows the weeklyTarget value', () => {
      renderSelector({ weeklyTarget: 5 })
      expect(screen.getByLabelText(/times per week/i)).toHaveValue('5')
    })
  })

  describe('weekly target onChange behavior', () => {
    it('calls onWeeklyTargetChange with 0 when cleared (empty string)', async () => {
      const user = userEvent.setup()
      const onWeeklyTargetChange = vi.fn()
      renderSelector({ weeklyTarget: 3, onWeeklyTargetChange })

      const input = screen.getByLabelText(/times per week/i)
      await user.clear(input)
      expect(onWeeklyTargetChange).toHaveBeenCalledWith(0)
    })

    it('calls onWeeklyTargetChange with parsed number when typing a digit', async () => {
      const user = userEvent.setup()
      const onWeeklyTargetChange = vi.fn()
      renderSelector({ weeklyTarget: 3, onWeeklyTargetChange })

      const input = screen.getByLabelText(/times per week/i)
      await user.clear(input)
      await user.type(input, '5')
      expect(onWeeklyTargetChange).toHaveBeenLastCalledWith(5)
    })
  })

  describe('input is not shown in other modes', () => {
    it('no number input in daily mode', () => {
      renderSelector({ mode: 'daily' })
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })

    it('no number input in specific_days mode', () => {
      renderSelector({ mode: 'specific_days', selectedDays: [1] })
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })
  })
})
