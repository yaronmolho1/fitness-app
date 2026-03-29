// Tests for T135: verify all numeric inputs reject non-numeric characters
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

// ============================================================================
// workout-logging-form: weight + reps inputs must filter non-numeric
// ============================================================================

import { WorkoutLoggingForm } from './workout-logging-form'
import type { WorkoutData } from './workout-logging-form'

function makeWorkoutData(overrides: Partial<WorkoutData> = {}): WorkoutData {
  return {
    date: '2026-03-15',
    mesocycle: {
      id: 1,
      name: 'Block A',
      start_date: '2026-03-01',
      end_date: '2026-04-01',
      week_type: 'normal',
    },
    template: { id: 1, name: 'Push A', modality: 'resistance', notes: null },
    slots: [],
    ...overrides,
  }
}

function makeSlot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 1,
    reps: '8',
    weight: 80,
    rpe: 8,
    rest_seconds: 120,
    group_id: null,
    group_rest_seconds: null,
    guidelines: null,
    order: 1,
    is_main: true,
    ...overrides,
  }
}

describe('T135 — numeric input migration: workout-logging-form', () => {
  afterEach(cleanup)

  it('weight input rejects letters, keeps only digits and decimal', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot()] })
    render(<WorkoutLoggingForm data={data} />)

    const input = screen.getByTestId('weight-input-0-0') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '8a2b.5c')
    expect(input.value).toBe('82.5')
  })

  it('reps input rejects letters and decimals, keeps only digits', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot()] })
    render(<WorkoutLoggingForm data={data} />)

    const input = screen.getByTestId('reps-input-0-0') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '1a2.3')
    expect(input.value).toBe('123')
  })

  it('weight input: clearing shows empty, typing fresh shows clean value', async () => {
    const user = userEvent.setup()
    const data = makeWorkoutData({ slots: [makeSlot()] })
    render(<WorkoutLoggingForm data={data} />)

    const input = screen.getByTestId('weight-input-0-0') as HTMLInputElement
    await user.type(input, '80')
    await user.clear(input)
    expect(input.value).toBe('')
    await user.type(input, '65')
    expect(input.value).toBe('65')
  })
})

// ============================================================================
// running-logging-form: distance (decimal), HR (integer) must filter
// ============================================================================

vi.mock('@/lib/workouts/actions', () => ({
  saveWorkout: vi.fn(),
  saveRunningWorkout: vi.fn(),
  saveMmaWorkout: vi.fn(),
  saveMixedWorkout: vi.fn(),
}))

import { RunningLoggingForm } from './running-logging-form'
import type { RunningWorkoutData } from './running-logging-form'

function makeRunningData(): RunningWorkoutData {
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
      name: 'Easy Run',
      modality: 'running',
      notes: null,
      run_type: 'easy',
      target_pace: '5:30/km',
      hr_zone: 2,
      interval_count: null,
      interval_rest: null,
      coaching_cues: null,
      target_distance: 8,
      target_duration: 45,
      target_elevation_gain: null,
      planned_duration: null,
    },
  }
}

describe('T135 — numeric input migration: running-logging-form', () => {
  afterEach(cleanup)

  it('distance input rejects letters', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeRunningData()} />)

    const input = screen.getByTestId('actual-distance') as HTMLInputElement
    await user.type(input, '8abc.5')
    expect(input.value).toBe('8.5')
  })

  it('HR input rejects letters and decimals', async () => {
    const user = userEvent.setup()
    render(<RunningLoggingForm data={makeRunningData()} />)

    const input = screen.getByTestId('actual-avg-hr') as HTMLInputElement
    await user.type(input, '1a5b5')
    expect(input.value).toBe('155')
  })
})

// ============================================================================
// mma-logging-form: duration (integer) must filter
// ============================================================================

import { MmaLoggingForm } from './mma-logging-form'
import type { MmaWorkoutData } from './mma-logging-form'

function makeMmaData(): MmaWorkoutData {
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
      name: 'BJJ Gi',
      modality: 'mma',
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
      planned_duration: 90,
    },
  }
}

describe('T135 — numeric input migration: mma-logging-form', () => {
  afterEach(cleanup)

  it('duration input rejects letters and decimals', async () => {
    const user = userEvent.setup()
    render(<MmaLoggingForm data={makeMmaData()} />)

    const input = screen.getByTestId('actual-duration') as HTMLInputElement
    await user.type(input, '9a0.5')
    expect(input.value).toBe('905')
  })
})

// ============================================================================
// template forms: running-template-form numeric fields must filter
// ============================================================================

vi.mock('@/lib/templates/actions', () => ({
  createRunningTemplate: vi.fn(),
  createMmaBjjTemplate: vi.fn(),
  createResistanceTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))

import { RunningTemplateForm } from './running-template-form'

describe('T135 — numeric input migration: running-template-form', () => {
  afterEach(cleanup)

  it('target distance rejects letters', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    const input = screen.getByLabelText(/target distance/i) as HTMLInputElement
    await user.type(input, '5a.2b')
    expect(input.value).toBe('5.2')
  })

  it('target duration rejects letters and decimals', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    const input = screen.getByLabelText(/target duration/i) as HTMLInputElement
    await user.type(input, '30abc')
    expect(input.value).toBe('30')
  })
})

// ============================================================================
// mma-bjj-template-form: duration must filter
// ============================================================================

import { MmaBjjTemplateForm } from './mma-bjj-template-form'

describe('T135 — numeric input migration: mma-bjj-template-form', () => {
  afterEach(cleanup)

  it('duration rejects letters', async () => {
    const user = userEvent.setup()
    render(<MmaBjjTemplateForm mesocycleId={1} />)

    const input = screen.getByLabelText(/planned duration/i) as HTMLInputElement
    await user.type(input, '90abc')
    expect(input.value).toBe('90')
  })
})
