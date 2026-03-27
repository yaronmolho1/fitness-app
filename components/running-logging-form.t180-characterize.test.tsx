// Characterization test — captures current behavior for safe refactoring
// Focus: T180 will add elevation gain UI inputs. These tests lock down current
// form state shape, submission payload, and absence of elevation gain fields.
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/lib/workouts/actions', () => ({
  saveRunningWorkout: vi.fn(),
}))

vi.mock('@/lib/ui/modality-colors', () => ({
  getModalityAccentClass: () => 'border-green-500',
}))

import { RunningLoggingForm } from './running-logging-form'
import type { RunningWorkoutData } from './running-logging-form'
import { saveRunningWorkout } from '@/lib/workouts/actions'

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Easy Run',
    modality: 'running' as const,
    notes: null,
    run_type: 'easy' as string | null,
    target_pace: null as string | null,
    hr_zone: null as number | null,
    interval_count: null as number | null,
    interval_rest: null as number | null,
    coaching_cues: null as string | null,
    planned_duration: null as number | null,
    target_distance: null as number | null,
    target_duration: null as number | null,
    target_elevation_gain: null as number | null,
    ...overrides,
  }
}

function makeData(overrides: Partial<RunningWorkoutData> = {}): RunningWorkoutData {
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
    template: makeTemplate(),
    ...overrides,
  }
}

