// T191: Running autofill on load
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

describe('RunningLoggingForm — T191 autofill on load', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // AC9: actual_distance prefilled from target_distance
  it('prefills actual_distance from target_distance', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_distance: 10 }) })}
      />
    )
    const input = screen.getByTestId('actual-distance') as HTMLInputElement
    expect(input.value).toBe('10')
  })

  // AC9: actual_avg_pace prefilled from target_pace
  it('prefills actual_avg_pace from target_pace', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_pace: '5:30/km' }) })}
      />
    )
    const input = screen.getByTestId('actual-avg-pace') as HTMLInputElement
    expect(input.value).toBe('5:30/km')
  })

  // AC10: null target_distance → empty input
  it('leaves actual_distance empty when target_distance is null', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_distance: null }) })}
      />
    )
    const input = screen.getByTestId('actual-distance') as HTMLInputElement
    expect(input.value).toBe('')
  })

  // AC10: null target_pace → empty input
  it('leaves actual_avg_pace empty when target_pace is null', () => {
    render(
      <RunningLoggingForm
        data={makeData({ template: makeTemplate({ target_pace: null }) })}
      />
    )
    const input = screen.getByTestId('actual-avg-pace') as HTMLInputElement
    expect(input.value).toBe('')
  })

  // AC11: actual_avg_hr is never autofilled
  it('leaves actual_avg_hr empty regardless of template values', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            target_distance: 10,
            target_pace: '5:30/km',
            hr_zone: 2,
          }),
        })}
      />
    )
    const input = screen.getByTestId('actual-avg-hr') as HTMLInputElement
    expect(input.value).toBe('')
  })

  // Both targets present — both prefilled
  it('prefills both distance and pace when both targets exist', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({
            target_distance: 8.5,
            target_pace: '6:00/km',
          }),
        })}
      />
    )
    expect((screen.getByTestId('actual-distance') as HTMLInputElement).value).toBe('8.5')
    expect((screen.getByTestId('actual-avg-pace') as HTMLInputElement).value).toBe('6:00/km')
  })

  // Rating stays unset, notes stay empty (AC7 equivalent for running)
  it('does not autofill rating or notes', () => {
    render(
      <RunningLoggingForm
        data={makeData({
          template: makeTemplate({ target_distance: 10 }),
        })}
      />
    )
    // All rating buttons should be unpressed
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i}` }).getAttribute('aria-pressed')).toBe('false')
    }
    // Notes textarea should be empty
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('')
  })
})
