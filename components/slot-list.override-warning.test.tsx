// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

const mockUpdateExerciseSlot = vi.fn()

vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: (...args: unknown[]) => mockUpdateExerciseSlot(...args),
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
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

const makeSlot = (overrides: Partial<SlotWithExercise> = {}): SlotWithExercise => ({
  id: 1,
  template_id: 1,
  exercise_id: 1,
  section_id: null,
  sets: 3,
  reps: '10',
  weight: 60,
  rpe: 8,
  rest_seconds: 120,
  group_id: null,
  group_rest_seconds: null,
  guidelines: null,
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  duration: null,
  overrideCount: 0,
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
]

describe('SlotList — override warning dialog (T158)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows warning dialog when editing a slot with overrides and changing training params', async () => {
    const user = userEvent.setup()
    const slot = makeSlot({ overrideCount: 3 })

    mockUpdateExerciseSlot.mockResolvedValue({ success: true, data: { ...slot, weight: 65 } })

    render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /edit/i }))

    // Change weight
    const weightInput = screen.getByLabelText(/weight/i)
    await user.clear(weightInput)
    await user.type(weightInput, '65')

    // Click Save
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // Should show the warning dialog
    await waitFor(() => {
      expect(screen.getByText(/per-week progression/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /keep overrides/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('calls SA without clearOverrides when "Keep Overrides" is clicked', async () => {
    const user = userEvent.setup()
    const slot = makeSlot({ overrideCount: 2 })

    mockUpdateExerciseSlot.mockResolvedValue({ success: true, data: { ...slot, weight: 65 } })

    render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /edit/i }))

    const weightInput = screen.getByLabelText(/weight/i)
    await user.clear(weightInput)
    await user.type(weightInput, '65')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/per-week progression/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /keep overrides/i }))

    await waitFor(() => {
      expect(mockUpdateExerciseSlot).toHaveBeenCalledWith(
        expect.not.objectContaining({ clearOverrides: true })
      )
    })
  })

  it('calls SA with clearOverrides=true when "Clear All" is clicked', async () => {
    const user = userEvent.setup()
    const slot = makeSlot({ overrideCount: 2 })

    mockUpdateExerciseSlot.mockResolvedValue({ success: true, data: { ...slot, weight: 65 } })

    render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /edit/i }))

    const weightInput = screen.getByLabelText(/weight/i)
    await user.clear(weightInput)
    await user.type(weightInput, '65')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.getByText(/per-week progression/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /clear all/i }))

    await waitFor(() => {
      expect(mockUpdateExerciseSlot).toHaveBeenCalledWith(
        expect.objectContaining({ clearOverrides: true })
      )
    })
  })

  it('saves directly without dialog when slot has no overrides', async () => {
    const user = userEvent.setup()
    const slot = makeSlot() // no overrideCount → 0

    mockUpdateExerciseSlot.mockResolvedValue({ success: true, data: { ...slot, weight: 65 } })

    render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /edit/i }))

    const weightInput = screen.getByLabelText(/weight/i)
    await user.clear(weightInput)
    await user.type(weightInput, '65')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // SA should be called directly, no dialog
    await waitFor(() => {
      expect(mockUpdateExerciseSlot).toHaveBeenCalled()
    })

    // No dialog text should appear
    expect(screen.queryByText(/per-week progression/i)).not.toBeInTheDocument()
  })

  it('does not show dialog when only non-training params change (guidelines)', async () => {
    const user = userEvent.setup()
    const slot = makeSlot({ overrideCount: 2 })

    mockUpdateExerciseSlot.mockResolvedValue({ success: true, data: { ...slot, guidelines: 'New tip' } })

    render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /actions/i }))
    await user.click(screen.getByRole('menuitem', { name: /edit/i }))

    const guidelinesInput = screen.getByLabelText(/guidelines/i)
    await user.clear(guidelinesInput)
    await user.type(guidelinesInput, 'New tip')

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    // SA should be called directly, no dialog
    await waitFor(() => {
      expect(mockUpdateExerciseSlot).toHaveBeenCalled()
    })

    expect(screen.queryByText(/per-week progression/i)).not.toBeInTheDocument()
  })
})
