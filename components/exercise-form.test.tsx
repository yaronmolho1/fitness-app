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

// Radix Select uses pointer events; userEvent must have them enabled
async function selectOption(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement, label: string) {
  await user.click(trigger)
  const option = await screen.findByRole('option', { name: label })
  await user.click(option)
}

describe('ExerciseForm', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders all form fields', () => {
    render(<ExerciseForm />)

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByLabelText(/muscle group/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/equipment/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('modality select has three options', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm />)

    // Open the select to reveal options
    await user.click(screen.getByRole('combobox'))
    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(3)
  })

  it('shows validation error when submitting with empty name', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm />)

    await selectOption(user, screen.getByRole('combobox'), 'Resistance')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(createExercise).not.toHaveBeenCalled()
  })

  it('shows validation error when submitting without modality', async () => {
    const user = userEvent.setup()
    render(<ExerciseForm />)

    await user.type(screen.getByLabelText(/name/i), 'Bench Press')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/modality is required/i)).toBeInTheDocument()
    expect(createExercise).not.toHaveBeenCalled()
  })

  it('calls createExercise with valid data and clears form on success', async () => {
    const user = userEvent.setup()
    vi.mocked(createExercise).mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
    })

    render(<ExerciseForm />)

    await user.type(screen.getByLabelText(/name/i), 'Bench Press')
    await selectOption(user, screen.getByRole('combobox'), 'Resistance')
    await user.type(screen.getByLabelText(/muscle group/i), 'Chest')
    await user.type(screen.getByLabelText(/equipment/i), 'Barbell')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(createExercise).toHaveBeenCalledWith({
        name: 'Bench Press',
        modality: 'resistance',
        muscle_group: 'Chest',
        equipment: 'Barbell',
      })
    })

    // Form should clear after success
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('')
    })
  })

  it('displays server error from createExercise', async () => {
    const user = userEvent.setup()
    vi.mocked(createExercise).mockResolvedValue({
      success: false,
      error: 'Exercise "Bench Press" already exists',
    })

    render(<ExerciseForm />)

    await user.type(screen.getByLabelText(/name/i), 'Bench Press')
    await selectOption(user, screen.getByRole('combobox'), 'Resistance')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
  })

  it('submits successfully without muscle group or equipment', async () => {
    const user = userEvent.setup()
    vi.mocked(createExercise).mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Jab Cross', modality: 'mma', muscle_group: null, equipment: null, created_at: new Date() },
    })

    render(<ExerciseForm />)

    await user.type(screen.getByLabelText(/name/i), 'Jab Cross')
    await selectOption(user, screen.getByRole('combobox'), 'MMA')
    await user.click(screen.getByRole('button', { name: /create/i }))

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
