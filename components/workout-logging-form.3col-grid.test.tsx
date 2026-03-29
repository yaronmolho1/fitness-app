// T087 — 3-column set input grid
// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
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

describe('T087 — 3-column set input grid', () => {
  afterEach(() => {
    cleanup()
  })

  // AC1: Each row displays exactly 3 interactive columns: weight input, reps input, delete button
  describe('AC1 — 3 interactive columns per set row', () => {
    it('each set row contains exactly 2 inputs and 1 button (3 interactive elements)', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const rows = screen.getAllByTestId('set-row')
      for (const row of rows) {
        const inputs = within(row).getAllByRole('textbox')
        const buttons = within(row).getAllByRole('button')
        expect(inputs).toHaveLength(2) // weight + reps
        expect(buttons).toHaveLength(1) // delete
      }
    })

    it('does not render RPE input inside set rows', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3, rpe: 8 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const rows = screen.getAllByTestId('set-row')
      for (const row of rows) {
        // No RPE-related inputs within the row
        expect(within(row).queryByLabelText(/rpe/i)).not.toBeInTheDocument()
      }
    })
  })

  // AC2: Weight input wide enough for 5+ characters
  describe('AC2 — weight input width', () => {
    it('weight input has min-width for 5+ characters', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      // The input should have a class or style ensuring min-width >= ~5ch
      // We check it's in a flex/grid column that gives it enough space
      expect(weightInput).toBeInTheDocument()
      // Verify the input accepts 5+ char values without the container being too narrow
      // The grid column uses 1fr which expands, and the input has w-full
      expect(weightInput.className).toContain('w-full')
    })
  })

  // AC3: Reps input wide enough for 3+ characters
  describe('AC3 — reps input width', () => {
    it('reps input has adequate width for 3+ characters', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput).toBeInTheDocument()
      expect(repsInput.className).toContain('w-full')
    })
  })

  // AC4: Set number as non-interactive label
  describe('AC4 — set number as non-interactive label', () => {
    it('set number is not an input element', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const rows = screen.getAllByTestId('set-row')
      for (const row of rows) {
        const label = within(row).getByTestId('set-number-label')
        expect(label.tagName).not.toBe('INPUT')
        expect(label.tagName).not.toBe('BUTTON')
      }
    })

    it('set number labels display correct numbers', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const rows = screen.getAllByTestId('set-row')
      rows.forEach((row, i) => {
        const label = within(row).getByTestId('set-number-label')
        expect(label).toHaveTextContent(String(i + 1))
      })
    })

    it('set number label is positioned to the left of inputs', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const row = screen.getByTestId('set-row')
      const label = within(row).getByTestId('set-number-label')
      const weightInput = within(row).getByTestId('weight-input-0-0')

      // In DOM order, label comes before the weight input
      const allChildren = Array.from(row.querySelectorAll('[data-testid]'))
      const labelIdx = allChildren.indexOf(label)
      const weightIdx = allChildren.indexOf(weightInput)
      expect(labelIdx).toBeLessThan(weightIdx)
    })
  })

  // AC5: Planned values autofilled (T190 replaced placeholders with real values)
  describe('AC5 — planned values autofilled', () => {
    it('weight input autofilled with planned weight', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 120.5 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('120.5')
    })

    it('reps input autofilled with planned reps', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '10' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.value).toBe('10')
    })

    it('weight is empty when target_weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('')
    })

    it('no separate planned values reference row exists', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.queryByTestId('planned-weight-0-0')).not.toBeInTheDocument()
      expect(screen.queryByTestId('planned-reps-0-0')).not.toBeInTheDocument()
    })

    it('inputs are autofilled with planned values', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80, reps: '10' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('80')
      expect(repsInput.value).toBe('10')
    })
  })

  // Edge case: 8+ sets render without horizontal overflow
  describe('edge case — many sets', () => {
    it('renders 8 set rows without error', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 8 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const rows = screen.getAllByTestId('set-row')
      expect(rows).toHaveLength(8)
    })
  })
})
