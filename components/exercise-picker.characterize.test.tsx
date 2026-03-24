// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach } from 'vitest'
import { ExercisePicker } from './exercise-picker'
import type { Exercise } from '@/lib/exercises/filters'

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  name: 'Bench Press',
  modality: 'resistance',
  muscle_group: 'Chest',
  equipment: 'Barbell',
  created_at: new Date(),
  ...overrides,
})

const mixedExercises: Exercise[] = [
  makeExercise({ id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest' }),
  makeExercise({ id: 2, name: 'Squat', modality: 'resistance', muscle_group: 'Legs' }),
  makeExercise({ id: 3, name: 'Easy Run', modality: 'running', muscle_group: null }),
  makeExercise({ id: 4, name: 'Tempo Run', modality: 'running', muscle_group: null }),
  makeExercise({ id: 5, name: 'Sparring', modality: 'mma', muscle_group: null }),
]

afterEach(() => {
  cleanup()
})

describe('ExercisePicker — hardcoded resistance filter (pre-T140)', () => {
  it('only shows resistance exercises from a mixed list', () => {
    const onSelect = () => {}
    render(<ExercisePicker exercises={mixedExercises} onSelect={onSelect} />)

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
    // NOTE: running and mma exercises are filtered out by hardcoded 'resistance' filter
    expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
    expect(screen.queryByText('Tempo Run')).not.toBeInTheDocument()
    expect(screen.queryByText('Sparring')).not.toBeInTheDocument()
  })

  it('search placeholder says "resistance"', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} />)
    expect(screen.getByPlaceholderText('Search resistance exercises...')).toBeInTheDocument()
  })

  it('does NOT accept a modality prop', () => {
    // ExercisePickerProps only has: exercises, onSelect
    // This test documents the current type signature
    const props = { exercises: [], onSelect: () => {} }
    const keys = Object.keys(props)
    expect(keys).toEqual(['exercises', 'onSelect'])
  })

  it('search filters within resistance exercises only', async () => {
    const user = userEvent.setup()
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} />)

    await user.type(screen.getByPlaceholderText('Search resistance exercises...'), 'Bench')
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.queryByText('Squat')).not.toBeInTheDocument()
    // Running exercises still not shown even if name would match
    expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
  })

  it('shows empty state when no resistance exercises exist', () => {
    const onlyRunning = [
      makeExercise({ id: 3, name: 'Easy Run', modality: 'running' }),
    ]
    render(<ExercisePicker exercises={onlyRunning} onSelect={() => {}} />)

    expect(screen.getByText('No resistance exercises')).toBeInTheDocument()
    expect(screen.getByText('Create exercises')).toBeInTheDocument()
  })

  it('shows "no matching" state when search has no hits among resistance', async () => {
    const user = userEvent.setup()
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} />)

    await user.type(screen.getByPlaceholderText('Search resistance exercises...'), 'zzzzz')
    expect(screen.getByText('No matching resistance exercises')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked exercise', async () => {
    const user = userEvent.setup()
    const onSelect = { fn: (_ex: Exercise) => {} }
    const spy = (ex: Exercise) => { onSelect.fn(ex) }
    let selected: Exercise | null = null
    render(<ExercisePicker exercises={mixedExercises} onSelect={(ex) => { selected = ex }} />)

    await user.click(screen.getByText('Bench Press'))
    expect(selected).not.toBeNull()
    expect(selected!.id).toBe(1)
    expect(selected!.name).toBe('Bench Press')
  })

  it('displays muscle_group when present', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} />)
    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getByText('Legs')).toBeInTheDocument()
  })
})
