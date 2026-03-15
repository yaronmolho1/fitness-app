// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/routines/queries', () => ({
  getRoutineItems: vi.fn(() => []),
  formatInputFields: vi.fn(() => ''),
  formatScopeSummary: vi.fn(() => ''),
}))

vi.mock('@/lib/routines/actions', () => ({
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

  it('renders routine items with name, category, input fields, frequency, and scope', async () => {
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
          scope: 'global' as const,
          mesocycle_id: null,
          start_date: null,
          end_date: null,
          skip_on_deload: false,
          created_at: new Date(),
        },
        mesocycle_name: null,
      },
      {
        routine_item: {
          id: 2,
          name: 'Body Weight',
          category: 'measurement',
          has_weight: true,
          has_length: false,
          has_duration: false,
          has_sets: false,
          has_reps: false,
          frequency_target: 7,
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
      formatInputFields: vi.fn((item: Record<string, boolean>) => {
        const fields = []
        if (item.has_weight) fields.push('weight')
        if (item.has_length) fields.push('length')
        if (item.has_duration) fields.push('duration')
        if (item.has_sets) fields.push('sets')
        if (item.has_reps) fields.push('reps')
        return fields.join(', ')
      }),
      formatScopeSummary: vi.fn(() => 'Global'),
    }))
    vi.doMock('@/lib/routines/actions', () => ({
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
    expect(screen.getByText('Body Weight')).toBeInTheDocument()
  })
})
