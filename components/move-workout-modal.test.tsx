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

function makeProps(overrides: Partial<MoveWorkoutModalProps> = {}): MoveWorkoutModalProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    mesocycleId: 1,
    weekNumber: 2,
    sourceDay: 0,
    sourceTimeSlot: '07:00',
    sourceDuration: 90,
    sourceTemplateName: 'Push A',
    occupiedSlots: [],
    onConfirm: vi.fn(),
    ...overrides,
  }
}

describe('MoveWorkoutModal (time-first)', () => {
  afterEach(cleanup)

  // -- Day picker --

  describe('day picker', () => {
    it('renders 7 day buttons (Mon-Sun)', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      for (const label of DAY_LABELS) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      }
    })

    it('disables the source day button at week offset 0', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceDay: 0 })} />)
      expect(screen.getByRole('button', { name: 'Mon' })).toBeDisabled()
    })

    it('does not disable other day buttons', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceDay: 0 })} />)
      expect(screen.getByRole('button', { name: 'Tue' })).not.toBeDisabled()
    })

    it('AC11: does NOT disable days regardless of how many workouts exist', () => {
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [
              { day: 3, timeSlot: '07:00', duration: 60, templateName: 'A' },
              { day: 3, timeSlot: '10:00', duration: 60, templateName: 'B' },
              { day: 3, timeSlot: '14:00', duration: 60, templateName: 'C' },
              { day: 3, timeSlot: '18:00', duration: 60, templateName: 'D' },
            ],
          })}
        />
      )
      // Thu should NOT be disabled — no "periods full" restriction
      expect(screen.getByRole('button', { name: 'Thu' })).not.toBeDisabled()
    })
  })

  // -- No period selector --

  describe('no period selector', () => {
    it('does NOT render period radio buttons', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.queryByRole('radio', { name: /morning/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /afternoon/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /evening/i })).not.toBeInTheDocument()
    })
  })

  // -- Time input --

  describe('time input (AC2-3)', () => {
    it('shows time input after day selection, pre-filled from source', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceTimeSlot: '14:30' })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByLabelText(/time/i)).toHaveValue('14:30')
    })

    it('falls back to 07:00 when sourceTimeSlot is null', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceTimeSlot: null })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByLabelText(/time/i)).toHaveValue('07:00')
    })

    it('not shown until day is selected', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.queryByLabelText(/time/i)).not.toBeInTheDocument()
    })
  })

  // -- Duration input (AC2, AC4) --

  describe('duration input (AC4)', () => {
    it('shows duration input after day selection, pre-filled from source', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceDuration: 45 })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      const durationInput = screen.getByLabelText(/duration/i)
      expect(durationInput).toHaveValue(45)
    })

    it('falls back to 60 min when sourceDuration is null', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceDuration: null })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByLabelText(/duration/i)).toHaveValue(60)
    })

    it('not shown until day is selected', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.queryByLabelText(/duration/i)).not.toBeInTheDocument()
    })
  })

  // -- Overlap warning (AC8) --

  describe('overlap warning (AC8)', () => {
    it('shows warning when target time overlaps existing workout', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            sourceTimeSlot: '09:00',
            sourceDuration: 60,
            occupiedSlots: [
              { day: 1, timeSlot: '09:30', duration: 60, templateName: 'Pull A' },
            ],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      // 09:00-10:00 overlaps 09:30-10:30
      expect(screen.getByText(/overlap/i)).toBeInTheDocument()
    })

    it('no warning when times do not overlap', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            sourceTimeSlot: '07:00',
            sourceDuration: 60,
            occupiedSlots: [
              { day: 1, timeSlot: '14:00', duration: 60, templateName: 'Pull A' },
            ],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.queryByText(/overlap/i)).not.toBeInTheDocument()
    })

    it('warning is non-blocking — move button stays enabled', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            sourceTimeSlot: '09:00',
            sourceDuration: 60,
            occupiedSlots: [
              { day: 1, timeSlot: '09:00', duration: 60, templateName: 'Pull A' },
            ],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByText(/overlap/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /move workout/i })).not.toBeDisabled()
    })
  })

  // -- Confirm action (AC5-6) --

  describe('confirm action', () => {
    it('calls onConfirm with time_slot and duration', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith({
        targetDay: 2,
        targetTimeSlot: '07:00',
        targetDuration: 90,
        scope: 'this_week',
        targetWeekOffset: 0,
      })
    })

    it('sends updated time and duration', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))

      const timeInput = screen.getByLabelText(/time/i)
      await user.clear(timeInput)
      await user.type(timeInput, '18:00')

      const durationInput = screen.getByLabelText(/duration/i)
      await user.clear(durationInput)
      await user.type(durationInput, '45')

      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetTimeSlot: '18:00', targetDuration: 45 })
      )
    })

    it('confirm button disabled until target day selected', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByRole('button', { name: /move workout/i })).toBeDisabled()
    })

    it('sends remaining_weeks scope when selected', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      await user.click(screen.getByRole('radio', { name: /remaining/i }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'remaining_weeks' })
      )
    })
  })

  // -- Scope radio --

  describe('scope radio', () => {
    it('renders two scope options after day selection', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByRole('radio', { name: /this week only/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /remaining/i })).toBeInTheDocument()
    })

    it('defaults to this_week scope', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByRole('radio', { name: /this week only/i })).toBeChecked()
    })
  })

  // -- Week offset toggle --

  describe('week offset toggle', () => {
    it('renders three week offset buttons', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByRole('button', { name: /prev week/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /this week/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /next week/i })).toBeInTheDocument()
    })

    it('source day is not disabled at non-zero offset', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceDay: 0 })} />)
      expect(screen.getByRole('button', { name: 'Mon' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: /next week/i }))
      expect(screen.getByRole('button', { name: 'Mon' })).not.toBeDisabled()
    })

    it('sends week offset in onConfirm', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: /next week/i }))
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetWeekOffset: 1 })
      )
    })
  })

  // -- Dialog --

  describe('dialog', () => {
    it('does not render content when open=false', () => {
      render(<MoveWorkoutModal {...makeProps({ open: false })} />)
      expect(screen.queryByText(/move.*push a/i)).not.toBeInTheDocument()
    })

    it('shows source template name in title', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceTemplateName: 'Legs B' })} />)
      expect(screen.getByText(/move.*legs b/i)).toBeInTheDocument()
    })
  })
})
