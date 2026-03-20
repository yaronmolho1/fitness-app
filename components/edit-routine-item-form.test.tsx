// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/routines/actions', () => ({
  updateRoutineItem: vi.fn(),
}))

import { EditRoutineItemForm } from './edit-routine-item-form'

type RoutineItem = Parameters<typeof EditRoutineItemForm>[0]['item']

const baseItem: RoutineItem = {
  id: 1,
  name: 'Morning Stretch',
  category: 'mobility',
  has_weight: false,
  has_length: false,
  has_duration: true,
  has_sets: true,
  has_reps: false,
  frequency_target: 3,
  frequency_mode: 'weekly_target',
  frequency_days: null,
  scope: 'global',
  mesocycle_id: null,
  start_date: null,
  end_date: null,
  skip_on_deload: false,
}

describe('EditRoutineItemForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  function renderForm(overrides: {
    item?: Partial<RoutineItem>
    categories?: string[]
  } = {}) {
    const item = { ...baseItem, ...overrides.item }
    return render(
      <EditRoutineItemForm
        item={item}
        mesocycles={[]}
        categories={overrides.categories ?? ['mobility', 'tracking']}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
      />
    )
  }

  describe('frequency mode pre-fill', () => {
    it('pre-fills weekly_target mode with correct target value', () => {
      renderForm({ item: { frequency_mode: 'weekly_target', frequency_target: 5 } })

      const input = screen.getByLabelText(/times per week/i)
      expect(input).toHaveValue(5)
    })

    it('pre-fills daily mode', () => {
      renderForm({ item: { frequency_mode: 'daily' } })

      // Daily mode should not show number input or day picker
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })

    it('pre-fills specific_days mode with selected days', () => {
      renderForm({
        item: {
          frequency_mode: 'specific_days',
          frequency_days: [1, 3, 5], // Mon, Wed, Fri
        },
      })

      // Day pills should be visible
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-selected') !== null
      )
      expect(dayButtons).toHaveLength(7) // all 7 days shown

      // Mon (index 1), Wed (index 3), Fri (index 5) should be selected
      const selected = dayButtons.filter(
        (btn) => btn.getAttribute('data-selected') === 'true'
      )
      expect(selected).toHaveLength(3)
    })
  })

  describe('mode switching clears data', () => {
    it('switching from specific_days to weekly_target clears day selection', async () => {
      const user = userEvent.setup()
      renderForm({
        item: {
          frequency_mode: 'specific_days',
          frequency_days: [1, 3, 5],
        },
      })

      // Switch to weekly_target
      await user.click(screen.getByRole('button', { name: /per week/i }))

      // Day pills should be hidden
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('data-selected') !== null
      )
      expect(dayButtons).toHaveLength(0)

      // Number input should be visible
      expect(screen.getByLabelText(/times per week/i)).toBeInTheDocument()
    })

    it('switching from weekly_target to daily clears number input', async () => {
      const user = userEvent.setup()
      renderForm({
        item: { frequency_mode: 'weekly_target', frequency_target: 5 },
      })

      await user.click(screen.getByRole('button', { name: /daily/i }))

      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })
  })

  describe('category combobox pre-fill', () => {
    it('pre-fills category combobox with existing value', () => {
      renderForm({ item: { category: 'mobility' } })

      const combobox = screen.getByPlaceholderText('e.g. mobility, recovery')
      expect(combobox).toHaveAttribute('role', 'combobox')
      expect(combobox).toHaveValue('mobility')
    })

    it('shows existing categories as suggestions', async () => {
      const user = userEvent.setup()
      renderForm({ categories: ['mobility', 'recovery', 'tracking'] })

      const combobox = screen.getByPlaceholderText('e.g. mobility, recovery')
      await user.click(combobox)

      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  describe('form submission data', () => {
    it('sends frequency_mode and frequency_days on save', async () => {
      const user = userEvent.setup()
      const { updateRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(updateRoutineItem).mockResolvedValue({
        success: true,
        data: {
          ...baseItem,
          scope: 'global' as const,
          created_at: new Date(),
          frequency_mode: 'specific_days' as const,
          frequency_days: [1, 3, 5],
        },
      })

      renderForm({
        item: {
          frequency_mode: 'specific_days',
          frequency_days: [1, 3, 5],
        },
      })

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(updateRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'specific_days',
          frequency_days: [1, 3, 5],
        })
      )
    })

    it('sends frequency_mode=daily with frequency_target=7 on save', async () => {
      const user = userEvent.setup()
      const { updateRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(updateRoutineItem).mockResolvedValue({
        success: true,
        data: {
          ...baseItem,
          scope: 'global' as const,
          created_at: new Date(),
          frequency_mode: 'daily' as const,
          frequency_target: 7,
        },
      })

      renderForm({ item: { frequency_mode: 'daily' } })

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(updateRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'daily',
          frequency_target: 7,
        })
      )
    })
  })
})
