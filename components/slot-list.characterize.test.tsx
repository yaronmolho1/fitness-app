// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/templates/slot-actions', () => ({
  updateExerciseSlot: vi.fn().mockResolvedValue({ success: true }),
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
  ...overrides,
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance' as const, muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance' as const, muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
]

describe('SlotList number inputs — characterization', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('SlotRow edit mode — field types and attributes', () => {
    async function renderEditMode(slotOverrides: Partial<SlotWithExercise> = {}) {
      const user = userEvent.setup()
      const slot = makeSlot(slotOverrides)
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      return user
    }

    it('sets input renders with type="number" and min=1', async () => {
      await renderEditMode()
      const input = screen.getByLabelText('Sets') as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('1')
    })

    it('reps input renders with type="number" and min=1', async () => {
      await renderEditMode()
      const input = screen.getByLabelText('Reps') as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('1')
    })

    it('weight input renders with type="number", min=0, step=0.5', async () => {
      await renderEditMode()
      const input = screen.getByLabelText('Weight (kg)') as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('0')
      expect(input.step).toBe('0.5')
    })

    it('RPE input renders with type="number", min=1, max=10, step=0.5', async () => {
      await renderEditMode()
      const input = screen.getByLabelText('RPE') as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('1')
      expect(input.max).toBe('10')
      expect(input.step).toBe('0.5')
    })

    it('rest input renders with type="number" and min=0', async () => {
      await renderEditMode()
      const input = screen.getByLabelText('Rest (sec)') as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('0')
    })
  })

  describe('SlotRow edit mode — initial values from slot data', () => {
    it('populates sets from slot.sets', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ sets: 5 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      expect(screen.getByLabelText('Sets')).toHaveValue(5)
    })

    it('populates reps from slot.reps (parsed to number)', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ reps: '12' })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      expect(screen.getByLabelText('Reps')).toHaveValue(12)
    })

    it('populates weight from slot.weight', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ weight: 60 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(60)
    })

    it('weight shows empty string when slot.weight is null', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ weight: null })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      // Empty string '' for type=number renders as no value
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(null)
    })

    it('RPE shows empty when slot.rpe is null', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ rpe: null })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      expect(screen.getByLabelText('RPE')).toHaveValue(null)
    })

    it('rest shows empty when slot.rest_seconds is null', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ rest_seconds: null })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))
      expect(screen.getByLabelText('Rest (sec)')).toHaveValue(null)
    })
  })

  describe('SlotRow edit mode — onChange behavior', () => {
    it('sets: clearing and typing produces Number() conversion (clearing gives 0)', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ sets: 3 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByLabelText('Sets') as HTMLInputElement
      await user.clear(input)
      // Number('') === 0, so clearing sets → 0
      expect(input).toHaveValue(0)
    })

    it('reps: clearing and typing produces Number() conversion (clearing gives 0)', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ reps: '10' })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByLabelText('Reps') as HTMLInputElement
      await user.clear(input)
      expect(input).toHaveValue(0)
    })

    it('weight: clearing produces empty value (not 0)', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ weight: 80 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByLabelText('Weight (kg)') as HTMLInputElement
      await user.clear(input)
      // onChange: e.target.value === '' ? '' : Number(e.target.value)
      // Clearing produces '' → state becomes '' → renders empty
      expect(input).toHaveValue(null)
    })

    it('RPE: clearing produces empty value (not 0)', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ rpe: 8 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByLabelText('RPE') as HTMLInputElement
      await user.clear(input)
      expect(input).toHaveValue(null)
    })

    it('rest: clearing produces empty value (not 0)', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ rest_seconds: 120 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByLabelText('Rest (sec)') as HTMLInputElement
      await user.clear(input)
      expect(input).toHaveValue(null)
    })

    it('weight: typing a number after clearing shows the number', async () => {
      const user = userEvent.setup()
      const slot = makeSlot({ weight: 80 })
      render(<SlotList slots={[slot]} templateId={1} exercises={exercises} isCompleted={false} />)
      await user.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByLabelText('Weight (kg)') as HTMLInputElement
      await user.clear(input)
      await user.type(input, '65')
      expect(input).toHaveValue(65)
    })
  })

  describe('group rest input — create superset flow', () => {
    it('group rest input renders with type="number" and min=0', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      // Enter selection mode
      await user.click(screen.getByRole('button', { name: /group/i }))
      // Select both slots
      await user.click(screen.getByRole('checkbox', { name: /select bench press/i }))
      await user.click(screen.getByRole('checkbox', { name: /select squat/i }))
      // Click create superset
      await user.click(screen.getByRole('button', { name: /create superset/i }))

      const input = screen.getByLabelText(/group rest/i) as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('0')
    })

    it('group rest input defaults to 60', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))
      await user.click(screen.getByRole('checkbox', { name: /select bench press/i }))
      await user.click(screen.getByRole('checkbox', { name: /select squat/i }))
      await user.click(screen.getByRole('button', { name: /create superset/i }))

      expect(screen.getByLabelText(/group rest/i)).toHaveValue(60)
    })

    it('group rest input: clearing gives empty, onChange uses (value === "" ? "" : Number(value))', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press' }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /group/i }))
      await user.click(screen.getByRole('checkbox', { name: /select bench press/i }))
      await user.click(screen.getByRole('checkbox', { name: /select squat/i }))
      await user.click(screen.getByRole('button', { name: /create superset/i }))

      const input = screen.getByLabelText(/group rest/i) as HTMLInputElement
      await user.clear(input)
      // '' check in onChange → state becomes ''
      expect(input).toHaveValue(null)
    })
  })

  describe('superset edit rest input', () => {
    it('edit rest input renders with type="number" and min=0', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press', group_id: 10, group_rest_seconds: 90 }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2, group_id: 10, group_rest_seconds: 90 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit rest/i }))

      const input = screen.getByLabelText(/group rest/i) as HTMLInputElement
      expect(input.type).toBe('number')
      expect(input.min).toBe('0')
    })

    it('edit rest input initializes with current group rest value', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press', group_id: 10, group_rest_seconds: 90 }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2, group_id: 10, group_rest_seconds: 90 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit rest/i }))
      expect(screen.getByLabelText(/group rest/i)).toHaveValue(90)
    })

    it('edit rest input: clearing uses Number("") → NaN (buggy: Number() without empty check)', async () => {
      const user = userEvent.setup()
      const slots = [
        makeSlot({ id: 1, order: 1, exercise_name: 'Bench Press', group_id: 10, group_rest_seconds: 90 }),
        makeSlot({ id: 2, order: 2, exercise_name: 'Squat', exercise_id: 2, group_id: 10, group_rest_seconds: 90 }),
      ]
      render(<SlotList slots={slots} templateId={1} exercises={exercises} isCompleted={false} />)

      await user.click(screen.getByRole('button', { name: /edit rest/i }))
      const input = screen.getByLabelText(/group rest/i) as HTMLInputElement
      await user.clear(input)
      // onChange: setRestInput(Number(e.target.value)) — no empty check!
      // Number('') === 0, so state becomes 0
      expect(input).toHaveValue(0)
    })
  })
})
