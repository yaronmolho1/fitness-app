// Characterization test — captures current behavior for safe refactoring
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

describe('RunningLoggingForm — characterization', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ================================================================
  // Header rendering
  // ================================================================

  it('renders mesocycle name', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByText('Block A')).toBeInTheDocument()
  })

  it('renders template name as heading', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByText('Easy Run')).toBeInTheDocument()
  })

  it('renders formatted date with weekday', () => {
    render(<RunningLoggingForm data={makeData({ date: '2026-03-15' })} />)
    expect(screen.getByText('Sun 15/03/2026')).toBeInTheDocument()
  })

  // ================================================================
  // Run type badge
  // ================================================================

  it.each([
    ['easy', 'Easy'],
    ['tempo', 'Tempo'],
    ['interval', 'Interval'],
    ['long', 'Long'],
    ['race', 'Race'],
  ])('renders run type badge for %s', (runType, label) => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ run_type: runType }) })}
      />
    )
    expect(screen.getByTestId('run-type-badge')).toHaveTextContent(label)
  })

  it('does not render run-type-badge when run_type is null', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ run_type: null }) })}
      />
    )
    expect(screen.queryByTestId('run-type-badge')).not.toBeInTheDocument()
  })

  // ================================================================
  // Planned reference section
  // ================================================================

  it('renders planned reference section', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByTestId('planned-reference')).toBeInTheDocument()
    expect(screen.getByText('Planned')).toBeInTheDocument()
  })

  it('shows target pace when present', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_pace: '5:30' }) })}
      />
    )
    expect(screen.getByText('Target Pace')).toBeInTheDocument()
    expect(screen.getByText('5:30')).toBeInTheDocument()
  })

  it('omits target pace when null', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_pace: null }) })}
      />
    )
    expect(screen.queryByText('Target Pace')).not.toBeInTheDocument()
  })

  it('shows HR zone when present', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ hr_zone: 2 }) })}
      />
    )
    expect(screen.getByText('HR Zone')).toBeInTheDocument()
    expect(screen.getByText('Zone 2')).toBeInTheDocument()
  })

  it('omits HR zone when null', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ hr_zone: null }) })}
      />
    )
    expect(screen.queryByText('HR Zone')).not.toBeInTheDocument()
  })

  it('shows interval count for interval run_type', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 6,
          }),
        })}
      />
    )
    expect(screen.getByText('Intervals')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('omits interval count for non-interval run_type', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'easy',
            interval_count: 6,
          }),
        })}
      />
    )
    expect(screen.queryByText('Intervals')).not.toBeInTheDocument()
  })

  it('shows interval rest formatted as minutes+seconds', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_rest: 90,
          }),
        })}
      />
    )
    expect(screen.getByText('Rest')).toBeInTheDocument()
    expect(screen.getByText('1m30s')).toBeInTheDocument()
  })

  it('shows interval rest formatted as seconds only when < 60', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_rest: 45,
          }),
        })}
      />
    )
    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  it('shows interval rest formatted as minutes only for exact minutes', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_rest: 120,
          }),
        })}
      />
    )
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('shows coaching cues when present', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ coaching_cues: 'Relax shoulders' }),
        })}
      />
    )
    expect(screen.getByText('Coaching Cues')).toBeInTheDocument()
    expect(screen.getByText('Relax shoulders')).toBeInTheDocument()
  })

  it('omits coaching cues when null', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ coaching_cues: null }) })}
      />
    )
    expect(screen.queryByText('Coaching Cues')).not.toBeInTheDocument()
  })

  // ================================================================
  // Planned reference — distance/duration display
  // ================================================================

  it('displays target_distance in planned section', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ target_distance: 10 }),
        })}
      />
    )
    expect(screen.getByText('10km')).toBeInTheDocument()
    expect(screen.getByText('Distance')).toBeInTheDocument()
  })

  it('displays target_duration in planned section', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ target_duration: 30 }),
        })}
      />
    )
    expect(screen.getByText('30min')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })

  // ================================================================
  // Actual fields
  // ================================================================

  it('renders actual distance input', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByTestId('actual-fields')).toBeInTheDocument()
    expect(screen.getByLabelText('Distance (km)')).toBeInTheDocument()
    expect(screen.getByTestId('actual-distance')).toBeInTheDocument()
  })

  it('renders actual avg pace input', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByLabelText('Avg Pace')).toBeInTheDocument()
    expect(screen.getByTestId('actual-avg-pace')).toBeInTheDocument()
  })

  it('renders actual avg HR input', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByLabelText('Avg HR (bpm)')).toBeInTheDocument()
    expect(screen.getByTestId('actual-avg-hr')).toBeInTheDocument()
  })

  it('actual inputs start empty', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect((screen.getByTestId('actual-distance') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-avg-pace') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-avg-hr') as HTMLInputElement).value).toBe('')
  })

  it('typing in distance input updates value', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)
    const input = screen.getByTestId('actual-distance') as HTMLInputElement
    await user.type(input, '8.5')
    expect(input.value).toBe('8.5')
  })

  it('typing in pace input updates value', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)
    const input = screen.getByTestId('actual-avg-pace') as HTMLInputElement
    await user.type(input, '5:45/km')
    expect(input.value).toBe('5:45/km')
  })

  it('typing in HR input updates value', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)
    const input = screen.getByTestId('actual-avg-hr') as HTMLInputElement
    await user.type(input, '155')
    expect(input.value).toBe('155')
  })

  // ================================================================
  // Interval section
  // ================================================================

  it('renders interval reps section for interval run_type', () => {
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
    expect(screen.getByTestId('interval-section')).toBeInTheDocument()
    expect(screen.getByText('Intervals (3)')).toBeInTheDocument()
    expect(screen.getByTestId('interval-rep-1')).toBeInTheDocument()
    expect(screen.getByTestId('interval-rep-2')).toBeInTheDocument()
    expect(screen.getByTestId('interval-rep-3')).toBeInTheDocument()
  })

  it('does not render interval section for non-interval run_type', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ run_type: 'easy' }),
        })}
      />
    )
    expect(screen.queryByTestId('interval-section')).not.toBeInTheDocument()
  })

  it('does not render interval section when interval_count is null', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: null,
          }),
        })}
      />
    )
    expect(screen.queryByTestId('interval-section')).not.toBeInTheDocument()
  })

  it('interval rep has pace and HR inputs', () => {
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
    expect(screen.getByTestId('interval-pace-1')).toBeInTheDocument()
    expect(screen.getByTestId('interval-hr-1')).toBeInTheDocument()
  })

  it('interval notes are collapsed by default with toggle button', () => {
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
    expect(screen.queryByTestId('interval-notes-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('interval-notes-toggle-1')).toBeInTheDocument()
    expect(screen.getByText('+ Add notes')).toBeInTheDocument()
  })

  it('clicking notes toggle reveals notes input', async () => {
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
    expect(screen.getByTestId('interval-notes-1')).toBeInTheDocument()
  })

  it('typing in interval pace updates value', async () => {
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
    const input = screen.getByTestId('interval-pace-1') as HTMLInputElement
    await user.type(input, '4:55/km')
    expect(input.value).toBe('4:55/km')
  })

  it('editing one interval rep does not affect another', async () => {
    const user = userEvent.setup()
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
    const pace1 = screen.getByTestId('interval-pace-1') as HTMLInputElement
    const pace2 = screen.getByTestId('interval-pace-2') as HTMLInputElement
    await user.type(pace1, '4:30')
    expect(pace1.value).toBe('4:30')
    expect(pace2.value).toBe('')
  })

  // ================================================================
  // Rating + notes section
  // ================================================================

  it('renders rating buttons 1-5', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByTestId('rating-notes-section')).toBeInTheDocument()
    expect(screen.getByText('Workout Rating')).toBeInTheDocument()
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i}` })).toBeInTheDocument()
    }
  })

  it('clicking rating button sets rating (aria-pressed)', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)
    const btn3 = screen.getByRole('button', { name: 'Rate 3' })
    await user.click(btn3)
    expect(btn3.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking same rating button toggles it off', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)
    const btn3 = screen.getByRole('button', { name: 'Rate 3' })
    await user.click(btn3)
    await user.click(btn3)
    expect(btn3.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders notes textarea', () => {
    render(<RunningLoggingForm data={makeData()} />)
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
  })

  // ================================================================
  // Save button
  // ================================================================

  it('renders Save Run button with type="button"', () => {
    render(<RunningLoggingForm data={makeData()} />)
    const btn = screen.getByTestId('save-running-btn')
    expect(btn).toHaveTextContent('Save Run')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('save button calls saveRunningWorkout with correct input on click', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveRunningWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))

    expect(mockSave).toHaveBeenCalledWith({
      templateId: 1,
      logDate: '2026-03-15',
      actualDistance: null,
      actualAvgPace: null,
      actualAvgHr: null,
      rating: null,
      notes: null,
      intervalData: null,
    })
  })

  it('shows success message after successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveRunningWorkout).mockResolvedValueOnce({
      success: true,
      data: { workoutId: 1 },
    })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))

    expect(await screen.findByTestId('save-success')).toBeInTheDocument()
    expect(screen.getByText('Run logged!')).toBeInTheDocument()
  })

  it('shows error message on failed save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveRunningWorkout).mockResolvedValueOnce({
      success: false,
      error: 'Already logged today',
    })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))

    expect(await screen.findByTestId('save-error')).toBeInTheDocument()
    expect(screen.getByText('Already logged today')).toBeInTheDocument()
  })

  it('sanitizes negative sign from distance input (NumericInput prevents negative values)', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)

    const input = screen.getByTestId('actual-distance') as HTMLInputElement
    await user.type(input, '-5')
    // NumericInput strips non-numeric chars; "-" is removed, leaving "5"
    expect(input.value).toBe('5')
  })

  it('shows client-side validation error for invalid HR', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeData()} />)

    await user.type(screen.getByTestId('actual-avg-hr'), '0')
    await user.click(screen.getByTestId('save-running-btn'))

    expect(screen.getByTestId('save-error')).toBeInTheDocument()
    expect(screen.getByText('Average HR must be a positive integer')).toBeInTheDocument()
    // NOTE: possible bug — saveRunningWorkout is called despite validation error (startTransition fires before client validation blocks)
  })

  it('disables save button after successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveRunningWorkout).mockResolvedValueOnce({
      success: true,
      data: { workoutId: 1 },
    })

    render(<RunningLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-running-btn'))

    await screen.findByTestId('save-success')
    expect(screen.getByTestId('save-running-btn')).toBeDisabled()
    expect(screen.getByTestId('save-running-btn')).toHaveTextContent('Saved')
  })

  // ================================================================
  // Exports
  // ================================================================

  it('exports RunningWorkoutData type (compile-time check)', () => {
    const data: RunningWorkoutData = makeData()
    expect(data.date).toBe('2026-03-15')
  })
})
