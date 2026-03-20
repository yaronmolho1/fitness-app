// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

vi.mock('@/lib/exercises/actions', () => ({
  editExercise: vi.fn(),
}))

import { EditExerciseForm } from './edit-exercise-form'
import { editExercise } from '@/lib/exercises/actions'
import type { Exercise } from '@/lib/exercises/filters'

const baseExercise: Exercise = {
  id: 1,
  name: 'Bench Press',
  modality: 'resistance',
  muscle_group: 'Chest',
  equipment: 'Barbell',
  created_at: new Date(),
}

const equipmentOptions = ['Barbell', 'Dumbbell', 'Cable', 'Machine']
const muscleGroupOptions = ['Chest', 'Back', 'Legs', 'Shoulders']

describe('EditExerciseForm', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders comboboxes for equipment and muscle group (not plain text inputs)', () => {
    render(
      <EditExerciseForm
        exercise={baseExercise}
        equipmentOptions={equipmentOptions}
        muscleGroupOptions={muscleGroupOptions}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    )

    // Should have combobox roles for equipment and muscle group
    const comboboxes = screen.getAllByRole('combobox')
    // Modality select is also a combobox, plus equipment + muscle_group = 3
    expect(comboboxes.length).toBeGreaterThanOrEqual(2)

    // Verify equipment combobox exists with pre-filled value
    const equipmentCombobox = screen.getByDisplayValue('Barbell')
    expect(equipmentCombobox).toHaveAttribute('role', 'combobox')

    // Verify muscle group combobox exists with pre-filled value
    const muscleGroupCombobox = screen.getByDisplayValue('Chest')
    expect(muscleGroupCombobox).toHaveAttribute('role', 'combobox')
  })

  it('pre-fills comboboxes with current exercise values', () => {
    render(
      <EditExerciseForm
        exercise={baseExercise}
        equipmentOptions={equipmentOptions}
        muscleGroupOptions={muscleGroupOptions}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    )

    expect(screen.getByDisplayValue('Barbell')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chest')).toBeInTheDocument()
  })

  it('shows suggestions from options when combobox is focused', async () => {
    const user = userEvent.setup()
    render(
      <EditExerciseForm
        exercise={{ ...baseExercise, equipment: '', muscle_group: '' }}
        equipmentOptions={equipmentOptions}
        muscleGroupOptions={muscleGroupOptions}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    )

    // Focus the equipment combobox — find by label
    const equipmentInput = screen.getByLabelText(/equipment/i)
    await user.click(equipmentInput)

    // Should show listbox with equipment options
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(equipmentOptions.length)
  })

  it('handles null equipment and muscle_group gracefully', () => {
    render(
      <EditExerciseForm
        exercise={{ ...baseExercise, equipment: null, muscle_group: null }}
        equipmentOptions={equipmentOptions}
        muscleGroupOptions={muscleGroupOptions}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    )

    // Comboboxes should render with empty values
    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes.length).toBeGreaterThanOrEqual(2)
  })

  it('submits edited values from comboboxes', async () => {
    const user = userEvent.setup()
    vi.mocked(editExercise).mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Dumbbell', created_at: new Date() },
    })
    const onSaved = vi.fn()

    render(
      <EditExerciseForm
        exercise={baseExercise}
        equipmentOptions={equipmentOptions}
        muscleGroupOptions={muscleGroupOptions}
        onCancel={() => {}}
        onSaved={onSaved}
      />
    )

    // Clear and type new equipment value
    const equipmentInput = screen.getByDisplayValue('Barbell')
    await user.clear(equipmentInput)
    await user.type(equipmentInput, 'Dumbbell')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(editExercise).toHaveBeenCalledWith({
        id: 1,
        name: 'Bench Press',
        modality: 'resistance',
        muscle_group: 'Chest',
        equipment: 'Dumbbell',
      })
    })
  })

  it('works with empty suggestion lists (no existing exercises)', () => {
    render(
      <EditExerciseForm
        exercise={baseExercise}
        equipmentOptions={[]}
        muscleGroupOptions={[]}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    )

    // Should still render comboboxes
    const comboboxes = screen.getAllByRole('combobox')
    expect(comboboxes.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByDisplayValue('Barbell')).toBeInTheDocument()
  })
})
