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

function makeMmaSection(overrides: Partial<SectionData> = {}): SectionData {
  return {
    id: 3,
    section_name: 'MMA',
    modality: 'mma',
    order: 3,
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    target_distance: null,
    target_duration: null,
    target_elevation_gain: null,
    planned_duration: 60,
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

describe('Per-section "As Planned" — mixed form resistance', () => {
  it('AC23: shows "As Planned" button for resistance exercise', () => {
    const data = makeMixedData([makeResistanceSection()])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByTestId('as-planned-resistance-0-0')).toBeInTheDocument()
  })

  it('AC24: fills resistance exercise sets with planned values', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeResistanceSection()])
    render(<MixedLoggingForm data={data} />)

    // Modify a set
    const w = screen.getByTestId('weight-input-0-0-0')
    await user.clear(w)
    await user.type(w, '120')

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-resistance-0-0'))

    // All sets restored to planned
    for (let i = 0; i < 3; i++) {
      expect(screen.getByTestId(`weight-input-0-0-${i}`)).toHaveValue('100')
      expect(screen.getByTestId(`reps-input-0-0-${i}`)).toHaveValue('5')
    }
  })
})

describe('Per-section "As Planned" — mixed form running', () => {
  it('AC25: shows "As Planned" button for running section', () => {
    const data = makeMixedData([makeRunningSection()])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByTestId('as-planned-running-0')).toBeInTheDocument()
  })

  it('AC25: fills running actual fields with planned values', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeRunningSection()])
    render(<MixedLoggingForm data={data} />)

    // Modify distance
    const dist = screen.getByTestId('actual-distance-0')
    await user.clear(dist)
    await user.type(dist, '10')

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-running-0'))

    // Restored to planned values
    expect(screen.getByTestId('actual-distance-0')).toHaveValue('3')
    expect(screen.getByTestId('actual-avg-pace-0')).toHaveValue('5:30/km')
  })

  it('running "As Planned" does not fill HR (no planned equivalent)', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeRunningSection()])
    render(<MixedLoggingForm data={data} />)

    // Set HR
    const hr = screen.getByTestId('actual-avg-hr-0')
    await user.type(hr, '155')

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-running-0'))

    // HR stays as user-entered (not cleared)
    expect(screen.getByTestId('actual-avg-hr-0')).toHaveValue('155')
  })
})

describe('Per-section "As Planned" — mixed form MMA', () => {
  it('shows "As Planned" button for MMA section', () => {
    const data = makeMixedData([makeMmaSection()])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByTestId('as-planned-mma-0')).toBeInTheDocument()
  })

  it('fills MMA duration with planned value', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeMmaSection()])
    render(<MixedLoggingForm data={data} />)

    // Modify duration
    const dur = screen.getByTestId('actual-duration-0')
    await user.clear(dur)
    await user.type(dur, '45')

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-mma-0'))

    expect(screen.getByTestId('actual-duration-0')).toHaveValue('60')
  })

  it('MMA "As Planned" does not modify feeling', async () => {
    const user = userEvent.setup()
    const data = makeMixedData([makeMmaSection()])
    render(<MixedLoggingForm data={data} />)

    // Set feeling to 4
    await user.click(screen.getByRole('button', { name: 'Feeling 4' }))

    // Tap "As Planned"
    await user.click(screen.getByTestId('as-planned-mma-0'))

    // Feeling stays at 4
    expect(screen.getByRole('button', { name: 'Feeling 4' })).toHaveAttribute('aria-pressed', 'true')
  })
})
