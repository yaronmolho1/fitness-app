// Characterization tests for move-workout-modal — updated for T202 time-first model
// Period-based tests replaced with time-based equivalents
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
import type { MoveWorkoutModalProps, OccupiedSlot } from './move-workout-modal'

function makeProps(overrides: Partial<MoveWorkoutModalProps> = {}): MoveWorkoutModalProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    mesocycleId: 1,
    weekNumber: 2,
    sourceDay: 0, // Monday (internal)
    sourceTimeSlot: '07:00',
    sourceDuration: 90,
    sourceTemplateName: 'Push A',
    occupiedSlots: [],
    onConfirm: vi.fn(),
    ...overrides,
  }
}

describe('MoveWorkoutModal — characterization (post-T202)', () => {
  afterEach(cleanup)

  // -- Initial render state --

  describe('initial render', () => {
    it('does not render time/duration/scope controls until a day is selected', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      // Time input not shown
      expect(screen.queryByLabelText(/time/i)).not.toBeInTheDocument()
      // Duration input not shown
      expect(screen.queryByLabelText(/duration/i)).not.toBeInTheDocument()
      // Scope radios not shown
      expect(screen.queryByRole('radio', { name: /this week only/i })).not.toBeInTheDocument()
    })

    it('renders dialog description text', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByText(/choose a new day and time/i)).toBeInTheDocument()
    })

    it('renders cancel and move buttons', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /move workout/i })).toBeInTheDocument()
    })

    it('move button is disabled initially', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByRole('button', { name: /move workout/i })).toBeDisabled()
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

    it('source day is not disabled when week offset is non-zero', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceDay: 0 })} />)
      expect(screen.getByRole('button', { name: 'Mon' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: /next week/i }))
      expect(screen.getByRole('button', { name: 'Mon' })).not.toBeDisabled()
    })

    it('resets target day selection when week offset changes', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      // Time controls should be visible
      expect(screen.getByLabelText(/time/i)).toBeInTheDocument()
      // Switch to next week — target day resets, controls disappear
      await user.click(screen.getByRole('button', { name: /next week/i }))
      expect(screen.queryByLabelText(/time/i)).not.toBeInTheDocument()
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

  // -- Time and duration defaults --

  describe('time and duration pre-fill', () => {
    it('pre-fills time from sourceTimeSlot', async () => {
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

    it('pre-fills duration from sourceDuration', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceDuration: 45 })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByLabelText(/duration/i)).toHaveValue(45)
    })

    it('falls back to 60 min duration when sourceDuration is null', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ sourceDuration: null })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByLabelText(/duration/i)).toHaveValue(60)
    })

    it('pre-fills duration in onConfirm', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm, sourceDuration: 45 })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetDuration: 45 })
      )
    })
  })

  // -- Day picker uses internal convention --

  describe('day mapping (internal convention)', () => {
    it('maps day buttons to internal convention (Mon=0 through Sun=6)', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm, sourceDay: 0 })} />)
      await user.click(screen.getByRole('button', { name: 'Fri' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetDay: 4 })
      )
    })

    it('Sun maps to internal day 6', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm, sourceDay: 0 })} />)
      await user.click(screen.getByRole('button', { name: 'Sun' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetDay: 6 })
      )
    })
  })

  // -- Cancel behavior --

  describe('cancel button', () => {
    it('calls onOpenChange(false) when cancel is clicked', async () => {
      const onOpenChange = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onOpenChange })} />)
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  // -- Overlap warnings (time-based) --

  describe('overlap warnings (time-based)', () => {
    it('shows overlap warning when target time range intersects existing workout', async () => {
      const user = userEvent.setup()
      const occupiedSlots: OccupiedSlot[] = [
        { day: 1, timeSlot: '07:30', duration: 60, templateName: 'Pull A' },
      ]
      render(<MoveWorkoutModal {...makeProps({ occupiedSlots, sourceTimeSlot: '07:00', sourceDuration: 90 })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      // 07:00-08:30 overlaps 07:30-08:30
      expect(screen.getByText(/overlap.*Pull A/i)).toBeInTheDocument()
    })

    it('no warning when times do not overlap', async () => {
      const user = userEvent.setup()
      const occupiedSlots: OccupiedSlot[] = [
        { day: 1, timeSlot: '14:00', duration: 60, templateName: 'Legs' },
      ]
      render(<MoveWorkoutModal {...makeProps({ occupiedSlots, sourceTimeSlot: '07:00', sourceDuration: 60 })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.queryByText(/overlap/i)).not.toBeInTheDocument()
    })

    it('AC11: no day-level restrictions regardless of workout count', () => {
      const occupiedSlots: OccupiedSlot[] = [
        { day: 3, timeSlot: '06:00', duration: 60, templateName: 'A' },
        { day: 3, timeSlot: '10:00', duration: 60, templateName: 'B' },
        { day: 3, timeSlot: '14:00', duration: 60, templateName: 'C' },
      ]
      render(<MoveWorkoutModal {...makeProps({ occupiedSlots })} />)
      expect(screen.getByRole('button', { name: 'Thu' })).not.toBeDisabled()
    })
  })

  // -- Scope behavior --

  describe('scope selection', () => {
    it('defaults to this_week scope', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'this_week' })
      )
    })

    it('sends remaining_weeks when toggled', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      await user.click(screen.getByRole('radio', { name: /remaining/i }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'remaining_weeks' })
      )
    })
  })

  // -- Modal open/close --

  describe('modal rendering', () => {
    it('does not render content when open=false', () => {
      render(<MoveWorkoutModal {...makeProps({ open: false })} />)
      expect(screen.queryByText(/move.*push a/i)).not.toBeInTheDocument()
    })

    it('shows title with source template name', () => {
      render(<MoveWorkoutModal {...makeProps({ sourceTemplateName: 'Legs B' })} />)
      expect(screen.getByText(/move.*legs b/i)).toBeInTheDocument()
    })
  })
})
