// T088 — Per-exercise RPE selector
// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach } from 'vitest'
import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData, SlotData } from './workout-logging-form'

function makeWorkoutData(overrides: Partial<WorkoutData> = {}): WorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
    },
    template: {
      id: 1,
      name: 'Push Day A',
      modality: 'resistance',
      notes: null,
    },
    slots: [],
    ...overrides,
  }
}

function makeSlot(overrides: Partial<SlotData> = {}): SlotData {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 4,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 180,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

describe('T088 — Per-exercise RPE selector', () => {
  afterEach(() => {
    cleanup()
  })

  // AC6: Single RPE input appears below sets for entire exercise
  describe('AC6 — RPE selector below sets', () => {
    it('renders one RPE selector per exercise section', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 3, order: 1 }),
          makeSlot({ id: 2, exercise_name: 'OHP', sets: 2, order: 2 }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const sections = screen.getAllByTestId('exercise-section')
      for (const section of sections) {
        expect(within(section).getByTestId(/^rpe-selector-/)).toBeInTheDocument()
      }
    })

    it('RPE selector appears after set rows in DOM order', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const setRows = within(section).getAllByTestId('set-row')
      const rpeSelector = within(section).getByTestId('rpe-selector-0')

      // RPE selector should come after last set row in DOM
      const lastSetRow = setRows[setRows.length - 1]
      const comparison = lastSetRow.compareDocumentPosition(rpeSelector)
      expect(comparison & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  // AC7: Row of tappable buttons numbered 1-10
  describe('AC7 — 10 tappable RPE buttons', () => {
    it('renders exactly 10 RPE buttons per exercise', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector = screen.getByTestId('rpe-selector-0')
      const buttons = within(selector).getAllByRole('button')
      expect(buttons).toHaveLength(10)
    })

    it('buttons are numbered 1 through 10', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector = screen.getByTestId('rpe-selector-0')
      for (let i = 1; i <= 10; i++) {
        expect(within(selector).getByRole('button', { name: `RPE ${i}` })).toHaveTextContent(String(i))
      }
    })

    it('each button has min 44px touch target', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector = screen.getByTestId('rpe-selector-0')
      const buttons = within(selector).getAllByRole('button')
      for (const button of buttons) {
        // Check for min-h-[44px] and min-w-[44px] classes
        expect(button.className).toMatch(/min-h-\[44px\]/)
        expect(button.className).toMatch(/min-w-\[44px\]/)
      }
    })
  })

  // AC8: Tap to select (highlighted)
  describe('AC8 — tap to select', () => {
    it('selects RPE value when button tapped', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const btn = screen.getByRole('button', { name: 'RPE 7' })
      await user.click(btn)

      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })

    it('only one RPE value selected at a time', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      await user.click(screen.getByRole('button', { name: 'RPE 5' }))
      await user.click(screen.getByRole('button', { name: 'RPE 8' }))

      expect(screen.getByRole('button', { name: 'RPE 5' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'RPE 8' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  // AC9: Tap again to deselect
  describe('AC9 — tap to deselect', () => {
    it('clears selection when tapping already-selected RPE', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const btn = screen.getByRole('button', { name: 'RPE 6' })
      await user.click(btn)
      expect(btn).toHaveAttribute('aria-pressed', 'true')

      await user.click(btn)
      expect(btn).toHaveAttribute('aria-pressed', 'false')
    })
  })

  // AC10: No RPE selected = null
  describe('AC10 — default null state', () => {
    it('no RPE button selected by default', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector = screen.getByTestId('rpe-selector-0')
      const buttons = within(selector).getAllByRole('button')
      for (const button of buttons) {
        expect(button).toHaveAttribute('aria-pressed', 'false')
      }
    })
  })

  // Edge case: RPE independence between exercises
  describe('RPE independence between exercises', () => {
    it('selecting RPE on one exercise does not affect another', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 1, order: 1 }),
          makeSlot({ id: 2, exercise_name: 'OHP', sets: 1, order: 2 }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector0 = screen.getByTestId('rpe-selector-0')
      const selector1 = screen.getByTestId('rpe-selector-1')

      await user.click(within(selector0).getByRole('button', { name: 'RPE 9' }))

      expect(within(selector0).getByRole('button', { name: 'RPE 9' })).toHaveAttribute('aria-pressed', 'true')
      // Other exercise unaffected
      const buttons1 = within(selector1).getAllByRole('button')
      for (const btn of buttons1) {
        expect(btn).toHaveAttribute('aria-pressed', 'false')
      }
    })
  })

  // Edge case: Narrow viewport wrapping
  describe('narrow viewport wrapping', () => {
    it('RPE buttons container uses flex-wrap for narrow viewports', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector = screen.getByTestId('rpe-selector-0')
      expect(selector.className).toMatch(/flex-wrap/)
    })
  })

  // Verify old text input is gone
  describe('old RPE text input removed', () => {
    it('does not render a text input for RPE', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      // Old testid should not exist
      expect(screen.queryByTestId('rpe-input-0')).not.toBeInTheDocument()
    })
  })
})