describe('RunningLoggingForm — T180 characterization (elevation gain)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // ================================================================
  // No elevation gain UI exists yet
  // ================================================================

  // T180: elevation gain inputs now exist
  it('renders an elevation gain input in the actual fields section', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByLabelText('Elevation Gain (m)')).toBeInTheDocument()
    expect(screen.getByTestId('actual-elevation-gain')).toBeInTheDocument()
  })

  it('actual fields section has exactly 4 inputs: distance, pace, HR, elevation', () => {
    render(<RunningLoggingForm data={makeData()} />)
    const section = screen.getByTestId('actual-fields')
    const inputs = section.querySelectorAll('input')
    expect(inputs.length).toBe(4)
  })

  it('renders elevation gain input in interval reps', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 2,
          }),
        })}
      />
    )
    expect(screen.getByTestId('interval-elevation-1')).toBeInTheDocument()
    expect(screen.getByTestId('interval-elevation-2')).toBeInTheDocument()
  })

  it('interval rep has exactly 3 inputs (pace + HR + elevation) when notes collapsed', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )
    const repEl = screen.getByTestId('interval-rep-1')
    const inputs = repEl.querySelectorAll('input')
    expect(inputs.length).toBe(3)
  })

  it('interval rep has exactly 4 inputs (pace + HR + elevation + notes) when notes expanded', async () => {
    const user = userEvent.setup()
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )
    await user.click(screen.getByTestId('interval-notes-toggle-1'))
    const repEl = screen.getByTestId('interval-rep-1')
    const inputs = repEl.querySelectorAll('input')
    expect(inputs.length).toBe(4)
  })

  // ================================================================
  // Submission payload — non-interval run (no elevation gain)
  // ================================================================

  it('non-interval save payload has actualElevationGain: null when empty', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const call = mockSave.mock.calls[0][0]
    expect(call.actualElevationGain).toBeNull()
  })

  it('non-interval save payload has intervalData: null', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))

    expect(mockSave.mock.calls[0][0].intervalData).toBeNull()
  })

  // ================================================================
  // Submission payload — interval run with filled data
  // ================================================================

  it('interval save payload includes intervalData with interval_elevation_gain: null', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 2,
          }),
        })}
      />
    )

    // Fill some interval data
    await user.type(screen.getByTestId('interval-pace-1'), '4:30')
    await user.type(screen.getByTestId('interval-hr-1'), '170')
    await user.click(screen.getByTestId('save-running-btn'))

    // Wait for startTransition to complete
    await screen.findByTestId('save-success')

    const call = mockSave.mock.calls[0][0]
    expect(call.intervalData).not.toBeNull()
    expect(call.intervalData).toHaveLength(2)

    // Each rep has interval_elevation_gain: null (T178 placeholder)
    expect(call.intervalData![0]).toEqual({
      rep_number: 1,
      interval_pace: '4:30',
      interval_avg_hr: 170,
      interval_notes: null,
      interval_elevation_gain: null,
    })
    expect(call.intervalData![1]).toEqual({
      rep_number: 2,
      interval_pace: null,
      interval_avg_hr: null,
      interval_notes: null,
      interval_elevation_gain: null,
    })
  })

  it('interval rep data keys are exactly: rep_number, interval_pace, interval_avg_hr, interval_notes, interval_elevation_gain', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const rep = mockSave.mock.calls[0][0].intervalData![0]
    expect(Object.keys(rep).sort()).toEqual([
      'interval_avg_hr',
      'interval_elevation_gain',
      'interval_notes',
      'interval_pace',
      'rep_number',
    ])
  })

  // ================================================================
  // Save payload shape — full field set
  // ================================================================

  it('save payload has exactly these keys (includes actualElevationGain)', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const call = mockSave.mock.calls[0][0]
    expect(Object.keys(call).sort()).toEqual([
      'actualAvgHr',
      'actualAvgPace',
      'actualDistance',
      'actualElevationGain',
      'intervalData',
      'logDate',
      'notes',
      'rating',
      'templateId',
    ])
  })

  // ================================================================
  // Interval count add/remove preserves state shape
  // ================================================================

  it('adding an interval rep creates entry with empty pace/hr/notes/elevation', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )

    // Add one more rep
    await user.click(screen.getByLabelText('Add interval'))
    expect(screen.getByTestId('interval-rep-2')).toBeInTheDocument()
    expect(screen.getByText('Intervals (2)')).toBeInTheDocument()

    // Save and check the new rep's shape
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')
    const reps = mockSave.mock.calls[0][0].intervalData!
    expect(reps).toHaveLength(2)
    expect(reps[1]).toEqual({
      rep_number: 2,
      interval_pace: null,
      interval_avg_hr: null,
      interval_notes: null,
      interval_elevation_gain: null,
    })
  })

  it('removing an interval rep removes from the end', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 3,
          }),
        })}
      />
    )

    // Fill rep 1 with data
    await user.type(screen.getByTestId('interval-pace-1'), '4:00')

    // Remove last rep
    await user.click(screen.getByLabelText('Remove interval'))
    expect(screen.getByText('Intervals (2)')).toBeInTheDocument()
    expect(screen.queryByTestId('interval-rep-3')).not.toBeInTheDocument()

    // Rep 1 data preserved
    expect((screen.getByTestId('interval-pace-1') as HTMLInputElement).value).toBe('4:00')
  })

  it('cannot remove below 1 interval rep', async () => {
    const user = userEvent.setup()
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )
    const removeBtn = screen.getByLabelText('Remove interval')
    expect(removeBtn).toBeDisabled()
  })

  // ================================================================
  // Filled actual fields with interval data — full payload
  // ================================================================

  it('filled form produces correct payload with all values and interval_elevation_gain: null', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            id: 5,
            run_type: 'interval',
            interval_count: 1,
          }),
        })}
      />
    )

    await user.type(screen.getByTestId('actual-distance'), '6.5')
    await user.type(screen.getByTestId('actual-avg-pace'), '5:10/km')
    await user.type(screen.getByTestId('actual-avg-hr'), '160')
    await user.type(screen.getByTestId('interval-pace-1'), '4:20/km')
    await user.type(screen.getByTestId('interval-hr-1'), '175')
    await user.click(screen.getByRole('button', { name: 'Rate 4' }))
    await user.click(screen.getByTestId('save-running-btn'))

    expect(mockSave).toHaveBeenCalledWith({
      templateId: 5,
      logDate: '2026-03-15',
      actualDistance: 6.5,
      actualAvgPace: '5:10/km',
      actualAvgHr: 160,
      actualElevationGain: null,
      rating: 4,
      notes: null,
      intervalData: [
        {
          rep_number: 1,
          interval_pace: '4:20/km',
          interval_avg_hr: 175,
          interval_notes: null,
          interval_elevation_gain: null,
        },
      ],
    })
  })
})
