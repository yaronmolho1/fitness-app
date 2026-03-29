// Characterization test — updated post-T190 to reflect autofill behavior
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

describe('buildInitialSets — characterization for T190', () => {
  afterEach(() => {
    cleanup()
  })

  describe('weight inputs autofilled from slot.weight', () => {
    it('slot with weight=80 → all weight inputs show "80"', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 3; i++) {
        const input = screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('80')
      }
    })

    it('slot with weight=null → all weight inputs empty string', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 2; i++) {
        const input = screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('')
      }
    })

    it('slot with weight=0 → all weight inputs empty string', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 0 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('reps inputs autofilled from slot.reps', () => {
    it('slot with reps="8" → all reps inputs show "8"', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 3; i++) {
        const input = screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('8')
      }
    })

    it('slot with reps="10-12" → all reps inputs show "10" (lower bound)', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2, reps: '10-12' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 2; i++) {
        const input = screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement
        expect(input.value).toBe('10')
      }
    })

    it('slot with reps="" → all reps inputs empty string', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })

  describe('no placeholders (replaced by autofill)', () => {
    it('weight input has no placeholder when autofilled', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(input.placeholder).toBe('')
    })

    it('reps input has no placeholder when autofilled', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(input.placeholder).toBe('')
    })
  })

  describe('set count matches slot.sets', () => {
    it('slot with sets=4 creates 4 set rows', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 4 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const rows = within(section).getAllByTestId('set-row')
      expect(rows).toHaveLength(4)
    })

    it('slot with sets=1 creates 1 set row', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const rows = within(section).getAllByTestId('set-row')
      expect(rows).toHaveLength(1)
    })

    it('slot with sets=6 creates 6 set rows', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 6 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const rows = within(section).getAllByTestId('set-row')
      expect(rows).toHaveLength(6)
    })
  })

  describe('multiple slots initialization', () => {
    it('each slot gets independently autofilled sets', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, sets: 2, weight: 80, reps: '8', order: 1 }),
          makeSlot({ id: 2, sets: 3, weight: 60, reps: '12', order: 2, exercise_name: 'Flyes' }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      // Slot 0: weight=80, reps=8
      for (let i = 0; i < 2; i++) {
        const w = screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement
        const r = screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement
        expect(w.value).toBe('80')
        expect(r.value).toBe('8')
      }

      // Slot 1: weight=60, reps=12
      for (let i = 0; i < 3; i++) {
        const w = screen.getByTestId(`weight-input-1-${i}`) as HTMLInputElement
        const r = screen.getByTestId(`reps-input-1-${i}`) as HTMLInputElement
        expect(w.value).toBe('60')
        expect(r.value).toBe('12')
      }
    })

    it('slots are rendered in order regardless of input order', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 2, order: 2, weight: 60, exercise_name: 'OHP' }),
          makeSlot({ id: 1, order: 1, weight: 80, exercise_name: 'Bench' }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      // After sorting, Bench (order 1) is index 0, OHP (order 2) is index 1
      const w0 = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      const w1 = screen.getByTestId('weight-input-1-0') as HTMLInputElement
      expect(w0.value).toBe('80') // Bench
      expect(w1.value).toBe('60') // OHP
    })
  })

  describe('empty slots array', () => {
    it('renders empty state message, no set inputs', () => {
      const data = makeWorkoutData({ slots: [] })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.queryByTestId('set-row')).not.toBeInTheDocument()
      expect(screen.getByText(/no exercises configured/i)).toBeInTheDocument()
    })
  })

  describe('set number labels', () => {
    it('labels sets 1-based sequentially', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const labels = screen.getAllByTestId('set-number-label')
      expect(labels.map((l) => l.textContent)).toEqual(['1', '2', '3'])
    })
  })
})
