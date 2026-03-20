// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/routines/actions', () => ({
  createRoutineItem: vi.fn(),
}))

import { CreateRoutineItemForm } from './create-routine-item-form'

const defaultProps = {
  mesocycles: [],
  categories: ['mobility', 'recovery', 'strength'],
  onCancel: vi.fn(),
  onCreated: vi.fn(),
}

describe('CreateRoutineItemForm', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => cleanup())

  describe('FrequencyModeSelector integration', () => {
    it('renders frequency mode selector with 3 mode options', () => {
      render(<CreateRoutineItemForm {...defaultProps} />)
      expect(screen.getByRole('button', { name: /daily/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /specific days/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /per week/i })).toBeInTheDocument()
    })

    it('defaults to weekly_target mode with value 3', () => {
      render(<CreateRoutineItemForm {...defaultProps} />)
      expect(screen.getByLabelText(/times per week/i)).toHaveValue(3)
    })

    it('shows day pills when specific_days mode is selected', async () => {
      const user = userEvent.setup()
      render(<CreateRoutineItemForm {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /specific days/i }))

      // Day pills should be visible
      const dayButtons = screen.getAllByRole('button').filter(
        (btn) => ['S', 'M', 'T', 'W', 'F'].includes(btn.textContent ?? '')
      )
      expect(dayButtons.length).toBeGreaterThanOrEqual(5)
    })

    it('hides weekly target input when switching to daily mode', async () => {
      const user = userEvent.setup()
      render(<CreateRoutineItemForm {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /daily/i }))
      expect(screen.queryByLabelText(/times per week/i)).not.toBeInTheDocument()
    })

    it('does not render old frequency target input', () => {
      render(<CreateRoutineItemForm {...defaultProps} />)
      // The old label should be gone
      expect(screen.queryByLabelText(/frequency target \(per week\)/i)).not.toBeInTheDocument()
    })
  })

  describe('Category combobox integration', () => {
    it('renders category combobox with role="combobox"', () => {
      render(<CreateRoutineItemForm {...defaultProps} />)
      expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument()
    })

    it('shows existing categories as suggestions', async () => {
      const user = userEvent.setup()
      render(<CreateRoutineItemForm {...defaultProps} />)

      const combobox = screen.getByRole('combobox', { name: /category/i })
      await user.click(combobox)

      expect(screen.getByText('mobility')).toBeInTheDocument()
      expect(screen.getByText('recovery')).toBeInTheDocument()
      expect(screen.getByText('strength')).toBeInTheDocument()
    })

    it('allows typing a new category value', async () => {
      const user = userEvent.setup()
      render(<CreateRoutineItemForm {...defaultProps} />)

      const combobox = screen.getByRole('combobox', { name: /category/i })
      await user.clear(combobox)
      await user.type(combobox, 'flexibility')

      expect(combobox).toHaveValue('flexibility')
    })
  })

  describe('validation per mode', () => {
    it('submits with frequency_mode=daily', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {} as ReturnType<typeof createRoutineItem> extends Promise<infer R> ? R extends { data: infer D } ? D : never : never,
      })

      render(<CreateRoutineItemForm {...defaultProps} />)

      // Fill name
      await user.type(screen.getByLabelText(/name/i), 'Test Routine')
      // Select duration input field
      await user.click(screen.getByText('Duration (min)'))
      // Switch to daily mode
      await user.click(screen.getByRole('button', { name: /daily/i }))

      await user.click(screen.getByRole('button', { name: /^create$/i }))

      expect(createRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'daily',
        })
      )
    })

    it('submits with frequency_mode=specific_days and selected days', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {} as ReturnType<typeof createRoutineItem> extends Promise<infer R> ? R extends { data: infer D } ? D : never : never,
      })

      render(<CreateRoutineItemForm {...defaultProps} />)

      await user.type(screen.getByLabelText(/name/i), 'Test Routine')
      await user.click(screen.getByText('Duration (min)'))
      // Switch to specific_days
      await user.click(screen.getByRole('button', { name: /specific days/i }))

      // Select Monday (M) — one should already be selected by default
      // Select Wednesday (W)
      const wButtons = screen.getAllByRole('button').filter(btn => btn.textContent === 'W')
      await user.click(wButtons[0])

      await user.click(screen.getByRole('button', { name: /^create$/i }))

      expect(createRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'specific_days',
          frequency_days: expect.arrayContaining([expect.any(Number)]),
        })
      )
    })

    it('submits with frequency_mode=weekly_target and target value', async () => {
      const user = userEvent.setup()
      const { createRoutineItem } = await import('@/lib/routines/actions')
      vi.mocked(createRoutineItem).mockResolvedValue({
        success: true,
        data: {} as ReturnType<typeof createRoutineItem> extends Promise<infer R> ? R extends { data: infer D } ? D : never : never,
      })

      render(<CreateRoutineItemForm {...defaultProps} />)

      await user.type(screen.getByLabelText(/name/i), 'Test Routine')
      await user.click(screen.getByText('Duration (min)'))

      await user.click(screen.getByRole('button', { name: /^create$/i }))

      expect(createRoutineItem).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency_mode: 'weekly_target',
          frequency_target: 3,
        })
      )
    })
  })
})
