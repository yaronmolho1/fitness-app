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
    onModeChange: () => {},
    onWeeklyTargetChange: () => {},
    onSelectedDaysChange: () => {},
  }
  return render(<FrequencyModeSelector {...defaults} {...overrides} />)
}

describe('FrequencyModeSelector', () => {
  afterEach(() => cleanup())

  it('renders 3 mode options', () => {
    renderSelector()
    expect(screen.getByRole('button', { name: /daily/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /specific days/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /per week/i })).toBeInTheDocument()
  })

  describe('weekly_target mode', () => {
    it('shows number input for weekly target', () => {
      renderSelector({ mode: 'weekly_target' })
      expect(screen.getByLabelText(/times per week/i)).toBeInTheDocument()
    })

    it('does not show day pills', () => {
      renderSelector({ mode: 'weekly_target' })
      expect(screen.queryByRole('button', { name: 'S' })).not.toBeInTheDocument()
    })
  })

  describe('daily mode', () => {
    it('does not show day pills or number input', () => {
      renderSelector({ mode: 'daily' })
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
      // Day pills should not be shown
      expect(screen.queryByRole('button', { name: 'M' })).not.toBeInTheDocument()
    })
  })

  describe('specific_days mode', () => {
    it('shows 7 day pills', () => {
      renderSelector({ mode: 'specific_days', selectedDays: [0] })
      const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => dayLabels.includes(btn.textContent ?? '')
      )
      expect(dayButtons).toHaveLength(7)
    })

    it('pills have min 40px touch targets', () => {
      renderSelector({ mode: 'specific_days', selectedDays: [1] })
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => ['S', 'M', 'T', 'W', 'F'].includes(btn.textContent ?? '')
      )
      for (const btn of dayButtons) {
        expect(btn.className).toMatch(/min-w-\[40px\]|w-10|w-11|min-h-\[40px\]|h-10|h-11/)
      }
    })

    it('calls onSelectedDaysChange when toggling a day', async () => {
      const user = userEvent.setup()
      const onSelectedDaysChange = vi.fn()
      renderSelector({
        mode: 'specific_days',
        selectedDays: [1], // Monday
        onSelectedDaysChange,
      })

      // Click Wednesday (index 3)
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'W'
      )
      await user.click(dayButtons[0])
      expect(onSelectedDaysChange).toHaveBeenCalledWith([1, 3])
    })

    it('calls onSelectedDaysChange to deselect a day', async () => {
      const user = userEvent.setup()
      const onSelectedDaysChange = vi.fn()
      renderSelector({
        mode: 'specific_days',
        selectedDays: [1, 3],
        onSelectedDaysChange,
      })

      // Click Monday (index 1) to deselect
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'M'
      )
      await user.click(dayButtons[0])
      expect(onSelectedDaysChange).toHaveBeenCalledWith([3])
    })

    it('prevents deselecting the last day', async () => {
      const user = userEvent.setup()
      const onSelectedDaysChange = vi.fn()
      renderSelector({
        mode: 'specific_days',
        selectedDays: [1], // only Monday
        onSelectedDaysChange,
      })

      // Try to deselect Monday — the only selected day
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'M'
      )
      await user.click(dayButtons[0])
      expect(onSelectedDaysChange).not.toHaveBeenCalled()
    })

    it('does not show number input', () => {
      renderSelector({ mode: 'specific_days', selectedDays: [0] })
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })
  })

  describe('mode switching', () => {
    it('calls onModeChange when clicking a different mode', async () => {
      const user = userEvent.setup()
      const onModeChange = vi.fn()
      renderSelector({ mode: 'weekly_target', onModeChange })

      await user.click(screen.getByRole('button', { name: /daily/i }))
      expect(onModeChange).toHaveBeenCalledWith('daily')
    })

    it('calls onModeChange when switching to specific_days', async () => {
      const user = userEvent.setup()
      const onModeChange = vi.fn()
      renderSelector({ mode: 'daily', onModeChange })

      await user.click(screen.getByRole('button', { name: /specific days/i }))
      expect(onModeChange).toHaveBeenCalledWith('specific_days')
    })

    it('does not call onModeChange when clicking already-selected mode', async () => {
      const user = userEvent.setup()
      const onModeChange = vi.fn()
      renderSelector({ mode: 'weekly_target', onModeChange })

      await user.click(screen.getByRole('button', { name: /per week/i }))
      expect(onModeChange).not.toHaveBeenCalled()
    })
  })

  describe('selected day styling', () => {
    it('applies selected styling to active days', () => {
      renderSelector({ mode: 'specific_days', selectedDays: [1] }) // Monday
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'M'
      )
      // Selected day should have primary/filled styling
      expect(dayButtons[0].getAttribute('data-selected')).toBe('true')
    })

    it('applies unselected styling to inactive days', () => {
      renderSelector({ mode: 'specific_days', selectedDays: [1] }) // Monday only
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'T'
      )
      // Tuesday (first T) should not be selected
      expect(dayButtons[0].getAttribute('data-selected')).toBe('false')
    })
  })
})
