// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/mesocycles/queries', () => ({
  getMesocycles: vi.fn(() => []),
}))

vi.mock('@/lib/mesocycles/actions', () => ({
  activateMesocycle: vi.fn(),
  completeMesocycle: vi.fn(),
}))

vi.mock('@/components/status-transition-button', () => ({
  StatusTransitionButton: ({ status }: { status: string }) => (
    <div data-testid="status-transition">{status}</div>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/mesocycles'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

import { getMesocycles } from '@/lib/mesocycles/queries'

describe('MesocyclesPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders page heading', async () => {
    vi.mocked(getMesocycles).mockResolvedValue([])

    const { default: MesocyclesPage } = await import('./page')
    const page = await MesocyclesPage()
    render(page)

    expect(screen.getByRole('heading', { name: /mesocycles/i })).toBeInTheDocument()
  })

  it('renders empty state when no mesocycles exist', async () => {
    vi.mocked(getMesocycles).mockResolvedValue([])

    const { default: MesocyclesPage } = await import('./page')
    const page = await MesocyclesPage()
    render(page)

    expect(screen.getByText(/no mesocycles yet/i)).toBeInTheDocument()
  })

  it('renders mesocycle list with name, status, dates, work_weeks, has_deload', async () => {
    const mockMesocycles = [
      {
        id: 1,
        name: 'Hypertrophy Block',
        start_date: '2026-03-01',
        end_date: '2026-03-28',
        work_weeks: 4,
        has_deload: false,
        status: 'planned' as const,
        created_at: null,
      },
      {
        id: 2,
        name: 'Strength Phase',
        start_date: '2026-04-01',
        end_date: '2026-05-06',
        work_weeks: 5,
        has_deload: true,
        status: 'active' as const,
        created_at: null,
      },
    ]

    vi.resetModules()
    vi.doMock('@/lib/mesocycles/queries', () => ({
      getMesocycles: vi.fn(() => mockMesocycles),
    }))
    vi.doMock('next/navigation', () => ({
      usePathname: vi.fn(() => '/mesocycles'),
      useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    }))

    const { default: MesocyclesPage } = await import('./page')
    const page = await MesocyclesPage()
    render(page)

    // Names
    expect(screen.getByText('Hypertrophy Block')).toBeInTheDocument()
    expect(screen.getByText('Strength Phase')).toBeInTheDocument()

    // Statuses (rendered via StatusBadge)
    expect(screen.getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    // Dates (dd/mm/yyyy format)
    expect(screen.getByText('01/03/2026')).toBeInTheDocument()
    expect(screen.getByText('28/03/2026')).toBeInTheDocument()

    // Work weeks
    expect(screen.getByText('4 weeks')).toBeInTheDocument()
    expect(screen.getByText('5 weeks')).toBeInTheDocument()

    // Deload indicator
    expect(screen.getByText('+ deload')).toBeInTheDocument()
  })

  it('renders links to detail pages', async () => {
    const mockMesocycles = [
      {
        id: 1,
        name: 'Hypertrophy Block',
        start_date: '2026-03-01',
        end_date: '2026-03-28',
        work_weeks: 4,
        has_deload: false,
        status: 'planned' as const,
        created_at: null,
      },
    ]

    vi.resetModules()
    vi.doMock('@/lib/mesocycles/queries', () => ({
      getMesocycles: vi.fn(() => mockMesocycles),
    }))
    vi.doMock('next/navigation', () => ({
      usePathname: vi.fn(() => '/mesocycles'),
      useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    }))

    const { default: MesocyclesPage } = await import('./page')
    const page = await MesocyclesPage()
    render(page)

    const link = screen.getByRole('link', { name: /hypertrophy block/i })
    expect(link).toHaveAttribute('href', '/mesocycles/1')
  })
})
