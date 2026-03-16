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

const makeLog = (overrides = {}) => ({
  id: 10,
  routine_item_id: 1,
  log_date: '2026-03-15',
  status: 'done' as const,
  value_weight: 72.5,
  value_length: null,
  value_duration: null,
  value_sets: null,
  value_reps: null,
  ...overrides,
})

describe('RoutineCheckOff', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockMarkDone.mockResolvedValue({ success: true, data: makeLog() })
    mockMarkSkipped.mockResolvedValue({
      success: true,
      data: makeLog({ status: 'skipped', value_weight: null }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty state when no items', () => {
    render(<RoutineCheckOff items={[]} logs={[]} logDate="2026-03-15" />)
    expect(screen.getByText(/no routines for today/i)).toBeInTheDocument()
  })

  it('renders pending item with input fields and buttons', () => {
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('Body Weight')).toBeInTheDocument()
    expect(screen.getByLabelText('Weight')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument()
  })

  it('renders multi-field item with all configured inputs', () => {
    render(
      <RoutineCheckOff
        items={[makeMultiFieldItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByLabelText('Duration')).toBeInTheDocument()
    expect(screen.getByLabelText('Sets')).toBeInTheDocument()
    expect(screen.getByLabelText('Reps')).toBeInTheDocument()
    // Should not have weight or length
    expect(screen.queryByLabelText('Weight')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Length')).not.toBeInTheDocument()
  })

  it('shows done badge for logged items', () => {
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[makeLog()]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('72.5 kg')).toBeInTheDocument()
    // No input fields or action buttons for logged items
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument()
  })

  it('shows skipped badge for skipped items', () => {
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[makeLog({ status: 'skipped', value_weight: null })]}
        logDate="2026-03-15"
      />
    )
    const skippedElements = screen.getAllByText('Skipped')
    expect(skippedElements.length).toBeGreaterThanOrEqual(1)
  })

  it('calls markRoutineDone with entered value', async () => {
    const user = userEvent.setup()
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )

    await user.type(screen.getByLabelText('Weight'), '72.5')
    await user.click(screen.getByRole('button', { name: /done/i }))

    expect(mockMarkDone).toHaveBeenCalledWith({
      routine_item_id: 1,
      log_date: '2026-03-15',
      values: { weight: 72.5 },
    })
  })

  it('calls markRoutineSkipped on skip', async () => {
    const user = userEvent.setup()
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )

    await user.click(screen.getByRole('button', { name: /skip/i }))

    expect(mockMarkSkipped).toHaveBeenCalledWith({
      routine_item_id: 1,
      log_date: '2026-03-15',
    })
  })

  it('shows error when no values entered and done clicked', async () => {
    const user = userEvent.setup()
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )

    await user.click(screen.getByRole('button', { name: /done/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/at least one value/i)
    expect(mockMarkDone).not.toHaveBeenCalled()
  })

  it('shows error from server action', async () => {
    mockMarkDone.mockResolvedValueOnce({
      success: false,
      error: 'Already logged for this date',
    })
    const user = userEvent.setup()
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )

    await user.type(screen.getByLabelText('Weight'), '72')
    await user.click(screen.getByRole('button', { name: /done/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already logged/i)
  })

  it('renders pending items before logged items', () => {
    const item1 = makeItem({ id: 1, name: 'Body Weight' })
    const item2 = makeItem({ id: 2, name: 'Steps' })
    const log1 = makeLog({ routine_item_id: 1 })

    render(
      <RoutineCheckOff
        items={[item1, item2]}
        logs={[log1]}
        logDate="2026-03-15"
      />
    )

    const cards = screen.getAllByTestId(/routine-card-/)
    // Item 2 (pending) should come before item 1 (logged)
    expect(cards[0]).toHaveAttribute('data-testid', 'routine-card-2')
    expect(cards[1]).toHaveAttribute('data-testid', 'routine-card-1')
  })

  it('displays category badge', () => {
    render(
      <RoutineCheckOff
        items={[makeItem()]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('tracking')).toBeInTheDocument()
  })

  // T072: Weekly completion count display
  it('displays weekly count alongside frequency target for pending item', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ weeklyCount: 3, frequency_target: 5 })]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('3 / 5 this week')).toBeInTheDocument()
  })

  it('displays 0 weekly count when no logs this week', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ weeklyCount: 0, frequency_target: 5 })]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('0 / 5 this week')).toBeInTheDocument()
  })

  it('displays weekly count on logged (done) items', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ weeklyCount: 4, frequency_target: 7 })]}
        logs={[makeLog()]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('4 / 7 this week')).toBeInTheDocument()
  })

  it('displays weekly count on skipped items', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ weeklyCount: 2, frequency_target: 5 })]}
        logs={[makeLog({ status: 'skipped', value_weight: null })]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('2 / 5 this week')).toBeInTheDocument()
  })

  it('displays full completion count (7/7)', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ weeklyCount: 7, frequency_target: 7 })]}
        logs={[makeLog()]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByText('7 / 7 this week')).toBeInTheDocument()
  })

  // T073: Streak display
  it('displays streak when streak > 0 on pending item', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ streak: 5 })]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByTestId('streak-1')).toHaveTextContent('5-day streak')
  })

  it('does not display streak when streak = 0', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ streak: 0 })]}
        logs={[]}
        logDate="2026-03-15"
      />
    )
    expect(screen.queryByTestId('streak-1')).not.toBeInTheDocument()
  })

  it('displays streak on logged (done) item', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ streak: 3 })]}
        logs={[makeLog()]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByTestId('streak-1')).toHaveTextContent('3-day streak')
  })

  it('displays streak = 1 correctly', () => {
    render(
      <RoutineCheckOff
        items={[makeItem({ streak: 1 })]}
        logs={[makeLog()]}
        logDate="2026-03-15"
      />
    )
    expect(screen.getByTestId('streak-1')).toHaveTextContent('1-day streak')
  })
})
