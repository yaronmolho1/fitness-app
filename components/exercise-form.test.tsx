// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

// Radix primitives use pointer capture APIs missing from jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

vi.mock('@/lib/exercises/actions', () => ({
  createExercise: vi.fn(),
}))

import { ExerciseForm } from './exercise-form'
import { createExercise } from '@/lib/exercises/actions'

const equipmentOptions = ['Barbell', 'Dumbbell', 'Cable']
const muscleGroupOptions = ['Chest', 'Back', 'Legs']

// Radix Select uses pointer events; userEvent must have them enabled
async function selectOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, label: string) {
  await user.click(trigger)
  const option = await screen.findByRole('option', { name: label })
  await user.click(option)
}

// Helper: expand the form before interacting
async function expandForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /new exercise/i }))
}

describe('ExerciseForm', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // -- T108: Collapsible behavior --

  describe('collapsible behavior', () => {
    it('is collapsed by default showing + New Exercise button', () => {
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      expect(screen.getByRole('button', { name: /new exercise/i })).toBeInTheDocument()
      // Form fields should not be visible
      expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /create exercise/i })).not.toBeInTheDocument()
    })

    it('expands form on button click', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)

      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create exercise/i })).toBeInTheDocument()
    })

    it('collapses form on cancel button click', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /new exercise/i })).toBeInTheDocument()
    })

    it('resets form fields when collapsed', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      // Expand and type something
      await expandForm(user)
      await user.type(screen.getByLabelText(/^name$/i), 'Bench Press')

      // Collapse
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Re-expand
      await expandForm(user)

      // Name should be empty after re-expand
      expect(screen.getByLabelText(/^name$/i)).toHaveValue('')
    })

    it('collapses after successful creation', async () => {
      const user = userEvent.setup()
      vi.mocked(createExercise).mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
      })

      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      await user.type(screen.getByLabelText(/^name$/i), 'Bench Press')

      // Find modality select — it's the Radix select combobox
      const modalityTrigger = screen.getByRole('combobox', { name: /modality/i })
      await selectOption(user, modalityTrigger, 'Resistance')

      await user.click(screen.getByRole('button', { name: /create exercise/i }))

      await waitFor(() => {
        expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /new exercise/i })).toBeInTheDocument()
    })
  })

  // -- T108: Combobox integration --

  describe('combobox integration', () => {
    it('uses comboboxes for equipment and muscle group (not plain inputs)', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)

      // Equipment and muscle group should be combobox role
      const equipmentInput = screen.getByLabelText(/equipment/i)
      expect(equipmentInput).toHaveAttribute('role', 'combobox')

      const muscleGroupInput = screen.getByLabelText(/muscle group/i)
      expect(muscleGroupInput).toHaveAttribute('role', 'combobox')
    })

    it('shows equipment suggestions on focus', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      await user.click(screen.getByLabelText(/equipment/i))

      const listbox = screen.getByRole('listbox')
      expect(listbox).toBeInTheDocument()

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(equipmentOptions.length)
    })

    it('shows muscle group suggestions on focus', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      await user.click(screen.getByLabelText(/muscle group/i))

      const listbox = screen.getByRole('listbox')
      expect(listbox).toBeInTheDocument()

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(muscleGroupOptions.length)
    })

    it('works with empty suggestion lists', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={[]} muscleGroupOptions={[]} />)

      await expandForm(user)

      // Should still have combobox inputs
      expect(screen.getByLabelText(/equipment/i)).toHaveAttribute('role', 'combobox')
      expect(screen.getByLabelText(/muscle group/i)).toHaveAttribute('role', 'combobox')
    })
  })

  // -- Existing form behavior (updated for collapsible wrapper) --

  describe('form fields and validation', () => {
    it('renders all form fields when expanded', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)

      expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /modality/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/muscle group/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/equipment/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create exercise/i })).toBeInTheDocument()
    })

    it('modality select has three options', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)

      const modalityTrigger = screen.getByRole('combobox', { name: /modality/i })
      await user.click(modalityTrigger)
      const options = await screen.findAllByRole('option')
      expect(options).toHaveLength(3)
    })

    it('shows validation error when submitting with empty name', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)

      const modalityTrigger = screen.getByRole('combobox', { name: /modality/i })
      await selectOption(user, modalityTrigger, 'Resistance')
      await user.click(screen.getByRole('button', { name: /create exercise/i }))

      expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
      expect(createExercise).not.toHaveBeenCalled()
    })

    it('shows validation error when submitting without modality', async () => {
      const user = userEvent.setup()
      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)

      await user.type(screen.getByLabelText(/^name$/i), 'Bench Press')
      await user.click(screen.getByRole('button', { name: /create exercise/i }))

      expect(await screen.findByText(/modality is required/i)).toBeInTheDocument()
      expect(createExercise).not.toHaveBeenCalled()
    })

    it('calls createExercise with valid data and collapses on success', async () => {
      const user = userEvent.setup()
      vi.mocked(createExercise).mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
      })

      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      await user.type(screen.getByLabelText(/^name$/i), 'Bench Press')

      const modalityTrigger = screen.getByRole('combobox', { name: /modality/i })
      await selectOption(user, modalityTrigger, 'Resistance')
      await user.type(screen.getByLabelText(/muscle group/i), 'Chest')
      await user.type(screen.getByLabelText(/equipment/i), 'Barbell')
      await user.click(screen.getByRole('button', { name: /create exercise/i }))

      await waitFor(() => {
        expect(createExercise).toHaveBeenCalledWith({
          name: 'Bench Press',
          modality: 'resistance',
          muscle_group: 'Chest',
          equipment: 'Barbell',
        })
      })

      // Form should collapse after success
      await waitFor(() => {
        expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
      })
    })

    it('displays server error from createExercise', async () => {
      const user = userEvent.setup()
      vi.mocked(createExercise).mockResolvedValue({
        success: false,
        error: 'Exercise "Bench Press" already exists',
      })

      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      await user.type(screen.getByLabelText(/^name$/i), 'Bench Press')

      const modalityTrigger = screen.getByRole('combobox', { name: /modality/i })
      await selectOption(user, modalityTrigger, 'Resistance')
      await user.click(screen.getByRole('button', { name: /create exercise/i }))

      expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
    })

    it('submits successfully without muscle group or equipment', async () => {
      const user = userEvent.setup()
      vi.mocked(createExercise).mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Jab Cross', modality: 'mma', muscle_group: null, equipment: null, created_at: new Date() },
      })

      render(<ExerciseForm equipmentOptions={equipmentOptions} muscleGroupOptions={muscleGroupOptions} />)

      await expandForm(user)
      await user.type(screen.getByLabelText(/^name$/i), 'Jab Cross')

      const modalityTrigger = screen.getByRole('combobox', { name: /modality/i })
      await selectOption(user, modalityTrigger, 'MMA')
      await user.click(screen.getByRole('button', { name: /create exercise/i }))

      await waitFor(() => {
        expect(createExercise).toHaveBeenCalledWith({
          name: 'Jab Cross',
          modality: 'mma',
          muscle_group: '',
          equipment: '',
        })
      })
    })
  })
})
