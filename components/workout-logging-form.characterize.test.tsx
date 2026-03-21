// Characterization test — captures current behavior for safe refactoring
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
    group_id: null,
    group_rest_seconds: null,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

describe('WorkoutLoggingForm — characterization', () => {
  afterEach(() => {
    cleanup()
  })

  describe('formatDate output', () => {
    it('formats YYYY-MM-DD as short weekday + dd/mm/yyyy', () => {
      const data = makeWorkoutData({ date: '2026-03-15' })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.getByText('Sun 15/03/2026')).toBeInTheDocument()
    })

    it('formats a different date correctly', () => {
      const data = makeWorkoutData({ date: '2026-01-01' })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.getByText('Thu 01/01/2026')).toBeInTheDocument()
    })
  })

  describe('column headers', () => {
    it('renders Set/Weight/Reps column headers when slots exist', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.getByText('Set')).toBeInTheDocument()
      expect(screen.getByText('Weight')).toBeInTheDocument()
      expect(screen.getByText('Reps')).toBeInTheDocument()
    })

    it('does not render column headers when no slots', () => {
      const data = makeWorkoutData({ slots: [] })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.queryByText('Set')).not.toBeInTheDocument()
      expect(screen.queryByText('Weight')).not.toBeInTheDocument()
    })
  })

  describe('buildInitialSets edge cases', () => {
    it('weight=0 shows "0" as placeholder, input starts empty', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 0 })],
      })
      render(<WorkoutLoggingForm data={data} />)
      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('')
      expect(weightInput.placeholder).toBe('0')
    })

    it('single set slot renders exactly one row', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)
      const rows = within(screen.getByTestId('exercise-section')).getAllByTestId('set-row')
      expect(rows).toHaveLength(1)
    })
  })

  describe('updateSet interaction', () => {
    it('typing in weight input updates displayed value', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      await user.clear(weightInput)
      await user.type(weightInput, '95')
      expect(weightInput.value).toBe('95')
    })

    it('typing in reps input updates displayed value', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      await user.clear(repsInput)
      await user.type(repsInput, '12')
      expect(repsInput.value).toBe('12')
    })

    it('editing one set does not affect another set in same slot', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput0 = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      const weightInput1 = screen.getByTestId('weight-input-0-1') as HTMLInputElement

      await user.type(weightInput0, '100')

      expect(weightInput0.value).toBe('100')
      expect(weightInput1.value).toBe('')
    })

    it('editing one slot does not affect another slot', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, sets: 1, weight: 80, order: 1 }),
          makeSlot({ id: 2, sets: 1, weight: 60, order: 2, exercise_name: 'OHP' }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const slot0Weight = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      const slot1Weight = screen.getByTestId('weight-input-1-0') as HTMLInputElement

      await user.type(slot0Weight, '90')

      expect(slot0Weight.value).toBe('90')
      expect(slot1Weight.value).toBe('')
    })
  })

  describe('sort stability', () => {
    it('does not mutate the original slots array', () => {
      const slots = [
        makeSlot({ id: 1, order: 3 }),
        makeSlot({ id: 2, order: 1 }),
        makeSlot({ id: 3, order: 2 }),
      ]
      const originalOrder = slots.map((s) => s.id)
      const data = makeWorkoutData({ slots })
      render(<WorkoutLoggingForm data={data} />)

      // Original array unchanged
      expect(slots.map((s) => s.id)).toEqual(originalOrder)
    })
  })

  describe('save button attributes', () => {
    it('save button has type="button" (not submit)', () => {
      const data = makeWorkoutData()
      render(<WorkoutLoggingForm data={data} />)
      const button = screen.getByRole('button', { name: /save workout/i })
      expect(button.getAttribute('type')).toBe('button')
    })
  })

  describe('exports', () => {
    it('exports SlotData type (compile-time check)', () => {
      // If this compiles, the type is exported
      const slot: SlotData = makeSlot()
      expect(slot.exercise_name).toBe('Bench Press')
    })

    it('exports WorkoutData type (compile-time check)', () => {
      const data: WorkoutData = makeWorkoutData()
      expect(data.date).toBe('2026-03-15')
    })
  })
})
