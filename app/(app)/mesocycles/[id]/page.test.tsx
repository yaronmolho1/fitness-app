// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/mesocycles/queries', () => ({
  getMesocycleById: vi.fn(),
  getMesocycleCascadeSummary: vi.fn().mockResolvedValue({ templates: 0, schedules: 0, routineItems: 0 }),
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

vi.mock('@/lib/schedule/queries', () => ({
  getScheduleForMesocycle: vi.fn().mockResolvedValue([]),
  getTemplatesForMesocycle: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/exercises/queries', () => ({
  getExercises: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/templates/slot-queries', () => ({
  getSlotsByTemplate: vi.fn().mockReturnValue([]),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/mesocycles/1'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  notFound: vi.fn(),
}))

import { getMesocycleById } from '@/lib/mesocycles/queries'

describe('MesocycleDetailPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders mesocycle detail with all fields', async () => {
    const mockMeso = {
      id: 1,
      name: 'Hypertrophy Block',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'planned' as const,
      created_at: null,
    }

    vi.mocked(getMesocycleById).mockResolvedValue(mockMeso)

    const { default: MesocycleDetailPage } = await import('./page')
    const page = await MesocycleDetailPage({ params: Promise.resolve({ id: '1' }) })
    render(page)

    expect(screen.getByRole('heading', { name: /hypertrophy block/i })).toBeInTheDocument()
    expect(screen.getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('01/03/2026')).toBeInTheDocument()
    expect(screen.getByText('28/03/2026')).toBeInTheDocument()
    expect(screen.getByText('4 weeks')).toBeInTheDocument()
  })

  it('shows deload indicator when has_deload is true', async () => {
    const mockMeso = {
      id: 2,
      name: 'Strength Phase',
      start_date: '2026-04-01',
      end_date: '2026-05-06',
      work_weeks: 5,
      has_deload: true,
      status: 'active' as const,
      created_at: null,
    }

    vi.mocked(getMesocycleById).mockResolvedValue(mockMeso)

    const { default: MesocycleDetailPage } = await import('./page')
    const page = await MesocycleDetailPage({ params: Promise.resolve({ id: '2' }) })
    render(page)

    expect(screen.getByText('+ deload')).toBeInTheDocument()
  })

  it('calls notFound when mesocycle does not exist', async () => {
    vi.mocked(getMesocycleById).mockResolvedValue(undefined)
    const { notFound } = await import('next/navigation')

    const { default: MesocycleDetailPage } = await import('./page')

    try {
      const page = await MesocycleDetailPage({ params: Promise.resolve({ id: '999' }) })
      render(page)
    } catch {
      // notFound() may throw
    }

    expect(notFound).toHaveBeenCalled()
  })

  it('renders back link to mesocycle list', async () => {
    const mockMeso = {
      id: 1,
      name: 'Test Meso',
      start_date: '2026-03-01',
      end_date: '2026-03-28',
      work_weeks: 4,
      has_deload: false,
      status: 'planned' as const,
      created_at: null,
    }

    vi.mocked(getMesocycleById).mockResolvedValue(mockMeso)

    const { default: MesocycleDetailPage } = await import('./page')
    const page = await MesocycleDetailPage({ params: Promise.resolve({ id: '1' }) })
    render(page)

    const backLink = screen.getByRole('link', { name: /mesocycles/i })
    expect(backLink).toHaveAttribute('href', '/mesocycles')
  })
})
