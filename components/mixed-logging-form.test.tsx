// T122 — Mixed template logging form: component tests
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock the save action
vi.mock('@/lib/workouts/actions', () => ({
  saveMixedWorkout: vi.fn(),
}))

import { MixedLoggingForm } from './mixed-logging-form'
import type { SectionData, SlotData } from '@/lib/today/queries'

function makeSlot(overrides: Partial<SlotData> = {}): SlotData {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 4,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 180,
    group_id: null,
    group_rest_seconds: null,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

function makeSection(overrides: Partial<SectionData> & { id: number; section_name: string; modality: string; order: number }): SectionData {
  return {
    run_type: null,
    target_pace: null,
    hr_zone: null,
    interval_count: null,
    interval_rest: null,
    coaching_cues: null,
    target_distance: null,
    target_duration: null,
    planned_duration: null,
    ...overrides,
  }
}

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal' as const,
      status: 'active' as const,
    },
    template: {
      id: 100,
      name: 'Strength + Cardio',
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
      planned_duration: null,
    },
    sections: [
      makeSection({
        id: 1,
        section_name: 'Main Lift',
        modality: 'resistance',
        order: 1,
        slots: [
          makeSlot({ id: 1, exercise_name: 'Bench Press', sets: 4, reps: '8', weight: 80 }),
          makeSlot({ id: 2, exercise_name: 'Row', sets: 3, reps: '10', weight: 60, is_main: false, order: 2 }),
        ],
      }),
      makeSection({
        id: 2,
        section_name: 'Cooldown Run',
        modality: 'running',
        order: 2,
        run_type: 'easy',
        target_pace: '6:00/km',
        hr_zone: 2,
      }),
    ],
    ...overrides,
  }
}

function makeDataWith3Sections() {
  return makeData({
    sections: [
      makeSection({
        id: 1,
        section_name: 'Strength',
        modality: 'resistance',
        order: 1,
        slots: [makeSlot()],
      }),
      makeSection({
        id: 2,
        section_name: 'Tempo Run',
        modality: 'running',
        order: 2,
        run_type: 'tempo',
        target_pace: '5:00/km',
      }),
      makeSection({
        id: 3,
        section_name: 'Sparring',
        modality: 'mma',
        order: 3,
        planned_duration: 30,
      }),
    ],
  })
}

describe('MixedLoggingForm', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders section headers in order', () => {
    render(<MixedLoggingForm data={makeData()} />)

    const headers = screen.getAllByTestId('mixed-section-header')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveTextContent('Main Lift')
    expect(headers[1]).toHaveTextContent('Cooldown Run')
  })

  it('renders modality badges on section headers', () => {
    render(<MixedLoggingForm data={makeDataWith3Sections()} />)

    const badges = screen.getAllByTestId('mixed-section-modality')
    expect(badges).toHaveLength(3)
    expect(badges[0]).toHaveTextContent('Resistance')
    expect(badges[1]).toHaveTextContent('Running')
    expect(badges[2]).toHaveTextContent('MMA')
  })

  // Resistance section inputs
  it('resistance section shows exercise names', () => {
    render(<MixedLoggingForm data={makeData()} />)

    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('Row')).toBeInTheDocument()
  })

  it('resistance section shows pre-filled set rows', () => {
    render(<MixedLoggingForm data={makeData()} />)

    // Bench Press has 4 sets, Row has 3 = 7 total set rows
    const setRows = screen.getAllByTestId('set-row')
    expect(setRows.length).toBeGreaterThanOrEqual(7)
  })

  it('resistance section shows weight and reps inputs', () => {
    render(<MixedLoggingForm data={makeData()} />)

    // Check for weight inputs (at least one from first exercise first set)
    const weightInput = screen.getByTestId('weight-input-0-0-0')
    expect(weightInput).toBeInTheDocument()
    expect(weightInput).toHaveAttribute('placeholder', '80')

    const repsInput = screen.getByTestId('reps-input-0-0-0')
    expect(repsInput).toBeInTheDocument()
    expect(repsInput).toHaveAttribute('placeholder', '8')
  })

  // Running section inputs
  it('running section shows distance, pace, HR inputs', () => {
    render(<MixedLoggingForm data={makeData()} />)

    expect(screen.getByTestId('actual-distance-1')).toBeInTheDocument()
    expect(screen.getByTestId('actual-avg-pace-1')).toBeInTheDocument()
    expect(screen.getByTestId('actual-avg-hr-1')).toBeInTheDocument()
  })

  it('running section shows planned reference', () => {
    render(<MixedLoggingForm data={makeData()} />)

    expect(screen.getByText('6:00/km')).toBeInTheDocument()
    expect(screen.getByText('Zone 2')).toBeInTheDocument()
  })

  // MMA section inputs
  it('mma section shows duration and feeling inputs', () => {
    render(<MixedLoggingForm data={makeDataWith3Sections()} />)

    expect(screen.getByTestId('actual-duration-2')).toBeInTheDocument()
  })

  it('mma section shows planned duration reference', () => {
    render(<MixedLoggingForm data={makeDataWith3Sections()} />)

    expect(screen.getByText('30 min')).toBeInTheDocument()
  })

  // Single save button
  it('renders a single Save Workout button', () => {
    render(<MixedLoggingForm data={makeData()} />)

    const saveBtn = screen.getByTestId('save-mixed-btn')
    expect(saveBtn).toBeInTheDocument()
    expect(saveBtn).toHaveTextContent('Save Workout')
  })

  it('renders rating section', () => {
    render(<MixedLoggingForm data={makeData()} />)

    expect(screen.getByTestId('rating-notes-section')).toBeInTheDocument()
  })

  it('renders workout header with template name', () => {
    render(<MixedLoggingForm data={makeData()} />)

    expect(screen.getByText('Strength + Cardio')).toBeInTheDocument()
    expect(screen.getByText('Block A')).toBeInTheDocument()
  })
})
