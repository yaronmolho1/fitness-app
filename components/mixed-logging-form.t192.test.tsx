// T192: Mixed modality autofill on load
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/workouts/actions', () => ({
  saveMixedWorkout: vi.fn().mockResolvedValue({ success: true, data: { workoutId: 1 } }),
}))

import { MixedLoggingForm } from './mixed-logging-form'
import type { MixedWorkoutData } from './mixed-logging-form'
import type { SectionData, SlotData } from '@/lib/today/queries'

function makeSlot(overrides: Partial<SlotData> = {}): SlotData {
  return {
    id: 1,
    exercise_id: 10,
    exercise_name: 'Bench Press',
    sets: 3,
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

function makeSection(
  overrides: Partial<SectionData> & { id: number; section_name: string; modality: string; order: number }
): SectionData {
  return {
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
    ...overrides,
  }
}

function makeData(sections: SectionData[]): MixedWorkoutData {
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
      id: 100,
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

describe('T192: Mixed modality autofill on load', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // ================================================================
  // Resistance autofill (AC1-8 applied to mixed sections)
  // ================================================================

  describe('resistance section autofill', () => {
    it('autofills weight from slot value', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Strength',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ weight: 80, sets: 2 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const w0 = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
      const w1 = screen.getByTestId('weight-input-0-0-1') as HTMLInputElement
      expect(w0.value).toBe('80')
      expect(w1.value).toBe('80')
    })

    it('autofills reps from single integer', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Strength',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ reps: '10', sets: 1 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const r = screen.getByTestId('reps-input-0-0-0') as HTMLInputElement
      expect(r.value).toBe('10')
    })

    it('autofills reps with lower bound of range', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Strength',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ reps: '8-12', sets: 1 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const r = screen.getByTestId('reps-input-0-0-0') as HTMLInputElement
      expect(r.value).toBe('8')
    })

    it('leaves weight empty when null (bodyweight)', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'BW',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ weight: null, sets: 1 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const w = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
      expect(w.value).toBe('')
    })

    it('leaves reps empty for non-numeric like AMRAP', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'S',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ reps: 'AMRAP', sets: 1 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const r = screen.getByTestId('reps-input-0-0-0') as HTMLInputElement
      expect(r.value).toBe('')
    })

    it('RPE is never autofilled', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'S',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ rpe: 9 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      // All RPE buttons should be unpressed
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByRole('button', { name: `RPE ${i}` }).getAttribute('aria-pressed')).toBe('false')
      }
    })

    it('autofills weight=0 as empty', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'S',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot({ weight: 0, sets: 1 })],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const w = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
      expect(w.value).toBe('')
    })
  })

  // ================================================================
  // Running autofill (AC9-11 applied to mixed sections)
  // ================================================================

  describe('running section autofill', () => {
    it('autofills distance from target_distance', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Run',
          modality: 'running',
          order: 1,
          run_type: 'easy',
          target_distance: 8.5,
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const d = screen.getByTestId('actual-distance-0') as HTMLInputElement
      expect(d.value).toBe('8.5')
    })

    it('autofills pace from target_pace', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Run',
          modality: 'running',
          order: 1,
          run_type: 'easy',
          target_pace: '5:30/km',
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const p = screen.getByTestId('actual-avg-pace-0') as HTMLInputElement
      expect(p.value).toBe('5:30/km')
    })

    it('leaves distance empty when target_distance is null', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Run',
          modality: 'running',
          order: 1,
          run_type: 'easy',
          target_distance: null,
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const d = screen.getByTestId('actual-distance-0') as HTMLInputElement
      expect(d.value).toBe('')
    })

    it('HR is never autofilled', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Run',
          modality: 'running',
          order: 1,
          run_type: 'easy',
          target_pace: '5:30/km',
          target_distance: 10,
          hr_zone: 2,
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const hr = screen.getByTestId('actual-avg-hr-0') as HTMLInputElement
      expect(hr.value).toBe('')
    })
  })

  // ================================================================
  // MMA autofill (AC12-14 applied to mixed sections)
  // ================================================================

  describe('MMA section autofill', () => {
    it('autofills duration from planned_duration', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Sparring',
          modality: 'mma',
          order: 1,
          planned_duration: 60,
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const d = screen.getByTestId('actual-duration-0') as HTMLInputElement
      expect(d.value).toBe('60')
    })

    it('leaves duration empty when planned_duration is null', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Sparring',
          modality: 'mma',
          order: 1,
          planned_duration: null,
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      const d = screen.getByTestId('actual-duration-0') as HTMLInputElement
      expect(d.value).toBe('')
    })

    it('feeling is never autofilled', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Sparring',
          modality: 'mma',
          order: 1,
          planned_duration: 60,
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: `Feeling ${i}` }).getAttribute('aria-pressed')).toBe('false')
      }
    })
  })

  // ================================================================
  // AC15-16: Mixed workout applies modality-appropriate autofill
  // ================================================================

  describe('mixed workout: all modalities autofilled together', () => {
    it('resistance + running + mma all autofilled in same form', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'Strength',
          modality: 'resistance',
          order: 1,
          slots: [
            makeSlot({ id: 1, exercise_name: 'Squat', sets: 2, reps: '5', weight: 100 }),
          ],
        }),
        makeSection({
          id: 2,
          section_name: 'Conditioning',
          modality: 'running',
          order: 2,
          run_type: 'easy',
          target_distance: 5,
          target_pace: '6:00/km',
        }),
        makeSection({
          id: 3,
          section_name: 'Sparring',
          modality: 'mma',
          order: 3,
          planned_duration: 45,
        }),
      ])
      render(<MixedLoggingForm data={data} />)

      // Resistance: weight and reps autofilled
      expect((screen.getByTestId('weight-input-0-0-0') as HTMLInputElement).value).toBe('100')
      expect((screen.getByTestId('weight-input-0-0-1') as HTMLInputElement).value).toBe('100')
      expect((screen.getByTestId('reps-input-0-0-0') as HTMLInputElement).value).toBe('5')
      expect((screen.getByTestId('reps-input-0-0-1') as HTMLInputElement).value).toBe('5')

      // Running: distance and pace autofilled, HR empty
      expect((screen.getByTestId('actual-distance-1') as HTMLInputElement).value).toBe('5')
      expect((screen.getByTestId('actual-avg-pace-1') as HTMLInputElement).value).toBe('6:00/km')
      expect((screen.getByTestId('actual-avg-hr-1') as HTMLInputElement).value).toBe('')

      // MMA: duration autofilled, feeling unset
      expect((screen.getByTestId('actual-duration-2') as HTMLInputElement).value).toBe('45')
    })

    it('rating and notes are never autofilled', () => {
      const data = makeData([
        makeSection({
          id: 1,
          section_name: 'S',
          modality: 'resistance',
          order: 1,
          slots: [makeSlot()],
        }),
      ])
      render(<MixedLoggingForm data={data} />)
      // Rating unset
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: `Rate ${i}` }).getAttribute('aria-pressed')).toBe('false')
      }
      // Notes empty
      expect((screen.getByLabelText('Workout Notes') as HTMLTextAreaElement).value).toBe('')
    })
  })
})
