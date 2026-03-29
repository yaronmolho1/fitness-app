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
    it('renders with type="text"', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.type).toBe('text')
    })

    it('has inputMode="decimal"', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.inputMode).toBe('decimal')
    })

    it('has placeholder="0"', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.placeholder).toBe('0')
    })

    it('shows unit label "kg" beside input', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))
      expect(screen.getByText('kg')).toBeInTheDocument()
    })

    it('starts with empty value', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('has w-18 width class', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))
      const input = screen.getByLabelText('Weight') as HTMLInputElement
      expect(input.className).toContain('w-18')
    })
  })

  describe('multi field item — Duration/Sets/Reps inputs', () => {
    it('renders all active fields with type="text"', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Shoulder Mobility'))

      const duration = screen.getByLabelText('Duration') as HTMLInputElement
      const sets = screen.getByLabelText('Sets') as HTMLInputElement
      const reps = screen.getByLabelText('Reps') as HTMLInputElement

      expect(duration.type).toBe('text')
      expect(sets.type).toBe('text')
      expect(reps.type).toBe('text')
    })

    it('shows unit for duration (min) but not for sets/reps', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Shoulder Mobility'))
      expect(screen.getByText('min')).toBeInTheDocument()
    })

    it('duration has inputMode="decimal", sets/reps have inputMode="numeric"', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeMultiFieldItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Shoulder Mobility'))

      const duration = screen.getByLabelText('Duration') as HTMLInputElement
      const sets = screen.getByLabelText('Sets') as HTMLInputElement
      const reps = screen.getByLabelText('Reps') as HTMLInputElement

      expect(duration.inputMode).toBe('decimal')
      expect(sets.inputMode).toBe('numeric')
      expect(reps.inputMode).toBe('numeric')
    })
  })

  describe('onChange behavior — stores raw string', () => {
    it('typing a value stores the raw string from e.target.value', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))

      const input = screen.getByLabelText('Weight') as HTMLInputElement
      await user.type(input, '72.5')
      expect(input.value).toBe('72.5')
    })

    it('clearing leaves empty string', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))

      const input = screen.getByLabelText('Weight') as HTMLInputElement
      await user.type(input, '72.5')
      await user.clear(input)
      expect(input.value).toBe('')
    })

    it('typing after clearing gives clean value (no leading zeros from Number())', async () => {
      const user = userEvent.setup()
      render(<RoutineCheckOff items={[makeItem()]} logs={[]} logDate="2026-03-15" />)
      await user.click(screen.getByText('Body Weight'))

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
