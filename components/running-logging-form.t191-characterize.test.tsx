// Characterization test — captures current behavior for safe refactoring
// Focus: initial state of actual fields (T191 autofill scope)
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/lib/workouts/actions', () => ({
  saveRunningWorkout: vi.fn(),
}))

vi.mock('@/lib/ui/modality-colors', () => ({
  getModalityAccentClass: () => 'border-green-500',
}))

import { RunningLoggingForm } from './running-logging-form'
import type { RunningWorkoutData } from './running-logging-form'

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

describe('RunningLoggingForm — T191 autofill characterization', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ================================================================
  // Current behavior: actual fields are always empty on mount
  // Planned values are displayed read-only but NOT pre-filled into inputs
  // ================================================================

  it('distance input is prefilled from target_distance', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_distance: 10 }) })}
      />
    )
    const input = screen.getByTestId('actual-distance') as HTMLInputElement
    expect(input.value).toBe('10')
  })

  it('pace input is prefilled from target_pace', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_pace: '5:30/km' }) })}
      />
    )
    const input = screen.getByTestId('actual-avg-pace') as HTMLInputElement
    expect(input.value).toBe('5:30/km')
  })

  it('HR input starts empty even when hr_zone is set', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ hr_zone: 2 }) })}
      />
    )
    const input = screen.getByTestId('actual-avg-hr') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('elevation gain input starts empty even when target_elevation_gain is set', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_elevation_gain: 200 }) })}
      />
    )
    const input = screen.getByTestId('actual-elevation-gain') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('distance and pace prefilled, HR and elevation empty with all planned values present', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            target_distance: 8.5,
            target_pace: '5:00/km',
            hr_zone: 3,
            target_elevation_gain: 150,
            target_duration: 45,
          }),
        })}
      />
    )
    expect((screen.getByTestId('actual-distance') as HTMLInputElement).value).toBe('8.5')
    expect((screen.getByTestId('actual-avg-pace') as HTMLInputElement).value).toBe('5:00/km')
    expect((screen.getByTestId('actual-avg-hr') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-elevation-gain') as HTMLInputElement).value).toBe('')
  })

  it('all actual inputs start empty with all planned values null', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            target_distance: null,
            target_pace: null,
            hr_zone: null,
            target_elevation_gain: null,
            target_duration: null,
          }),
        })}
      />
    )
    expect((screen.getByTestId('actual-distance') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-avg-pace') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-avg-hr') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-elevation-gain') as HTMLInputElement).value).toBe('')
  })

  // ================================================================
  // Interval reps — also start empty
  // ================================================================

  it('interval rep inputs start empty even with planned interval data', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            run_type: 'interval',
            interval_count: 2,
            interval_rest: 90,
          }),
        })}
      />
    )
    expect((screen.getByTestId('interval-pace-1') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('interval-hr-1') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('interval-elevation-1') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('interval-pace-2') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('interval-hr-2') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('interval-elevation-2') as HTMLInputElement).value).toBe('')
  })

  // ================================================================
  // Notes + rating start empty/null
  // ================================================================

  it('notes textarea starts empty', () => {
    render(<RunningLoggingForm data={makeData()} />)
    const textarea = screen.getByLabelText('Notes') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('no rating is selected on mount', () => {
    render(<RunningLoggingForm data={makeData()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i}` }).getAttribute('aria-pressed')).toBe('false')
    }
  })
})
