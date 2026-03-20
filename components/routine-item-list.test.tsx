// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}))

vi.mock('@/lib/routines/actions', () => ({
  updateRoutineItem: vi.fn(),
  deleteRoutineItem: vi.fn(),
}))

vi.mock('@/lib/mesocycles/queries', () => ({
  getMesocycles: vi.fn(() => []),
}))

import { RoutineItemList } from './routine-item-list'
import type { RoutineItemWithMesocycle } from '@/lib/routines/queries'

const makeItem = (overrides: Partial<RoutineItemWithMesocycle['routine_item']> = {}): RoutineItemWithMesocycle => ({
  routine_item: {
    id: 1,
    name: 'Morning Stretch',
    category: 'mobility',
    has_weight: false,
    has_length: false,
    has_duration: true,
    has_sets: true,
    has_reps: false,
    frequency_target: 3,
    frequency_mode: 'weekly_target' as const,
    frequency_days: null,
    scope: 'global',
    mesocycle_id: null,
    start_date: null,
    end_date: null,
    skip_on_deload: false,
    created_at: new Date(),
    ...overrides,
  },
  mesocycle_name: null,
})

describe('RoutineItemList', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty state when no items', () => {
    render(<RoutineItemList items={[]} mesocycles={[]} categories={[]} />)
    expect(screen.getByText(/no routine items yet/i)).toBeInTheDocument()
  })

  it('renders Edit button for each item', () => {
    const items = [makeItem(), makeItem({ id: 2, name: 'Body Weight' })]
    render(<RoutineItemList items={items} mesocycles={[]} categories={[]} />)

    const editButtons = screen.getAllByRole('button', { name: /edit/i })
    expect(editButtons).toHaveLength(2)
  })

  it('renders Delete button for each item', () => {
    const items = [makeItem(), makeItem({ id: 2, name: 'Body Weight' })]
    render(<RoutineItemList items={items} mesocycles={[]} categories={[]} />)

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    expect(deleteButtons).toHaveLength(2)
  })

  it('shows edit form when Edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<RoutineItemList items={[makeItem()]} mesocycles={[]} categories={[]} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))

    // Edit form should show a Save button
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    // And a Cancel button
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('hides edit form when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<RoutineItemList items={[makeItem()]} mesocycles={[]} categories={[]} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Back to showing Edit button
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('calls deleteRoutineItem when Delete is confirmed', async () => {
    const user = userEvent.setup()
    const { deleteRoutineItem } = await import('@/lib/routines/actions')
    vi.mocked(deleteRoutineItem).mockResolvedValue({ success: true })

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<RoutineItemList items={[makeItem()]} mesocycles={[]} categories={[]} />)

    await user.click(screen.getByRole('button', { name: /delete/i }))

    expect(deleteRoutineItem).toHaveBeenCalledWith(1)
  })

  it('calls updateRoutineItem on edit form submit', async () => {
    const user = userEvent.setup()
    const { updateRoutineItem } = await import('@/lib/routines/actions')
    vi.mocked(updateRoutineItem).mockResolvedValue({
      success: true,
      data: {
        id: 1, name: 'Morning Stretch', category: 'mobility',
        has_weight: false, has_length: false, has_duration: true,
        has_sets: true, has_reps: false,
        frequency_target: 3, frequency_mode: 'weekly_target' as const, frequency_days: null,
        scope: 'global',
        mesocycle_id: null, start_date: null, end_date: null,
        skip_on_deload: false, created_at: new Date(),
      },
    })

    render(<RoutineItemList items={[makeItem()]} mesocycles={[]} categories={[]} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(updateRoutineItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'Morning Stretch' })
    )
  })

  it('shows error when edit form submit fails', async () => {
    const user = userEvent.setup()
    const { updateRoutineItem } = await import('@/lib/routines/actions')
    vi.mocked(updateRoutineItem).mockResolvedValue({
      success: false,
      error: 'Name is required',
    })

    render(<RoutineItemList items={[makeItem()]} mesocycles={[]} categories={[]} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required')
  })

  it('does not call deleteRoutineItem when Delete is cancelled', async () => {
    const user = userEvent.setup()
    const { deleteRoutineItem } = await import('@/lib/routines/actions')

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<RoutineItemList items={[makeItem()]} mesocycles={[]} categories={[]} />)

    await user.click(screen.getByRole('button', { name: /delete/i }))

    expect(deleteRoutineItem).not.toHaveBeenCalled()
  })
})
