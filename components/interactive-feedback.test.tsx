// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// Mock schedule actions
vi.mock('@/lib/schedule/actions', () => ({
  assignTemplate: vi.fn(),
  removeAssignment: vi.fn(),
}))

// Mock template actions
vi.mock('@/lib/templates/actions', () => ({
  createResistanceTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))

// Mock slot actions
vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: vi.fn(),
  removeExerciseSlot: vi.fn(),
  addExerciseSlot: vi.fn(),
  reorderExerciseSlots: vi.fn(),
}))

// Mock routine actions
vi.mock('@/lib/routines/actions', () => ({
  deleteRoutineItem: vi.fn(),
  markRoutineDone: vi.fn(),
  markRoutineSkipped: vi.fn(),
}))

import { ScheduleGrid } from './schedule-grid'
import { ExerciseListWithFilters } from './exercise-list-with-filters'
import { RoutineItemList } from './routine-item-list'

afterEach(cleanup)

const TRANSITION_PATTERN = /transition-colors/
const DURATION_PATTERN = /duration-150/

describe('Interactive feedback — transition classes', () => {
  describe('ScheduleGrid day cells', () => {
    it('has transition-colors duration-150 on day cells', () => {
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={[{ id: 1, name: 'Push', canonical_name: 'push', modality: 'resistance' as const }]}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )
      const cell = screen.getByTestId('day-cell-0')
      expect(cell.className).toMatch(TRANSITION_PATTERN)
      expect(cell.className).toMatch(DURATION_PATTERN)
    })
  })

  describe('ExerciseListWithFilters items', () => {
    it('has transition-colors duration-150 on exercise list rows', () => {
      const exercises = [
        { id: 1, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date('2026-01-01') },
      ]
      render(<ExerciseListWithFilters exercises={exercises} equipmentOptions={['Barbell']} muscleGroupOptions={['Legs']} />)
      // The row is the div wrapping the exercise content
      const row = screen.getByText('Squat').closest('[class*="px-4 py-3"]')
      expect(row).not.toBeNull()
      expect(row!.className).toMatch(TRANSITION_PATTERN)
      expect(row!.className).toMatch(DURATION_PATTERN)
    })
  })

  describe('RoutineItemList items', () => {
    it('has transition-colors duration-150 on routine list rows', () => {
      const items = [
        {
          routine_item: {
            id: 1,
            name: 'Stretching',
            category: null,
            has_weight: false,
            has_length: false,
            has_duration: true,
            has_sets: false,
            has_reps: false,
            frequency_target: 7,
            frequency_mode: 'weekly_target' as const,
            frequency_days: null,
            scope: 'global' as const,
            skip_on_deload: false,
            mesocycle_id: null,
            start_date: null,
            end_date: null,
            created_at: new Date('2026-01-01'),
          },
          mesocycle_name: null,
        },
      ]
      render(<RoutineItemList items={items} mesocycles={[]} />)
      const row = screen.getByText('Stretching').closest('[class*="px-4 py-3"]')
      expect(row).not.toBeNull()
      expect(row!.className).toMatch(TRANSITION_PATTERN)
      expect(row!.className).toMatch(DURATION_PATTERN)
    })
  })
})
