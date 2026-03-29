// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

import { MoveWorkoutModal } from './move-workout-modal'
import type { MoveWorkoutModalProps } from './move-workout-modal'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PERIODS = ['morning', 'afternoon', 'evening'] as const

function makeProps(overrides: Partial<MoveWorkoutModalProps> = {}): MoveWorkoutModalProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    mesocycleId: 1,
    weekNumber: 2,
    sourceDay: 0,
    sourcePeriod: 'morning',
    sourceTimeSlot: '07:00',
    sourceDuration: 90,
    sourceTemplateName: 'Push A',
    occupiedSlots: [],
    onConfirm: vi.fn(),
    ...overrides,
  }
}

describe('MoveWorkoutModal', () => {
  afterEach(cleanup)

  describe('day picker', () => {
    it('renders 7 day buttons (Mon-Sun)', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      for (const label of DAY_LABELS) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      }
    })

    it('disables the source day button', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceDay: 0 })} />)
      expect(screen.getByRole('button', { name: 'Mon' })).toBeDisabled()
    })

    it('does not disable other day buttons', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceDay: 0 })} />)
      expect(screen.getByRole('button', { name: 'Tue' })).not.toBeDisabled()
    })
  })

  describe('period selector', () => {
    it('renders 3 period options', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      // Select a target day first
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      for (const period of PERIODS) {
        expect(screen.getByRole('radio', { name: new RegExp(period, 'i') })).toBeInTheDocument()
      }
    })

    it('shows occupied indicator for occupied periods', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [{ day: 1, period: 'morning', templateName: 'Pull A' }],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      // The morning radio should have an occupied indicator
      const morningRadio = screen.getByRole('radio', { name: /morning/i })
      const container = morningRadio.closest('label') || morningRadio.parentElement!
      expect(container.textContent).toMatch(/occupied|Pull A/i)
    })
  })

  describe('time slot input', () => {
    it('pre-fills time_slot from source', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceTimeSlot: '07:00' })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      const input = screen.getByLabelText(/time/i)
      expect(input).toHaveValue('07:00')
    })
  })

  describe('scope radio', () => {
    it('renders two scope options', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByRole('radio', { name: /this week only/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /remaining/i })).toBeInTheDocument()
    })

    it('defaults to "This week only"', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByRole('radio', { name: /this week only/i })).toBeChecked()
    })
  })

  describe('warning for occupied target', () => {
    it('shows warning when target period has existing workout', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [{ day: 2, period: 'evening', templateName: 'Legs' }],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      await user.click(screen.getByRole('radio', { name: /evening/i }))
      expect(screen.getByText(/already has a workout/i)).toBeInTheDocument()
    })

    it('does not show warning when target period is free', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [{ day: 2, period: 'evening', templateName: 'Legs' }],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      // Morning is free
      expect(screen.queryByText(/already has a workout/i)).not.toBeInTheDocument()
    })
  })

  describe('confirm action', () => {
    it('calls onConfirm with correct params', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      await user.click(screen.getByRole('radio', { name: /evening/i }))
      await user.click(screen.getByRole('button', { name: /confirm|move/i }))
      expect(onConfirm).toHaveBeenCalledWith({
        targetDay: 2,
        targetTimeSlot: '07:00',
        targetDuration: 90,
        scope: 'this_week',
        targetWeekOffset: 0,
      })
    })

    it('sends updated time_slot value', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      const input = screen.getByLabelText(/time/i)
      await user.clear(input)
      await user.type(input, '18:00')
      await user.click(screen.getByRole('button', { name: /confirm|move/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetTimeSlot: '18:00' })
      )
    })

    it('sends remaining_weeks scope when selected', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      await user.click(screen.getByRole('radio', { name: /remaining/i }))
      await user.click(screen.getByRole('button', { name: /confirm|move/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'remaining_weeks' })
      )
    })

    it('confirm button disabled until target day selected', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByRole('button', { name: /confirm|move/i })).toBeDisabled()
    })
  })

  describe('AC14: fully occupied day', () => {
    it('disables day button when all 3 periods are occupied', () => {
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [
              { day: 3, period: 'morning', templateName: 'A' },
              { day: 3, period: 'afternoon', templateName: 'B' },
              { day: 3, period: 'evening', templateName: 'C' },
            ],
          })}
        />
      )
      expect(screen.getByRole('button', { name: 'Thu' })).toBeDisabled()
    })

    it('does not disable day with only 1-2 periods occupied', () => {
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [
              { day: 3, period: 'morning', templateName: 'A' },
              { day: 3, period: 'afternoon', templateName: 'B' },
            ],
          })}
        />
      )
      expect(screen.getByRole('button', { name: 'Thu' })).not.toBeDisabled()
    })
  })

  describe('dialog title', () => {
    it('shows source template name in title', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceTemplateName: 'Push A' })} />)
      expect(screen.getByText(/move.*push a/i)).toBeInTheDocument()
    })
  })
})
