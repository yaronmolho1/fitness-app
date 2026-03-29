// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MixedLoggingForm } from './mixed-logging-form'
import type { MixedWorkoutData } from './mixed-logging-form'
import type { SectionData } from '@/lib/today/queries'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/workouts/actions', () => ({
  saveMixedWorkout: vi.fn().mockResolvedValue({ success: true }),
}))

function makeResistanceSection(overrides: Partial<SectionData> = {}): SectionData {
  return {
    id: 1,
    section_name: 'Strength',
    modality: 'resistance',
    order: 1,
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    target_distance: null,
    target_duration: null,
    target_elevation_gain: null,
    planned_duration: null,
    slots: [
      {
        id: 1,
        exercise_id: 10,
        exercise_name: 'Squat',
        sets: 3,
        reps: '5',
        weight: 100,
        rpe: 8,
        rest_seconds: 180,
        group_id: null,
        group_rest_seconds: null,
        guidelines: null,
        order: 1,
        is_main: true,
      },
    ],
    ...overrides,
  }
}

function makeRunningSection(overrides: Partial<SectionData> = {}): SectionData {
  return {
    id: 2,
    section_name: 'Conditioning',
    modality: 'running',
    order: 2,
    run_type: 'easy',
    target_pace: '5:30/km',
    hr_zone: 2,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    target_distance: 3,
    target_duration: null,
    target_elevation_gain: null,
    planned_duration: null,
    ...overrides,
  }
}

function makeMixedData(sections: SectionData[]): MixedWorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
      status: 'active',
    },
    template: {
      id: 1,
      name: 'Hybrid Day',
      modality: 'mixed',
      notes: null,
      run_type: null,
      target_pace: null,
      hr_zone: null,
      interval_count: null,
      interval_rest: null,
      coaching_cues: null,
      target_distance: null,
      target_duration: null,
      target_elevation_gain: null,
      planned_duration: null,
    },
    sections,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Log as Planned button — mixed form', () => {
  it('shows button when form loads', () => {
    const data = makeMixedData([makeResistanceSection(), makeRunningSection()])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('hides button after modifying resistance weight', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeResistanceSection(), makeRunningSection()])
    render(<MixedLoggingForm data={data} />)

    // Weight input for section 0, slot 0, set 0
    const weightInput = screen.getByTestId('weight-input-0-0-0')
    await user.clear(weightInput)
    await user.type(weightInput, '110')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('hides button after modifying running distance', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeResistanceSection(), makeRunningSection()])
    render(<MixedLoggingForm data={data} />)

    const distanceInput = screen.getByTestId('actual-distance-1')
    await user.clear(distanceInput)
    await user.type(distanceInput, '5')

    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('tapping button scrolls to rating section', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    const data = makeMixedData([makeResistanceSection()])
    render(<MixedLoggingForm data={data} />)

    const ratingSection = screen.getByTestId('rating-notes-section')
    ratingSection.scrollIntoView = vi.fn()

    await user.click(screen.getByTestId('log-as-planned-btn'))

    expect(ratingSection.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(toast.info).toHaveBeenCalledWith('Review and save when ready.')
  })
})
