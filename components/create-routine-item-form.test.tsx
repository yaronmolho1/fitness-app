// @vitest-environment jsdom
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/routines/actions', () => ({
  createRoutineItem: vi.fn(),
}))

import { CreateRoutineItemForm } from './create-routine-item-form'

describe('CreateRoutineItemForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  function renderForm(props: Partial<Parameters<typeof CreateRoutineItemForm>[0]> = {}) {
    const defaults = {
      mesocycles: [],
      categories: [],
      onCancel: vi.fn(),
      onCreated: vi.fn(),
    }
    return render(<CreateRoutineItemForm {...defaults} {...props} />)
  }

  describe('frequency mode selector integration', () => {
    it('shows FrequencyModeSelector with 3 mode options', () => {
      renderForm()
      expect(screen.getByRole('button', { name: /daily/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /specific days/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /per week/i })).toBeInTheDocument()
    })

    it('defaults to weekly_target mode with value 3', () => {
      renderForm()
      // Weekly target input should be visible with value 3
      const input = screen.getByLabelText(/times per week/i)
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue(3)
    })

    it('daily mode hides number input and day picker', async () => {
      const user = userEvent.setup()
      renderForm()

      await user.click(screen.getByRole('button', { name: /daily/i }))

      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
      // No day pills
      expect(screen.queryByRole('button', { name: 'M' })).not.toBeInTheDocument()
    })

    it('specific days mode shows day picker', async () => {
      const user = userEvent.setup()
      renderForm()

      await user.click(screen.getByRole('button', { name: /specific days/i }))

      // Day pills should be visible (7 day buttons)
      const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => dayLabels.includes(btn.textContent ?? '') && btn.getAttribute('data-selected') !== null
      )
      expect(dayButtons).toHaveLength(7)
    })

    it('switching modes clears previous mode data', async () => {
      const user = userEvent.setup()
      renderForm()

      // Switch to specific_days, select some days
      await user.click(screen.getByRole('button', { name: /specific days/i }))
      // Now switch to weekly_target
      await user.click(screen.getByRole('button', { name: /per week/i }))

      // Should show number input again
      expect(screen.getByLabelText(/times per week/i)).toBeInTheDocument()
      // Day pills should be hidden
      expect(screen.queryByRole('button', { name: 'M' })).not.toBeInTheDocument()
    })
  })

  describe('category combobox integration', () => {
    it('shows category combobox instead of plain text input', () => {
      renderForm({ categories: ['mobility', 'tracking'] })
      // Category input should use combobox role (AutoSuggestCombobox)
      const combobox = screen.getByPlaceholderText('e.g. mobility, recovery')
      expect(combobox).toHaveAttribute('role', 'combobox')
    })

    it('category combobox shows existing categories as suggestions', async () => {
      const user = userEvent.setup()
      renderForm({ categories: ['mobility', 'recovery', 'tracking'] })

      const combobox = screen.getByPlaceholderText('e.g. mobility, recovery')
      await user.click(combobox)

      // Should show suggestions
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /mobility/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /recovery/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /tracking/i })).toBeInTheDocument()
    })

    it('category combobox allows typing new values', async () => {
      const user = userEvent.setup()
      renderForm({ categories: ['mobility'] })

      const combobox = screen.getByPlaceholderText('e.g. mobility, recovery')
      await user.clear(combobox)
      await user.type(combobox, 'wellness')

      expect(combobox).toHaveValue('wellness')
    })
  })

  describe('form validation', () => {
    it('specific_days requires at least 1 day selected for submission', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {
          id: 1, name: 'Test Routine', category: null,
          has_weight: false, has_length: false, has_duration: true,
          has_sets: false, has_reps: false,
          frequency_target: 3, frequency_mode: 'specific_days', frequency_days: [1],
          scope: 'global', mesocycle_id: null, start_date: null, end_date: null,
          skip_on_deload: false, created_at: new Date(),
        },
      })

      renderForm()

      // Fill in name
      await user.type(screen.getByLabelText(/name/i), 'Test Routine')
      // Select an input field
      await user.click(screen.getByText('Duration (min)'))

      // Switch to specific_days mode — default has Monday pre-selected so valid
      await user.click(screen.getByRole('button', { name: /specific days/i }))

      // Submit (should work since at least 1 day is pre-selected)
      await user.click(screen.getByRole('button', { name: /create/i }))

      // The SA should have been called (form validation passed)
      expect(createRoutineItem).toHaveBeenCalled()
    })
  })

  describe('form submission data', () => {
    it('sends frequency_mode=weekly_target and frequency_target for weekly mode', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {
          id: 1, name: 'Test', category: null,
          has_weight: false, has_length: false, has_duration: true,
          has_sets: false, has_reps: false,
          frequency_target: 3, frequency_mode: 'weekly_target', frequency_days: null,
          scope: 'global', mesocycle_id: null, start_date: null, end_date: null,
          skip_on_deload: false, created_at: new Date(),
        },
      })

      renderForm()

      await user.type(screen.getByLabelText(/name/i), 'Test Routine')
      await user.click(screen.getByText('Duration (min)'))
      await user.click(screen.getByRole('button', { name: /create/i }))

      expect(createRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'weekly_target',
          frequency_target: 3,
          frequency_days: undefined,
        })
      )
    })

    it('sends frequency_mode=daily for daily mode', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {
          id: 1, name: 'Test', category: null,
          has_weight: false, has_length: false, has_duration: true,
          has_sets: false, has_reps: false,
          frequency_target: 7, frequency_mode: 'daily', frequency_days: null,
          scope: 'global', mesocycle_id: null, start_date: null, end_date: null,
          skip_on_deload: false, created_at: new Date(),
        },
      })

      renderForm()

      await user.type(screen.getByLabelText(/name/i), 'Daily Item')
      await user.click(screen.getByText('Duration (min)'))
      await user.click(screen.getByRole('button', { name: /daily/i }))
      await user.click(screen.getByRole('button', { name: /create/i }))

      expect(createRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'daily',
          frequency_target: 7,
        })
      )
    })

    it('sends frequency_mode=specific_days with frequency_days array', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {
          id: 1, name: 'Test', category: null,
          has_weight: false, has_length: false, has_duration: true,
          has_sets: false, has_reps: false,
          frequency_target: 3, frequency_mode: 'specific_days', frequency_days: [1],
          scope: 'global', mesocycle_id: null, start_date: null, end_date: null,
          skip_on_deload: false, created_at: new Date(),
        },
      })

      renderForm()

      await user.type(screen.getByLabelText(/name/i), 'Specific Days Item')
      await user.click(screen.getByText('Duration (min)'))
      await user.click(screen.getByRole('button', { name: /specific days/i }))

      await user.click(screen.getByRole('button', { name: /create/i }))

      expect(createRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'specific_days',
          frequency_days: expect.any(Array),
        })
      )
    })
  })
})
