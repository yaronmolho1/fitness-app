// T140 tests: ExercisePicker modality prop
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

describe('ExercisePicker — modality prop (T140)', () => {
  // AC6: ExercisePicker filters by modality prop
  it('filters by modality="resistance" when explicitly passed', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} modality="resistance" />)

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
    expect(screen.queryByText('Sparring')).not.toBeInTheDocument()
  })

  it('filters by modality="running"', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} modality="running" />)

    expect(screen.getByText('Easy Run')).toBeInTheDocument()
    expect(screen.getByText('Tempo Run')).toBeInTheDocument()
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
    expect(screen.queryByText('Sparring')).not.toBeInTheDocument()
  })

  it('filters by modality="mma"', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} modality="mma" />)

    expect(screen.getByText('Sparring')).toBeInTheDocument()
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
    expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
  })

  // AC9: defaults to resistance when no modality prop
  it('defaults to resistance when modality prop omitted', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} />)

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.queryByText('Easy Run')).not.toBeInTheDocument()
  })

  it('adapts placeholder text to modality', () => {
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} modality="running" />)
    expect(screen.getByPlaceholderText('Search running exercises...')).toBeInTheDocument()
  })

  it('adapts empty state text to modality', () => {
    const onlyResistance = [
      makeExercise({ id: 1, name: 'Bench Press', modality: 'resistance' }),
    ]
    render(<ExercisePicker exercises={onlyResistance} onSelect={() => {}} modality="running" />)
    expect(screen.getByText('No running exercises')).toBeInTheDocument()
  })

  it('adapts "no matching" text to modality', async () => {
    const user = userEvent.setup()
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} modality="running" />)

    await user.type(screen.getByPlaceholderText('Search running exercises...'), 'zzzzz')
    expect(screen.getByText('No matching running exercises')).toBeInTheDocument()
  })

  it('search filters within the specified modality', async () => {
    const user = userEvent.setup()
    render(<ExercisePicker exercises={mixedExercises} onSelect={() => {}} modality="running" />)

    await user.type(screen.getByPlaceholderText('Search running exercises...'), 'Easy')
    expect(screen.getByText('Easy Run')).toBeInTheDocument()
    expect(screen.queryByText('Tempo Run')).not.toBeInTheDocument()
  })
})
