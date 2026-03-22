// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

const mockMarkDone = vi.fn()
const mockMarkSkipped = vi.fn()

vi.mock('@/lib/routines/actions', () => ({
  markRoutineDone: (...args: unknown[]) => mockMarkDone(...args),
  markRoutineSkipped: (...args: unknown[]) => mockMarkSkipped(...args),
}))

import { RoutineCheckOff } from './routine-check-off'

const makeItem = (overrides = {}) => ({
  id: 1,
  name: 'Body Weight',
  category: 'tracking',
  has_weight: true,
  has_length: false,
  has_duration: false,
  has_sets: false,
  has_reps: false,
  frequency_target: 5,
  weeklyCount: 0,
  streak: 0,
  ...overrides,
})

const makeMultiFieldItem = (overrides = {}) => ({
  id: 2,
  name: 'Shoulder Mobility',
  category: 'mobility',
  has_weight: false,
  has_length: false,
  has_duration: true,
  has_sets: true,
  has_reps: true,
  frequency_target: 5,
  weeklyCount: 0,
  streak: 0,
  ...overrides,
})

describe('RoutineCheckOff number inputs — characterization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMarkDone.mockResolvedValue({ success: true, data: {} })
    mockMarkSkipped.mockResolvedValue({ success: true, data: {} })
  })

  afterEach(() => cleanup())

  describe('single field item — Weight input attributes', () => {
    it('renders with type="number"', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.type).toBe('number')
    })

    it('has inputMode="decimal"', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.inputMode).toBe('decimal')
    })

    it('has step="0.1" and min="0"', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.step).toBe('0.1')
      expect(input.min).toBe('0')
    })

    it('has placeholder="0"', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.placeholder).toBe('0')
    })

    it('shows unit label "kg" beside input', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      expect(screen.getByText('kg')).toBeInTheDocument()
    })

    it('starts with empty value', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('has w-20 width class', () => {
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.className).toContain('w-20')
    })
  })

  describe('multi field item — Duration/Sets/Reps inputs', () => {
    it('renders all active fields with type="number"', () => {
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)

      const duration = screen.getByLabelText('Duration') as HTMLInputElement
      const sets = screen.getByLabelText('Sets') as HTMLInputElement
      const reps = screen.getByLabelText('Reps') as HTMLInputElement

      expect(duration.type).toBe('number')
      expect(sets.type).toBe('number')
      expect(reps.type).toBe('number')
    })

    it('duration has step=0.1, sets and reps have step=1', () => {
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)

      const duration = screen.getByLabelText('Duration') as HTMLInputElement
      const sets = screen.getByLabelText('Sets') as HTMLInputElement
      const reps = screen.getByLabelText('Reps') as HTMLInputElement

      expect(duration.step).toBe('0.1')
      expect(sets.step).toBe('1')
      expect(reps.step).toBe('1')
    })

    it('shows unit for duration (min) but not for sets/reps', () => {
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)
      expect(screen.getByText('min')).toBeInTheDocument()
    })

    it('all inputs have inputMode="decimal"', () => {
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)

      const duration = screen.getByLabelText('Duration') as HTMLInputElement
      const sets = screen.getByLabelText('Sets') as HTMLInputElement
      const reps = screen.getByLabelText('Reps') as HTMLInputElement

      expect(duration.inputMode).toBe('decimal')
      expect(sets.inputMode).toBe('decimal')
      expect(reps.inputMode).toBe('decimal')
    })
  })

  describe('onChange behavior — stores raw string', () => {
    it('typing a value stores the raw string from e.target.value', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)

      const input = screen.getByLabelText('Weight') as HTMLInputElement
      await user.type(input, '72.5')
      expect(input.value).toBe('72.5')
    })

    it('clearing leaves empty string', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)

      const input = screen.getByLabelText('Weight') as HTMLInputElement
      await user.type(input, '72.5')
      await user.clear(input)
      expect(input.value).toBe('')
    })

    it('typing after clearing gives clean value (no leading zeros from Number())', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)

      const input = screen.getByLabelText('Weight') as HTMLInputElement
      await user.type(input, '65')
      expect(input.value).toBe('65')
    })
  })

  describe('inputs hidden for logged items', () => {
    it('does not show number inputs when item has a log', () => {
      const item = makeItem()
      const log = {
        id: 10,
        routine_item_id: 1,
        log_date: '2026-03-15',
        status: 'done' as const,
        value_weight: 72.5,
        value_length: null,
        value_duration: null,
        value_sets: null,
        value_reps: null,
      }
      render(<RoutineCheckOff items={[item]} logs={[log]} logDate="2026-03-15" />)
      expect(screen.queryByLabelText('Weight')).not.toBeInTheDocument()
    })
  })
})
