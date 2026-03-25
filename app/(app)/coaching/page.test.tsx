// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/coaching/queries', () => ({
  getAthleteProfile: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/coaching'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('@/components/coaching/coaching-client', () => ({
  CoachingClient: ({ profile }: { profile: unknown }) => (
    <div data-testid="coaching-client" data-profile={JSON.stringify(profile)}>
      CoachingClient
    </div>
  ),
}))

import { getAthleteProfile } from '@/lib/coaching/queries'

type ProfileResult = Awaited<ReturnType<typeof getAthleteProfile>> | null

describe('CoachingPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mockProfileReturn(value: ProfileResult) {
    vi.mocked(getAthleteProfile).mockImplementation(
      () => Promise.resolve(value) as ReturnType<typeof getAthleteProfile>
    )
  }

  it('exports force-dynamic', async () => {
    const mod = await import('./page')
    expect(mod.dynamic).toBe('force-dynamic')
  })

  it('renders page heading', async () => {
    mockProfileReturn(null)

    const { default: CoachingPage } = await import('./page')
    const page = await CoachingPage()
    render(page)

    expect(
      screen.getByRole('heading', { name: /coaching/i })
    ).toBeInTheDocument()
  })

  it('calls getAthleteProfile', async () => {
    mockProfileReturn(null)

    const { default: CoachingPage } = await import('./page')
    await CoachingPage()

    expect(getAthleteProfile).toHaveBeenCalled()
  })

  it('passes profile data to client wrapper', async () => {
    const mockProfile = {
      id: 1,
      age: 30,
      weight_kg: 85,
      height_cm: 180,
      gender: 'male',
      training_age_years: 5,
      primary_goal: 'Hypertrophy',
      injury_history: null,
      created_at: new Date(),
      updated_at: new Date(),
    }

    vi.resetModules()
    vi.doMock('@/lib/coaching/queries', () => ({
      getAthleteProfile: vi.fn(() => mockProfile),
    }))
    vi.doMock('next/navigation', () => ({
      usePathname: vi.fn(() => '/coaching'),
      useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    }))

    const { default: CoachingPage } = await import('./page')
    const page = await CoachingPage()
    render(page)

    // Profile data should be rendered somewhere in the page
    expect(screen.getByTestId('coaching-client')).toBeInTheDocument()
  })
})
