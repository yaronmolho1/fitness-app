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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { SlotList } from './slot-list'
import { updateExerciseSlot, removeExerciseSlot } from '@/lib/templates/slot-actions'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

const makeSlot = (overrides: Partial<SlotWithExercise> = {}): SlotWithExercise => ({
  id: 1,
  template_id: 1,
  exercise_id: 1,
  sets: 3,
  reps: '10',
  weight: 80,
  rpe: 8,
  rest_seconds: 120,
  guidelines: 'Slow eccentric',
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
]

describe('SlotList', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('shows empty state when no slots exist', () => {
      render(<SlotList slots={[]} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByText(/no exercises added/i)).toBeInTheDocument()
      expect(screen.getByText(/add your first exercise/i)).toBeInTheDocument()
    })

    it('shows add exercise button in empty state', () => {
      render(<SlotList slots={[]} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByRole('button', { name: /add exercise/i })).toBeInTheDocument()
    })
  })

  describe('slot display', () => {
    it('renders slot with exercise name and targets', () => {
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      expect(screen.getByText('Bench Press')).toBeInTheDocument()
      expect(screen.getByText(/3×10/)).toBeInTheDocument()
      expect(screen.getByText(/80/)).toBeInTheDocument()
      expect(screen.getByText(/RPE 8/)).toBeInTheDocument()
    })

    it('renders multiple slots in order', () => {
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2, sets: 5, reps: '5' }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      const items = screen.getAllByTestId('slot-row')
      expect(items).toHaveLength(2)
      expect(within(items[0]).getByText('Bench Press')).toBeInTheDocument()
      expect(within(items[1]).getByText('Squat')).toBeInTheDocument()
    })

    it('handles optional fields being null', () => {
      const slot = makeSlot({ weight: null, rpe: null, rest_seconds: null, guidelines: null })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      expect(screen.getByText('Bench Press')).toBeInTheDocument()
      expect(screen.getByText(/3×10/)).toBeInTheDocument()
      // Should not crash or show "null"
      expect(screen.queryByText('null')).not.toBeInTheDocument()
    })
  })

  describe('slot editing', () => {
    it('enters edit mode when edit button clicked', async () => {
      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      // Should show input fields
      expect(screen.getByLabelText(/sets/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/reps/i)).toBeInTheDocument()
    })

    it('pre-populates edit fields with current values', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ sets: 4, reps: '8', weight: 100, rpe: 9, rest_seconds: 90, guidelines: 'Go slow' })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      expect(screen.getByLabelText(/sets/i)).toHaveValue(4)
      expect(screen.getByLabelText(/reps/i)).toHaveValue(8)
      expect(screen.getByLabelText(/weight/i)).toHaveValue(100)
      expect(screen.getByLabelText(/rpe/i)).toHaveValue(9)
      expect(screen.getByLabelText(/rest/i)).toHaveValue(90)
      expect(screen.getByLabelText(/guidelines/i)).toHaveValue('Go slow')
    })

    it('calls updateExerciseSlot on save', async () => {
      const user = userEvent.setup()
      vi.mocked(updateExerciseSlot).mockResolvedValue({
        success: true,
        data: makeSlot({ sets: 5 }),
      })

      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      const setsInput = screen.getByLabelText(/sets/i)
      await user.clear(setsInput)
      await user.type(setsInput, '5')
      await user.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(updateExerciseSlot).toHaveBeenCalledWith(expect.objectContaining({ id: 1, sets: 5 }))
      })
    })

    it('cancels edit without saving', async () => {
      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      // Back to display mode
      expect(screen.queryByLabelText(/sets/i)).not.toBeInTheDocument()
      expect(updateExerciseSlot).not.toHaveBeenCalled()
    })

    it('shows error from failed update', async () => {
      const user = userEvent.setup()
      vi.mocked(updateExerciseSlot).mockResolvedValue({
        success: false,
        error: 'Sets must be positive',
      })

      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit/i }))
      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByText(/sets must be positive/i)).toBeInTheDocument()
    })
  })

  describe('slot removal', () => {
    it('shows confirmation before removing', async () => {
      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /remove/i }))
      // Text is split across elements (<strong>), use a function matcher on <p>
      expect(screen.getByText((_content, el) =>
        el?.tagName === 'P' &&
        (el?.textContent?.toLowerCase().includes('remove') &&
        el?.textContent?.toLowerCase().includes('bench press') || false)
      )).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    it('calls removeExerciseSlot on confirm', async () => {
      const user = userEvent.setup()
      vi.mocked(removeExerciseSlot).mockResolvedValue({ success: true })

      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /remove/i }))
      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(removeExerciseSlot).toHaveBeenCalledWith(1)
      })
    })

    it('cancels removal without deleting', async () => {
      const user = userEvent.setup()
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /remove/i }))
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(removeExerciseSlot).not.toHaveBeenCalled()
      // Back to normal display — confirmation prompt gone
      expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
    })
  })

  describe('completed mesocycle', () => {
    it('hides edit and remove buttons when completed', () => {
      const slot = makeSlot()
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={true} />)

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    })

    it('hides add exercise button when completed', () => {
      render(<SlotList slots={[]} templateId={1} exercises={exercises} isCompleted={true} />)
      expect(screen.queryByRole('button', { name: /add exercise/i })).not.toBeInTheDocument()
    })
  })
})
