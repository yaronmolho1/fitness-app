// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: vi.fn(),
  removeExerciseSlot: vi.fn(),
  addExerciseSlot: vi.fn(),
  reorderExerciseSlots: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/templates/cascade-actions', () => ({
  getCascadePreview: vi.fn().mockResolvedValue({
    success: true,
    data: { totalTargets: 0, skippedCount: 0, targets: [] },
  }),
}))

vi.mock('@/lib/templates/cascade-slot-params', () => ({
  cascadeSlotParams: vi.fn(),
}))

vi.mock('@/lib/templates/cascade-slot-ops', () => ({
  cascadeAddSlot: vi.fn(),
  cascadeRemoveSlot: vi.fn(),
}))

import { SlotList } from './slot-list'
import { addExerciseSlot } from '@/lib/templates/slot-actions'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

const makeSlot = (overrides: Partial<SlotWithExercise> = {}): SlotWithExercise => ({
  id: 1,
  template_id: 1,
  exercise_id: 1,
  section_id: null,
  sets: 3,
  reps: '10',
  weight: 80,
  rpe: 8,
  rest_seconds: 120,
  group_id: null,
  group_rest_seconds: null,
  guidelines: 'Slow eccentric',
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  duration: null,
  overrideCount: 0,
  ...overrides,
})

const resistanceExercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
]

const runningExercises = [
  { id: 3, name: '5K Run', modality: 'running' as const, muscle_group: null, equipment: null, created_at: new Date() },
]

describe('SlotList — T143 section context', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('passes sectionId to addExerciseSlot when provided', async () => {
    const user = userEvent.setup()
    const mockAdd = vi.mocked(addExerciseSlot).mockResolvedValue({
      success: true,
      data: makeSlot({ id: 99, exercise_id: 1 }),
    })

    render(
      <SlotList
        slots={[]}
        templateId={1}
        exercises={resistanceExercises}
        isCompleted={false}
        sectionId={42}
      />
    )

    await user.click(screen.getByRole('button', { name: /add exercise/i }))
    await user.click(screen.getByText('Bench Press'))

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ section_id: 42 })
      )
    })
  })

  it('does NOT pass section_id when sectionId prop is omitted', async () => {
    const user = userEvent.setup()
    const mockAdd = vi.mocked(addExerciseSlot).mockResolvedValue({
      success: true,
      data: makeSlot({ id: 99, exercise_id: 1 }),
    })

    render(
      <SlotList
        slots={[]}
        templateId={1}
        exercises={resistanceExercises}
        isCompleted={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /add exercise/i }))
    await user.click(screen.getByText('Bench Press'))

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledWith(
        expect.not.objectContaining({ section_id: expect.anything() })
      )
    })
  })

  it('passes modality to ExercisePicker when provided', async () => {
    const user = userEvent.setup()

    render(
      <SlotList
        slots={[]}
        templateId={1}
        exercises={[...resistanceExercises, ...runningExercises]}
        isCompleted={false}
        modality="running"
      />
    )

    await user.click(screen.getByRole('button', { name: /add exercise/i }))

    expect(screen.getByPlaceholderText(/search running exercises/i)).toBeInTheDocument()
  })

  it('defaults ExercisePicker to resistance when modality not provided', async () => {
    const user = userEvent.setup()

    render(
      <SlotList
        slots={[]}
        templateId={1}
        exercises={resistanceExercises}
        isCompleted={false}
      />
    )

    await user.click(screen.getByRole('button', { name: /add exercise/i }))

    expect(screen.getByPlaceholderText(/search resistance exercises/i)).toBeInTheDocument()
  })
})
