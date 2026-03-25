// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

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

const mockGetTransferTargets = vi.fn()
const mockCopyExerciseSlots = vi.fn()
const mockMoveExerciseSlots = vi.fn()
vi.mock('@/lib/templates/transfer-actions', () => ({
  copyExerciseSlots: (...args: unknown[]) => mockCopyExerciseSlots(...args),
  moveExerciseSlots: (...args: unknown[]) => mockMoveExerciseSlots(...args),
  getTransferTargets: (...args: unknown[]) => mockGetTransferTargets(...args),
}))

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('sonner', () => ({
  toast: mockToast,
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
  overrideCount: 0,
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
]

const defaultTargets = [
  {
    id: 1,
    name: 'Hypertrophy Block',
    status: 'active',
    templates: [
      { id: 10, name: 'Push A', modality: 'resistance', sections: [] },
      { id: 11, name: 'Mixed Day', modality: 'mixed', sections: [{ id: 100, section_name: 'Strength', order: 1 }] },
    ],
  },
]

describe('SlotList — transfer actions (T149)', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    mockGetTransferTargets.mockReturnValue(defaultTargets)
    mockCopyExerciseSlots.mockResolvedValue({ success: true, data: [] })
    mockMoveExerciseSlots.mockResolvedValue({ success: true, data: [] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows "Copy to..." and "Move to..." buttons in display mode for non-completed slots', () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)
    expect(screen.getByRole('button', { name: /copy to/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move to/i })).toBeInTheDocument()
  })

  it('shows copy but hides move for completed mesocycles', () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={true} />)
    expect(screen.getByRole('button', { name: /copy to/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move to/i })).not.toBeInTheDocument()
  })

  it('"Copy to..." opens target picker modal', async () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)
    await user.click(screen.getByRole('button', { name: /copy to/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Copy to...' })).toBeInTheDocument()
  })

  it('"Move to..." opens target picker modal with move mode', async () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)
    await user.click(screen.getByRole('button', { name: /move to/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Move to...' })).toBeInTheDocument()
  })

  it('calls copyExerciseSlots on copy confirm and shows success toast', async () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /copy to/i }))
    // Select mesocycle
    await user.click(screen.getByText('Hypertrophy Block'))
    // Select template
    await user.click(screen.getByText('Push A'))
    // Confirm
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockCopyExerciseSlots).toHaveBeenCalledWith({
        slotIds: [1],
        targetTemplateId: 10,
        targetSectionId: undefined,
      })
    })
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Copied'))
    })
  })

  it('calls moveExerciseSlots on move confirm and shows success toast', async () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /move to/i }))
    await user.click(screen.getByText('Hypertrophy Block'))
    await user.click(screen.getByText('Push A'))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockMoveExerciseSlots).toHaveBeenCalledWith({
        slotIds: [1],
        targetTemplateId: 10,
        targetSectionId: undefined,
      })
    })
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Moved'))
    })
  })

  it('shows error toast on failed transfer', async () => {
    mockCopyExerciseSlots.mockResolvedValue({ success: false, error: 'Cannot copy to a completed mesocycle' })

    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /copy to/i }))
    await user.click(screen.getByText('Hypertrophy Block'))
    await user.click(screen.getByText('Push A'))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Cannot copy to a completed mesocycle')
    })
  })

  it('passes targetSectionId for mixed templates', async () => {
    render(<SlotList slots={[makeSlot()]} templateId={1} exercises={exercises} isCompleted={false} />)

    await user.click(screen.getByRole('button', { name: /copy to/i }))
    await user.click(screen.getByText('Hypertrophy Block'))
    await user.click(screen.getByText('Mixed Day'))
    // Should show section step
    await user.click(screen.getByText('Strength'))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(mockCopyExerciseSlots).toHaveBeenCalledWith({
        slotIds: [1],
        targetTemplateId: 11,
        targetSectionId: 100,
      })
    })
  })

  it('transfers all superset group members when slot has group_id', async () => {
    const slots = [
      makeSlot({ id: 1, group_id: 1, order: 1, exercise_name: 'Bench Press' }),
      makeSlot({ id: 2, group_id: 1, order: 2, exercise_id: 2, exercise_name: 'Flyes' }),
    ]

    render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

    // Find the copy button for the first slot in the superset
    const copyButtons = screen.getAllByRole('button', { name: /copy to/i })
    await user.click(copyButtons[0])

    // Should ask about group transfer
    expect(screen.getByRole('button', { name: /entire superset/i })).toBeInTheDocument()
  })
})
