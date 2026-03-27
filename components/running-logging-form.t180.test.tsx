// T180: Running logging form elevation gain — TDD tests
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

describe('RunningLoggingForm — T180 elevation gain', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // ================================================================
  // Actual fields — elevation gain input renders
  // ================================================================

  it('renders elevation gain input in actual fields section', () => {
    render(<RunningLoggingForm data={makeData()} />)
    const input = screen.getByTestId('actual-elevation-gain')
    expect(input).toBeInTheDocument()
    expect(screen.getByLabelText('Elevation Gain (m)')).toBeInTheDocument()
  })

  it('actual fields section has 4 inputs: distance, pace, HR, elevation gain', () => {
    render(<RunningLoggingForm data={makeData()} />)
    const section = screen.getByTestId('actual-fields')
    const inputs = section.querySelectorAll('input')
    expect(inputs.length).toBe(4)
  })

  // ================================================================
  // Planned reference — target_elevation_gain display
  // ================================================================

  it('shows target elevation gain in planned reference when available', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ target_elevation_gain: 200 }),
        })}
      />
    )
    const planned = screen.getByTestId('planned-reference')
    expect(planned).toHaveTextContent('Elevation')
    expect(planned).toHaveTextContent('200m')
  })

  it('does not show elevation gain in planned reference when null', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ target_elevation_gain: null }),
        })}
      />
    )
    const planned = screen.getByTestId('planned-reference')
    expect(planned).not.toHaveTextContent(/elevation/i)
  })

  // ================================================================
  // Form submission — actualElevationGain in payload
  // ================================================================

  it('save payload includes actualElevationGain when filled', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<RunningLoggingForm data={makeData()} />)
    await user.type(screen.getByTestId('actual-elevation-gain'), '180')
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const call = mockSave.mock.calls[0][0]
    expect(call.actualElevationGain).toBe(180)
  })

  it('save payload has actualElevationGain null when empty', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const call = mockSave.mock.calls[0][0]
    expect(call.actualElevationGain).toBeNull()
  })

  // ================================================================
  // Interval reps — per-rep elevation gain input
  // ================================================================

  it('interval rep has elevation gain input', () => {
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

  it('interval rep has 3 inputs when notes collapsed (pace, HR, elevation)', () => {
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

  it('interval rep has 4 inputs when notes expanded (pace, HR, elevation, notes)', async () => {
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

  it('interval save payload includes interval_elevation_gain from input', async () => {
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

    await user.type(screen.getByTestId('interval-elevation-1'), '50')
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const reps = mockSave.mock.calls[0][0].intervalData!
    expect(reps[0].interval_elevation_gain).toBe(50)
    expect(reps[1].interval_elevation_gain).toBeNull()
  })

  it('added interval rep includes elevation gain field', async () => {
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

    await user.click(screen.getByLabelText('Add interval'))
    expect(screen.getByTestId('interval-elevation-2')).toBeInTheDocument()

    await user.type(screen.getByTestId('interval-elevation-2'), '30')
    await user.click(screen.getByTestId('save-running-btn'))
    await screen.findByTestId('save-success')

    const reps = mockSave.mock.calls[0][0].intervalData!
    expect(reps[1].interval_elevation_gain).toBe(30)
  })

  // ================================================================
  // Full payload shape includes actualElevationGain
  // ================================================================

  it('save payload keys include actualElevationGain', async () => {
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
})
