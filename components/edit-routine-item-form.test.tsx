// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/routines/actions', () => ({
  updateRoutineItem: vi.fn(),
}))

import { EditRoutineItemForm } from './edit-routine-item-form'

const makeItem = (overrides = {}) => ({
  id: 1,
  name: 'Morning Stretch',
  category: 'mobility',
  has_weight: false,
  has_length: false,
  has_duration: true,
  has_sets: true,
  has_reps: false,
  frequency_target: 3,
  frequency_mode: 'weekly_target' as const,
  frequency_days: null as number[] | null,
  scope: 'global',
  mesocycle_id: null,
  start_date: null,
  end_date: null,
  skip_on_deload: false,
  ...overrides,
})

const defaultProps = {
  item: makeItem(),
  mesocycles: [],
  categories: ['mobility', 'recovery', 'strength'],
  onCancel: vi.fn(),
  onSaved: vi.fn(),
}

describe('EditRoutineItemForm', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => cleanup())

  describe('FrequencyModeSelector pre-fill', () => {
    it('pre-fills weekly_target mode with existing frequency_target', () => {
      render(<EditRoutineItemForm {...defaultProps} item={makeItem({ frequency_mode: 'weekly_target', frequency_target: 5 })} />)
      expect(screen.getByLabelText(/times per week/i)).toHaveValue(5)
    })

    it('pre-fills daily mode', () => {
      render(<EditRoutineItemForm {...defaultProps} item={makeItem({ frequency_mode: 'daily' })} />)
      // No weekly target or day pills visible
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })

    it('pre-fills specific_days mode with existing frequency_days', () => {
      render(<EditRoutineItemForm {...defaultProps} item={makeItem({
        frequency_mode: 'specific_days',
        frequency_days: [1, 3, 5], // Mon, Wed, Fri
      })} />)

      // Day pills should be visible
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'].includes(btn.textContent ?? '')
      )
      expect(dayButtons.length).toBe(7)

      // Monday (index 1) should be selected
      const mondayBtns = screen.getAllByRole('button').filter(btn => btn.textContent === 'M')
      expect(mondayBtns[0].getAttribute('data-selected')).toBe('true')
    })

    it('does not render old frequency target input', () => {
      render(<EditRoutineItemForm {...defaultProps} />)
      expect(screen.queryByLabelText(/frequency target \(per week\)/i)).not.toBeInTheDocument()
    })
  })

  describe('Category combobox pre-fill', () => {
    it('pre-fills category in combobox', () => {
      render(<EditRoutineItemForm {...defaultProps} item={makeItem({ category: 'recovery' })} />)
      const combobox = screen.getByRole('combobox', { name: /category/i })
      expect(combobox).toHaveValue('recovery')
    })

    it('renders combobox with empty value when category is null', () => {
      render(<EditRoutineItemForm {...defaultProps} item={makeItem({ category: null })} />)
      const combobox = screen.getByRole('combobox', { name: /category/i })
      expect(combobox).toHaveValue('')
    })
  })

  describe('mode switching clears data', () => {
    it('switching from specific_days to weekly_target shows number input', async () => {
      const user = userEvent.setup()
      render(<EditRoutineItemForm {...defaultProps} item={makeItem({
        frequency_mode: 'specific_days',
        frequency_days: [1, 3],
      })} />)

      // Switch to weekly_target
      await user.click(screen.getByRole('button', { name: /per week/i }))

      // Should show number input
      expect(screen.getByLabelText(/times per week/i)).toBeInTheDocument()
      // Day pills should be gone
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.textContent === 'M' || btn.textContent === 'W'
      )
      // Only mode buttons remain (not day pills)
      expect(dayButtons.length).toBeLessThanOrEqual(0)
    })

    it('switching from weekly_target to daily hides number input', async () => {
      const user = userEvent.setup()
      render(<EditRoutineItemForm {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /daily/i }))

      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })
  })

  describe('submission with frequency data', () => {
    it('submits with frequency_mode and frequency_days for specific_days', async () => {
      const user = userEvent.setup()
      const { updateRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(updateRoutineItem).mockResolvedValue({
        success: true,
        data: makeItem() as typeof updateRoutineItem extends (...args: unknown[]) => Promise<infer R> ? R extends { data: infer D } ? D : never : never,
      })

      render(<EditRoutineItemForm {...defaultProps} item={makeItem({
        frequency_mode: 'specific_days',
        frequency_days: [1, 3],
      })} />)

      await user.click(screen.getByRole('button', { name: /^save$/i }))

      expect(updateRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'specific_days',
          frequency_days: [1, 3],
        })
      )
    })

    it('submits with frequency_mode=daily', async () => {
      const user = userEvent.setup()
      const { updateRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(updateRoutineItem).mockResolvedValue({
        success: true,
        data: makeItem() as typeof updateRoutineItem extends (...args: unknown[]) => Promise<infer R> ? R extends { data: infer D } ? D : never : never,
      })

      render(<EditRoutineItemForm {...defaultProps} item={makeItem({ frequency_mode: 'daily' })} />)

      await user.click(screen.getByRole('button', { name: /^save$/i }))

      expect(updateRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'daily',
        })
      )
    })
  })
})
