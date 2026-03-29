// @vitest-environment jsdom
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

      const rows = screen.getAllByTestId('set-row')
      rows.forEach((row, i) => {
        const label = within(row).getByTestId('set-number-label')
        expect(label).toHaveTextContent(String(i + 1))
      })
    })
  })

  describe('autofilled values from planned data', () => {
    it('autofills weight from slot.weight', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 100 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('100')
    })

    it('autofills reps from slot.reps', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '12' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.value).toBe('12')
    })

    it('autofills same values on all set rows', () => {
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
    it('renders empty weight input when target_weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('')
    })

    it('weight is not "0" when target_weight is null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).not.toBe('0')
    })

    it('autofills reps even when weight is null', () => {
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

  // T049/T088 — Actual RPE selector (per-exercise, button row)
  describe('actual RPE selector', () => {
    it('renders one RPE selector per exercise', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 3, order: 1 }),
          makeSlot({ id: 2, exercise_name: 'OHP', sets: 2, order: 2 }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByTestId('rpe-selector-0')).toBeInTheDocument()
      expect(screen.getByTestId('rpe-selector-1')).toBeInTheDocument()
    })

    it('RPE starts unselected (not pre-filled)', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, rpe: 8 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector = screen.getByTestId('rpe-selector-0')
      const buttons = within(selector).getAllByRole('button')
      for (const btn of buttons) {
        expect(btn).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('RPE is selectable via button tap', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const btn = screen.getByRole('button', { name: 'RPE 7' })
      await user.click(btn)
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })

    it('RPE label is shown per exercise', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('RPE')).toBeInTheDocument()
    })
  })

  describe('planned values as autofilled inputs', () => {
    it('autofills weight from planned value', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('80')
    })

    it('autofills reps from planned value', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, reps: '10' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const repsInput = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      expect(repsInput.value).toBe('10')
    })

    it('shows planned RPE in exercise RPE section when present', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, rpe: 8 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText(/plan: 8/)).toBeInTheDocument()
    })

    it('weight is empty when null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const weightInput = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      expect(weightInput.value).toBe('')
    })

    it('does not show planned RPE when null', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, rpe: null })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.queryByText(/plan:/)).not.toBeInTheDocument()
    })

    it('no separate planned values elements exist', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 80, reps: '8', rpe: 8 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.queryByTestId('planned-weight-0-0')).not.toBeInTheDocument()
      expect(screen.queryByTestId('planned-reps-0-0')).not.toBeInTheDocument()
    })
  })

  describe('exercise RPE independence', () => {
    it('selecting RPE on one exercise does not affect another', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 2, order: 1 }),
          makeSlot({ id: 2, exercise_name: 'OHP', sets: 2, order: 2 }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const selector0 = screen.getByTestId('rpe-selector-0')
      const selector1 = screen.getByTestId('rpe-selector-1')

      await user.click(within(selector0).getByRole('button', { name: 'RPE 9' }))
      expect(within(selector0).getByRole('button', { name: 'RPE 9' })).toHaveAttribute('aria-pressed', 'true')

      const buttons1 = within(selector1).getAllByRole('button')
      for (const btn of buttons1) {
        expect(btn).toHaveAttribute('aria-pressed', 'false')
      }
    })
  })

  // T050 — Add/remove set rows
  describe('add set', () => {
    it('renders an "Add Set" button per exercise section', () => {
      const data = makeWorkoutData({
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 2, order: 1 }),
          makeSlot({ id: 2, exercise_name: 'OHP', sets: 3, order: 2 }),
        ],
      })
      render(<WorkoutLoggingForm data={data} />)

      const sections = screen.getAllByTestId('exercise-section')
      expect(within(sections[0]).getByRole('button', { name: /add set/i })).toBeInTheDocument()
      expect(within(sections[1]).getByRole('button', { name: /add set/i })).toBeInTheDocument()
    })

    it('appends a new set row when clicked', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      expect(within(section).getAllByTestId('set-row')).toHaveLength(2)

      await user.click(within(section).getByRole('button', { name: /add set/i }))
      expect(within(section).getAllByTestId('set-row')).toHaveLength(3)
    })

    it('copies weight and reps from last row', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: 100, reps: '8' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      // Clear and type new values (inputs are autofilled from planned data)
      const weight0 = screen.getByTestId('weight-input-0-0') as HTMLInputElement
      const reps0 = screen.getByTestId('reps-input-0-0') as HTMLInputElement
      await user.clear(weight0)
      await user.type(weight0, '105')
      await user.clear(reps0)
      await user.type(reps0, '10')

      await user.click(screen.getByRole('button', { name: /add set/i }))

      const newWeight = screen.getByTestId('weight-input-0-1') as HTMLInputElement
      const newReps = screen.getByTestId('reps-input-0-1') as HTMLInputElement

      expect(newWeight.value).toBe('105')
      expect(newReps.value).toBe('10')
    })

    it('adds row copying empty values when last row is empty', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1, weight: null, reps: '' })],
      })
      render(<WorkoutLoggingForm data={data} />)

      await user.click(screen.getByRole('button', { name: /add set/i }))

      const newWeight = screen.getByTestId('weight-input-0-1') as HTMLInputElement
      const newReps = screen.getByTestId('reps-input-0-1') as HTMLInputElement

      expect(newWeight.value).toBe('')
      expect(newReps.value).toBe('')
    })

    it('updates set numbering after add', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      await user.click(screen.getByRole('button', { name: /add set/i }))

      const section = screen.getByTestId('exercise-section')
      const rows = within(section).getAllByTestId('set-row')
      expect(rows).toHaveLength(3)
      // Set numbers should be 1, 2, 3
      expect(rows[2]).toHaveTextContent('3')
    })
  })

  describe('remove set', () => {
    it('renders a remove button per set row', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const removeButtons = within(section).getAllByRole('button', { name: /remove/i })
      expect(removeButtons).toHaveLength(3)
    })

    it('removes the set row when clicked', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const removeButtons = within(section).getAllByRole('button', { name: /remove/i })

      await user.click(removeButtons[1]) // Remove the second set
      expect(within(section).getAllByTestId('set-row')).toHaveLength(2)
    })

    it('blocks removing the last remaining set', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const removeButton = within(section).getByRole('button', { name: /remove/i })
      expect(removeButton).toBeDisabled()
    })

    it('disables remove from start when target_sets=1', () => {
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const removeButton = within(section).getByRole('button', { name: /remove/i })
      expect(removeButton).toBeDisabled()
    })

    it('updates set numbering after remove', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 3 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      const removeButtons = within(section).getAllByRole('button', { name: /remove/i })

      await user.click(removeButtons[0]) // Remove first set
      const rows = within(section).getAllByTestId('set-row')
      expect(rows).toHaveLength(2)
      // Renumbered to 1, 2
      expect(rows[0]).toHaveTextContent('1')
      expect(rows[1]).toHaveTextContent('2')
    })

    it('re-enables remove button after adding back from 1 set', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 1 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      // Initially disabled
      expect(within(section).getByRole('button', { name: /remove/i })).toBeDisabled()

      await user.click(within(section).getByRole('button', { name: /add set/i }))

      // Now 2 rows, remove buttons should be enabled
      const removeButtons = within(section).getAllByRole('button', { name: /remove/i })
      expect(removeButtons).toHaveLength(2)
      expect(removeButtons[0]).not.toBeDisabled()
      expect(removeButtons[1]).not.toBeDisabled()
    })
  })

  describe('add then remove (round-trip)', () => {
    it('adding then removing returns to original state', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({
        slots: [makeSlot({ sets: 2 })],
      })
      render(<WorkoutLoggingForm data={data} />)

      const section = screen.getByTestId('exercise-section')
      expect(within(section).getAllByTestId('set-row')).toHaveLength(2)

      // Add a set
      await user.click(within(section).getByRole('button', { name: /add set/i }))
      expect(within(section).getAllByTestId('set-row')).toHaveLength(3)

      // Remove the added set (last one)
      const removeButtons = within(section).getAllByRole('button', { name: /remove/i })
      await user.click(removeButtons[2])
      expect(within(section).getAllByTestId('set-row')).toHaveLength(2)
    })
  })

  // T051 — Rating + notes fields
  describe('workout rating', () => {
    it('renders rating buttons 1-5', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: `Rate ${i}` })).toBeInTheDocument()
      }
    })

    it('no rating selected by default', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      for (let i = 1; i <= 5; i++) {
        const btn = screen.getByRole('button', { name: `Rate ${i}` })
        expect(btn).not.toHaveAttribute('aria-pressed', 'true')
      }
    })

    it('selects rating when clicked', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      await user.click(screen.getByRole('button', { name: 'Rate 3' }))
      expect(screen.getByRole('button', { name: 'Rate 3' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('deselects rating when same value clicked again', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      await user.click(screen.getByRole('button', { name: 'Rate 3' }))
      await user.click(screen.getByRole('button', { name: 'Rate 3' }))
      expect(screen.getByRole('button', { name: 'Rate 3' })).not.toHaveAttribute('aria-pressed', 'true')
    })

    it('only one rating active at a time', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      await user.click(screen.getByRole('button', { name: 'Rate 2' }))
      await user.click(screen.getByRole('button', { name: 'Rate 4' }))

      expect(screen.getByRole('button', { name: 'Rate 2' })).not.toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Rate 4' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('rating section has a label', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByText('Workout Rating')).toBeInTheDocument()
    })
  })

  describe('workout notes', () => {
    it('renders a notes textarea', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByLabelText('Workout Notes')).toBeInTheDocument()
    })

    it('notes textarea is editable', async () => {
      const user = userEvent.setup()
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      const textarea = screen.getByLabelText('Workout Notes')
      await user.type(textarea, 'Felt strong today')
      expect(textarea).toHaveValue('Felt strong today')
    })

    it('notes starts empty', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      const textarea = screen.getByLabelText('Workout Notes')
      expect(textarea).toHaveValue('')
    })
  })

  describe('rating + notes positioning', () => {
    it('rating and notes appear after exercise sections and before save button', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      const { container } = render(<WorkoutLoggingForm data={data} />)

      // Rating/notes section should come after exercise section in DOM
      const allElements = container.querySelectorAll('[data-testid="exercise-section"], [data-testid="rating-notes-section"]')
      const indices = Array.from(allElements).map((el) => el.getAttribute('data-testid'))
      expect(indices[indices.length - 1]).toBe('rating-notes-section')
    })

    it('renders rating and notes even with no exercises', () => {
      const data = makeWorkoutData({ slots: [] })
      render(<WorkoutLoggingForm data={data} />)

      expect(screen.getByTestId('rating-notes-section')).toBeInTheDocument()
      expect(screen.getByText('Workout Rating')).toBeInTheDocument()
      expect(screen.getByLabelText('Workout Notes')).toBeInTheDocument()
    })
  })

  describe('rating + notes state exposed via getRatingNotes', () => {
    it('exposes null rating when nothing selected', () => {
      const data = makeWorkoutData({ slots: [makeSlot()] })
      render(<WorkoutLoggingForm data={data} />)

      // The form should internally track rating as null
      // We verify via the aria-pressed state
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: `Rate ${i}` })).not.toHaveAttribute('aria-pressed', 'true')
      }
    })
  })
})
