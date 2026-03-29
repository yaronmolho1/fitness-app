// Characterization tests for move-workout-modal before T202 refactor
// Captures current period-based behavior that will change to time-first model
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
    sourcePeriod: 'morning',
    sourceTimeSlot: '07:00',
    sourceDuration: 90,
    sourceTemplateName: 'Push A',
    occupiedSlots: [],
    onConfirm: vi.fn(),
    ...overrides,
  }
}

describe('MoveWorkoutModal — characterization (pre-T202)', () => {
  afterEach(cleanup)

  // -- Initial render state --

  describe('initial render', () => {
    it('does not render period/time/scope controls until a day is selected', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      // Period radios not shown
      expect(screen.queryByRole('radio', { name: /morning/i })).not.toBeInTheDocument()
      // Time input not shown
      expect(screen.queryByLabelText(/time/i)).not.toBeInTheDocument()
      // Scope radios not shown
      expect(screen.queryByRole('radio', { name: /this week only/i })).not.toBeInTheDocument()
    })

    it('renders dialog description text', () => {
      render(<MoveWorkoutModal {...makeProps()} />)
      expect(screen.getByText(/choose a new day, period, and time/i)).toBeInTheDocument()
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
      // Mon is disabled at offset 0
      expect(screen.getByRole('button', { name: 'Mon' })).toBeDisabled()
      // Switch to next week
      await user.click(screen.getByRole('button', { name: /next week/i }))
      // Mon should be enabled now
      expect(screen.getByRole('button', { name: 'Mon' })).not.toBeDisabled()
    })

    it('resets target day selection when week offset changes', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      // Select Tue
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      // Period controls should be visible
      expect(screen.getByRole('radio', { name: /morning/i })).toBeInTheDocument()
      // Switch to next week — target day resets, period controls disappear
      await user.click(screen.getByRole('button', { name: /next week/i }))
      expect(screen.queryByRole('radio', { name: /morning/i })).not.toBeInTheDocument()
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

    it('fully occupied days are not disabled when week offset is non-zero', async () => {
      const user = userEvent.setup()
      const occupiedSlots: OccupiedSlot[] = [
        { day: 3, period: 'morning', templateName: 'A' },
        { day: 3, period: 'afternoon', templateName: 'B' },
        { day: 3, period: 'evening', templateName: 'C' },
      ]
      render(<MoveWorkoutModal {...makeProps({ occupiedSlots })} />)
      // Thu disabled at offset 0
      expect(screen.getByRole('button', { name: 'Thu' })).toBeDisabled()
      // Switch to prev week
      await user.click(screen.getByRole('button', { name: /prev week/i }))
      // Thu should be enabled now (occupied data only applies at offset 0)
      expect(screen.getByRole('button', { name: 'Thu' })).not.toBeDisabled()
    })
  })

  // -- Period selector defaults --

  describe('period selector defaults', () => {
    it('defaults to morning period', async () => {
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps()} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByRole('radio', { name: /morning/i })).toBeChecked()
    })

    it('switching period updates onConfirm targetDay but period is implicit from time', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm })} />)
      await user.click(screen.getByRole('button', { name: 'Wed' }))
      await user.click(screen.getByRole('radio', { name: /afternoon/i }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      // onConfirm does NOT receive a period — period is not part of the callback
      expect(onConfirm).toHaveBeenCalledWith({
        targetDay: 2,
        targetTimeSlot: '07:00',
        targetDuration: 90,
        scope: 'this_week',
        targetWeekOffset: 0,
      })
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

    it('pre-fills duration from sourceDuration in onConfirm', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm, sourceDuration: 45 })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetDuration: 45 })
      )
    })

    it('falls back to 60 min duration when sourceDuration is null', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      render(<MoveWorkoutModal {...makeProps({ onConfirm, sourceDuration: null })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetDuration: 60 })
      )
    })
  })

  // -- Day picker uses internal convention --

  describe('day mapping (internal convention)', () => {
    it('maps day buttons to internal convention (Mon=0 through Sun=6)', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()
      // Source is Mon (0), so test with Fri
      render(<MoveWorkoutModal {...makeProps({ onConfirm, sourceDay: 0 })} />)
      await user.click(screen.getByRole('button', { name: 'Fri' }))
      await user.click(screen.getByRole('button', { name: /move workout/i }))
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ targetDay: 4 }) // Fri = internal 4
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

  // -- Occupied slot warnings --

  describe('occupied slot warnings (period-based)', () => {
    it('shows occupied text next to each occupied period', async () => {
      const user = userEvent.setup()
      const occupiedSlots: OccupiedSlot[] = [
        { day: 1, period: 'morning', templateName: 'Pull A' },
        { day: 1, period: 'evening', templateName: 'Legs' },
      ]
      render(<MoveWorkoutModal {...makeProps({ occupiedSlots })} />)
      await user.click(screen.getByRole('button', { name: 'Tue' }))

      // Morning shows occupied
      const morningLabel = screen.getByRole('radio', { name: /morning/i }).closest('label')!
      expect(morningLabel.textContent).toContain('Pull A')

      // Afternoon is free
      const afternoonLabel = screen.getByRole('radio', { name: /afternoon/i }).closest('label')!
      expect(afternoonLabel.textContent).not.toContain('occupied')

      // Evening shows occupied
      const eveningLabel = screen.getByRole('radio', { name: /evening/i }).closest('label')!
      expect(eveningLabel.textContent).toContain('Legs')
    })

    it('shows warning banner when selected period is occupied', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [{ day: 1, period: 'morning', templateName: 'Pull A' }],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      // Morning is default and occupied — warning should show
      expect(screen.getByText(/already has a workout.*Pull A/i)).toBeInTheDocument()
    })

    it('warning disappears when switching to free period', async () => {
      const user = userEvent.setup()
      render(
        <MoveWorkoutModal
          {...makeProps({
            occupiedSlots: [{ day: 1, period: 'morning', templateName: 'Pull A' }],
          })}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tue' }))
      expect(screen.getByText(/already has a workout/i)).toBeInTheDocument()
      await user.click(screen.getByRole('radio', { name: /afternoon/i }))
      expect(screen.queryByText(/already has a workout/i)).not.toBeInTheDocument()
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
