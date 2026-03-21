// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: vi.fn(),
  removeExerciseSlot: vi.fn(),
  addExerciseSlot: vi.fn(),
  reorderExerciseSlots: vi.fn(),
}))

vi.mock('@/lib/templates/superset-actions', () => ({
  createSuperset: vi.fn(),
  breakSuperset: vi.fn(),
  updateGroupRest: vi.fn(),
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
import { createSuperset, breakSuperset, updateGroupRest } from '@/lib/templates/superset-actions'
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
  guidelines: null,
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
  { id: 3, name: 'Row', modality: 'resistance' as const, muscle_group: 'Back', equipment: 'Barbell', created_at: new Date() },
  { id: 4, name: 'OHP', modality: 'resistance' as const, muscle_group: 'Shoulders', equipment: 'Barbell', created_at: new Date() },
]

describe('SlotList superset UI', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // === AC7: visual grouping with left border accent ===
  describe('visual grouping (AC7)', () => {
    it('renders grouped slots in a visual container with left border', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press', group_id: 1, group_rest_seconds: 90 }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Row', exercise_id: 3, group_id: 1, group_rest_seconds: 90 }),
        makeSlot({ id: 3, order: 3, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      const groupContainer = screen.getByTestId('superset-group-1')
      expect(groupContainer).toBeInTheDocument()
      // Grouped exercises should be inside the container
      expect(within(groupContainer).getByText('Bench Press')).toBeInTheDocument()
      expect(within(groupContainer).getByText('Row')).toBeInTheDocument()
      // Ungrouped slot is NOT inside the group container
      expect(within(groupContainer).queryByText('Squat')).not.toBeInTheDocument()
    })

    it('does not wrap ungrouped slots in a group container', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      expect(screen.queryByTestId(/superset-group/)).not.toBeInTheDocument()
    })
  })

  // === AC8: group label (Superset / Tri-set / Giant set) ===
  describe('group labels (AC8)', () => {
    it('labels a 2-exercise group as "Superset"', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByText('Superset')).toBeInTheDocument()
    })

    it('labels a 3-exercise group as "Tri-set"', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, order: 3, exercise_id: 3, exercise_name: 'Row', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByText('Tri-set')).toBeInTheDocument()
    })

    it('labels a 4+-exercise group as "Giant set"', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, order: 3, exercise_id: 3, exercise_name: 'Row', group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 4, order: 4, exercise_id: 4, exercise_name: 'OHP', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByText('Giant set')).toBeInTheDocument()
    })
  })

  // === AC9: group rest display ===
  describe('group rest display (AC9)', () => {
    it('shows group rest after the superset group', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 90, rest_seconds: 30 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 90, rest_seconds: 30 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      const groupContainer = screen.getByTestId('superset-group-1')
      // Group rest should display as "Group rest: 1m30s"
      expect(within(groupContainer).getByText(/group rest/i)).toBeInTheDocument()
      expect(within(groupContainer).getByText(/1m30s/)).toBeInTheDocument()
    })
  })

  // === AC10: selection mode toggle ===
  describe('selection mode (AC10)', () => {
    it('shows "Group" button when there are 2+ ungrouped slots', () => {
      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByRole('button', { name: /group/i })).toBeInTheDocument()
    })

    it('hides "Group" button when completed', () => {
      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={true} />)
      expect(screen.queryByRole('button', { name: /group/i })).not.toBeInTheDocument()
    })

    it('shows checkboxes on ungrouped slots when "Group" is clicked', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
        makeSlot({ id: 3, order: 3, exercise_id: 3, exercise_name: 'Row', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))

      // Ungrouped slots get checkboxes
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2) // only ungrouped slots
    })

    it('exits selection mode on Cancel', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))
      expect(screen.getAllByRole('checkbox')).toHaveLength(2)

      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  // === AC11: create superset from selection ===
  describe('create superset (AC11)', () => {
    it('shows "Create Superset" button when 2+ slots selected', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
        makeSlot({ id: 3, order: 3, exercise_id: 3, exercise_name: 'Row' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))

      // Select 2 checkboxes
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      expect(screen.getByRole('button', { name: /create superset/i })).toBeInTheDocument()
    })

    it('does not show "Create Superset" with fewer than 2 selected', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))

      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])

      expect(screen.queryByRole('button', { name: /create superset/i })).not.toBeInTheDocument()
    })

    it('prompts for group rest and calls createSuperset', async () => {
      const user = userEvent.setup()
      vi.mocked(createSuperset).mockResolvedValue({ success: true })

      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))

      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])

      await user.click(screen.getByRole('button', { name: /create superset/i }))

      // Should see group rest input
      const restInput = screen.getByLabelText(/group rest/i)
      expect(restInput).toBeInTheDocument()
      await user.clear(restInput)
      await user.type(restInput, '90')

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(createSuperset).toHaveBeenCalledWith({
          slot_ids: [1, 2],
          group_rest_seconds: 90,
        })
      })
    })

    it('shows error when createSuperset fails', async () => {
      const user = userEvent.setup()
      vi.mocked(createSuperset).mockResolvedValue({ success: false, error: 'Slots must be contiguous in order' })

      const slots = [
        makeSlot({ id: 1, order: 1 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      await user.click(checkboxes[1])
      await user.click(screen.getByRole('button', { name: /create superset/i }))

      const restInput = screen.getByLabelText(/group rest/i)
      await user.clear(restInput)
      await user.type(restInput, '90')
      await user.click(screen.getByRole('button', { name: /confirm/i }))

      expect(await screen.findByText(/slots must be contiguous/i)).toBeInTheDocument()
    })
  })

  // === AC5: break superset ===
  describe('break superset (AC5)', () => {
    it('shows "Break" button on superset group', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      const groupContainer = screen.getByTestId('superset-group-1')
      expect(within(groupContainer).getByRole('button', { name: /break/i })).toBeInTheDocument()
    })

    it('calls breakSuperset when "Break" clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(breakSuperset).mockResolvedValue({ success: true })

      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      const groupContainer = screen.getByTestId('superset-group-1')
      await user.click(within(groupContainer).getByRole('button', { name: /break/i }))

      await waitFor(() => {
        expect(breakSuperset).toHaveBeenCalledWith({
          group_id: 1,
          template_id: 1,
        })
      })
    })

    it('hides "Break" button when completed', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={true} />)

      const groupContainer = screen.getByTestId('superset-group-1')
      expect(within(groupContainer).queryByRole('button', { name: /break/i })).not.toBeInTheDocument()
    })
  })

  // === AC6: edit group rest ===
  describe('edit group rest (AC6)', () => {
    it('allows editing group rest and calls updateGroupRest', async () => {
      const user = userEvent.setup()
      vi.mocked(updateGroupRest).mockResolvedValue({ success: true })

      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      const groupContainer = screen.getByTestId('superset-group-1')
      // Click edit rest button
      await user.click(within(groupContainer).getByRole('button', { name: /edit rest/i }))

      const restInput = within(groupContainer).getByLabelText(/group rest/i)
      await user.clear(restInput)
      await user.type(restInput, '120')
      await user.click(within(groupContainer).getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(updateGroupRest).toHaveBeenCalledWith({
          group_id: 1,
          template_id: 1,
          group_rest_seconds: 120,
        })
      })
    })
  })

  // === Multiple groups ===
  describe('multiple groups', () => {
    it('renders separate containers for different group_ids', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 2, order: 2, exercise_id: 2, exercise_name: 'Squat', group_id: 1, group_rest_seconds: 60 }),
        makeSlot({ id: 3, order: 3, exercise_id: 3, exercise_name: 'Row' }),
        makeSlot({ id: 4, order: 4, exercise_id: 4, exercise_name: 'OHP', group_id: 2, group_rest_seconds: 120 }),
        makeSlot({ id: 5, order: 5, exercise_id: 1, exercise_name: 'Bench Press 2', group_id: 2, group_rest_seconds: 120 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      expect(screen.getByTestId('superset-group-1')).toBeInTheDocument()
      expect(screen.getByTestId('superset-group-2')).toBeInTheDocument()
    })
  })
})
