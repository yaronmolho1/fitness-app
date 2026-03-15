// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData } from './workout-logging-form'

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

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
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

describe('WorkoutLoggingForm', () => {
  afterEach(() => {
    cleanup()
  })

  describe('exercise display in sort_order', () => {
    it('renders exercises in sort_order', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Overhead Press', order: 2 }),
          makeSlot({ id: 2, exercise_name: 'Bench Press', order: 1 }),
          makeSlot({ id: 3, exercise_name: 'Lateral Raise', order: 3, is_main: false }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const sections = screen.getAllByTestId('exercise-section')
      expect(sections).toHaveLength(3)
      expect(sections[0]).toHaveTextContent('Bench Press')
      expect(sections[1]).toHaveTextContent('Overhead Press')
      expect(sections[2]).toHaveTextContent('Lateral Raise')
    })

    it('shows exercise name in each section', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ exercise_name: 'Squat' })],
      })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.getByText('Squat')).toBeInTheDocument()
    })
  })

  describe('set rows per target_sets', () => {
    it('renders one set row per target_sets', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 4 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const rows = within(section).getAllByTestId('set-row')
      expect(rows).toHaveLength(4)
    })

    it('renders correct number of rows for multiple exercises', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 3, order: 1 }),
          makeSlot({ id: 2, exercise_name: 'Lateral Raise', sets: 5, order: 2, is_main: false }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const sections = screen.getAllByTestId('exercise-section')
      expect(within(sections[0]).getAllByTestId('set-row')).toHaveLength(3)
      expect(within(sections[1]).getAllByTestId('set-row')).toHaveLength(5)
    })

    it('displays set number label on each row', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('pre-fill values', () => {
    it('pre-fills weight from target_weight', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 100 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('100')
    })

    it('pre-fills reps from target_reps', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '12' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.value).toBe('12')
    })

    it('pre-fills all set rows with same target values', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3, weight: 60, reps: '10' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 0; i < 3; i++) {
        const w = screen.getByTestId(`weight-input-0-${i}`) as HTMLInputElement
        const r = screen.getByTestId(`reps-input-0-${i}`) as HTMLInputElement
        expect(w.value).toBe('60')
        expect(r.value).toBe('10')
      }
    })
  })

  describe('null target_weight handling', () => {
    it('renders blank weight input when target_weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('')
    })

    it('does not render zero when target_weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).not.toBe('0')
    })

    it('pre-fills reps even when weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null, reps: '15' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.value).toBe('15')
    })
  })

  describe('main/complementary distinction', () => {
    it('shows main badge for main exercises', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ is_main: true })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('Main')).toBeInTheDocument()
    })

    it('shows complementary badge for non-main exercises', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ is_main: false })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('Complementary')).toBeInTheDocument()
    })
  })

  describe('Save Workout button', () => {
    it('renders a prominent Save Workout button', () => {
      const data = makeWorkoutData()
      render(<WorkoutLoggingForm data={data} />)

      const button = screen.getByRole('button', { name: /save workout/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty state when template has no slots', () => {
      const data = makeWorkoutData({ slots: [] })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText(/no exercises/i)).toBeInTheDocument()
      // Save button still present for rating/notes only
      expect(screen.getByRole('button', { name: /save workout/i })).toBeInTheDocument()
    })
  })

  describe('inputs are editable', () => {
    it('weight inputs are not readonly', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.readOnly).toBe(false)
    })

    it('reps inputs are not readonly', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.readOnly).toBe(false)
    })

    it('weight inputs use numeric inputMode', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.inputMode).toBe('decimal')
    })

    it('reps inputs use numeric inputMode', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.inputMode).toBe('numeric')
    })
  })

  describe('template info display', () => {
    it('shows template name', () => {
      const data = makeWorkoutData({
        template: { id: 1, name: 'Upper Body A', modality: 'resistance', notes: null },
      })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.getByText('Upper Body A')).toBeInTheDocument()
    })

    it('shows mesocycle name', () => {
      const data = makeWorkoutData({
        mesocycle: { id: 1, name: 'Hypertrophy Block', start_date: '2026-03-01', end_date: '2026-04-01', week_type: 'normal' },
      })
      render(<WorkoutLoggingForm data={data} />)
      expect(screen.getByText('Hypertrophy Block')).toBeInTheDocument()
    })
  })
})
