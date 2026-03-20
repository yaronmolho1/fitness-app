// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/exercises/queries', () => ({
  getExercises: vi.fn(() => []),
  getDistinctExerciseValues: vi.fn(() => ({ equipment: [], muscle_groups: [] })),
}))

vi.mock('@/lib/exercises/actions', () => ({
  createExercise: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/exercises'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

import { getExercises } from '@/lib/exercises/queries'

describe('ExercisesPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders empty state when no exercises exist', async () => {
    vi.mocked(getExercises).mockResolvedValue([])

    const { default: ExercisesPage } = await import('./page')
    const page = await ExercisesPage()
    render(page)

    expect(screen.getByText(/no exercises yet/i)).toBeInTheDocument()
    expect(screen.getByText(/create your first exercise/i)).toBeInTheDocument()
  })

  it('renders exercise list with name, modality, muscle group, and equipment', async () => {
    const mockExercises = [
      { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
      { id: 2, name: '5K Run', modality: 'running', muscle_group: null, equipment: null, created_at: new Date() },
    ]

    vi.resetModules()
    vi.doMock('@/lib/exercises/queries', () => ({
      getExercises: vi.fn(() => mockExercises),
      getDistinctExerciseValues: vi.fn(() => ({ equipment: ['Barbell'], muscle_groups: ['Chest'] })),
    }))
    vi.doMock('@/lib/exercises/actions', () => ({
      createExercise: vi.fn(),
    }))
    vi.doMock('next/navigation', () => ({
      usePathname: vi.fn(() => '/exercises'),
      useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
    }))

    const { default: ExercisesPage } = await import('./page')
    const page = await ExercisesPage()
    render(page)

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('resistance')).toBeInTheDocument()
    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getByText('Barbell')).toBeInTheDocument()
    expect(screen.getByText('5K Run')).toBeInTheDocument()
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('renders page heading', async () => {
    vi.mocked(getExercises).mockResolvedValue([])

    const { default: ExercisesPage } = await import('./page')
    const page = await ExercisesPage()
    render(page)

    expect(screen.getByRole('heading', { name: /exercises/i })).toBeInTheDocument()
  })
})
