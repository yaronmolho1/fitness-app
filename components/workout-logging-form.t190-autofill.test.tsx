// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData, SlotData } from './workout-logging-form'

function makeSlot(overrides: Partial<SlotData> = {}): SlotData {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 3,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 180,
    group_id: null,
    group_rest_seconds: null,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

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

afterEach(() => {
  cleanup()
})

describe('resistance autofill on load (T190)', () => {
  describe('weight autofill', () => {
    it('prefills weight from slot.weight', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 3; i++) {
        const input = screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('80')
      }
    })

    it('leaves weight empty when slot.weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 2; i++) {
        const input = screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('')
      }
    })

    it('leaves weight empty when slot.weight is 0', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 0 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('reps autofill', () => {
    it('prefills reps from single integer string', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 3; i++) {
        const input = screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('8')
      }
    })

    it('prefills reps with lower bound from range "10-12"', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2, reps: '10-12' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 2; i++) {
        const input = screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('10')
      }
    })

    it('leaves reps empty for "AMRAP"', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: 'AMRAP' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('leaves reps empty for empty string', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('prefills reps=5 for degenerate range "5-5"', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '5-5' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(input.value).toBe('5')
    })
  })

  describe('range hint label', () => {
    it('shows "Target: 8-12" hint when reps is a range', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '8-12' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('Target: 8-12')).toBeInTheDocument()
    })

    it('does not show hint for single integer reps', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.queryByText(/^Target:/)).not.toBeInTheDocument()
    })

    it('does not show hint for degenerate range "5-5"', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '5-5' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.queryByText(/^Target:/)).not.toBeInTheDocument()
    })

    it('shows "Target: AMRAP" hint for AMRAP', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: 'AMRAP' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('Target: AMRAP')).toBeInTheDocument()
    })
  })

  describe('placeholders removed', () => {
    it('weight input has no placeholder when weight is autofilled', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(input.placeholder).toBe('')
    })

    it('reps input has no placeholder when reps is autofilled', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(input.placeholder).toBe('')
    })
  })

  describe('RPE, rating, notes remain empty', () => {
    it('RPE is not autofilled', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ rpe: 8 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const rpeSelector = screen.getByTestId('rpe-selector-0')
      const pressedButtons = within(rpeSelector).queryAllByRole('button', { pressed: true })
      expect(pressedButtons).toHaveLength(0)
    })

    it('rating is unset', () => {
      const data = makeWorkoutData({
        slots: [makeSlot()],
      })
      render(<WorkoutLoggingForm data={data} />)

      const ratingSection = screen.getByTestId('rating-notes-section')
      const pressedButtons = within(ratingSection).queryAllByRole('button', { pressed: true })
      expect(pressedButtons).toHaveLength(0)
    })
  })

  describe('multiple slots with different values', () => {
    it('each slot prefills independently', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, sets: 2, weight: 80, reps: '8', order: 1 }),
          makeSlot({ id: 2, sets: 3, weight: 60, reps: '10-12', order: 2, exercise_name: 'Flyes' }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      // Slot 0: weight=80, reps=8
      for (let i = 0; i < 2; i++) {
        expect((screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement).value).toBe('80')
        expect((screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement).value).toBe('8')
      }

      // Slot 1: weight=60, reps=10 (lower bound of 10-12)
      for (let i = 0; i < 3; i++) {
        expect((screen.getByTestId(`weight-input-1-${i}`) as HTMLInputElement).value).toBe('60')
        expect((screen.getByTestId(`reps-input-1-${i}`) as HTMLInputElement).value).toBe('10')
      }
    })
  })
})
