// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/routines/queries', () => ({
  getRoutineItems: vi.fn(() => []),
  getDistinctRoutineCategories: vi.fn(() => []),
  formatInputFields: vi.fn(() => ''),
  formatScopeSummary: vi.fn(() => ''),
}))

vi.mock('@/lib/mesocycles/queries', () => ({
  getMesocycles: vi.fn(() => []),
}))

vi.mock('@/lib/routines/actions', () => ({
  updateRoutineItem: vi.fn(),
  deleteRoutineItem: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/routines'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

import { getRoutineItems } from '@/lib/routines/queries'

describe('RoutinesPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders page heading', async () => {
    vi.mocked(getRoutineItems).mockResolvedValue([])

    const { default: RoutinesPage } = await import('./page')
    const page = await RoutinesPage()
    render(page)

    expect(
      screen.getByRole('heading', { name: /routines/i })
    ).toBeInTheDocument()
  })

  it('renders empty state when no routine items exist', async () => {
    vi.mocked(getRoutineItems).mockResolvedValue([])

    const { default: RoutinesPage } = await import('./page')
    const page = await RoutinesPage()
    render(page)

    expect(screen.getByText(/no routine items yet/i)).toBeInTheDocument()
  })

  it('renders routine items with name and edit/delete buttons', async () => {
    const mockItems = [
      {
        routine_item: {
          id: 1,
          name: 'Morning Stretch',
          category: 'mobility',
          has_weight: false,
          has_length: false,
          has_duration: true,
          has_sets: true,
          has_reps: true,
          frequency_target: 3,
          frequency_mode: 'weekly_target' as const,
          frequency_days: null,
          scope: 'global' as const,
          mesocycle_id: null,
          start_date: null,
          end_date: null,
          skip_on_deload: false,
          created_at: new Date(),
        },
        mesocycle_name: null,
      },
    ]

    vi.resetModules()
    vi.doMock('@/lib/routines/queries', () => ({
      getRoutineItems: vi.fn(() => mockItems),
      getDistinctRoutineCategories: vi.fn(() => []),
      formatInputFields: vi.fn(() => 'duration, sets, reps'),
      formatScopeSummary: vi.fn(() => 'Global'),
    }))
    vi.doMock('@/lib/mesocycles/queries', () => ({
      getMesocycles: vi.fn(() => []),
    }))
    vi.doMock('@/lib/routines/actions', () => ({
      updateRoutineItem: vi.fn(),
      deleteRoutineItem: vi.fn(),
    }))
    vi.doMock('next/navigation', () => ({
      usePathname: vi.fn(() => '/routines'),
      useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    }))

    const { default: RoutinesPage } = await import('./page')
    const page = await RoutinesPage()
    render(page)

    expect(screen.getByText('Morning Stretch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })
})
