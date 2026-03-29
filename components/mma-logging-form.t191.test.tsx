// T191: MMA autofill on load
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/lib/workouts/actions', () => ({
  saveMmaWorkout: vi.fn(),
}))

vi.mock('@/lib/ui/modality-colors', () => ({
  getModalityAccentClass: () => 'border-rose-500',
}))

import { MmaLoggingForm } from './mma-logging-form'
import type { MmaWorkoutData } from './mma-logging-form'

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'BJJ Session',
    modality: 'mma' as const,
    notes: null,
    run_type: null as string | null,
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

function makeData(overrides: Partial<MmaWorkoutData> = {}): MmaWorkoutData {
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

describe('MmaLoggingForm — T191 autofill on load', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // AC12: actual_duration_minutes prefilled from planned_duration
  it('prefills actual_duration_minutes from planned_duration', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: 90 }) })}
      />
    )
    const input = screen.getByTestId('actual-duration') as HTMLInputElement
    expect(input.value).toBe('90')
  })

  // AC13: null planned_duration → empty input
  it('leaves actual_duration_minutes empty when planned_duration is null', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: null }) })}
      />
    )
    const input = screen.getByTestId('actual-duration') as HTMLInputElement
    expect(input.value).toBe('')
  })

  // AC14: feeling is unset
  it('does not autofill feeling', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: 90 }) })}
      />
    )
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i}` }).getAttribute('aria-pressed')).toBe('false')
    }
  })

  // AC14: notes are empty
  it('does not autofill notes', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: 90 }) })}
      />
    )
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('')
  })
})
