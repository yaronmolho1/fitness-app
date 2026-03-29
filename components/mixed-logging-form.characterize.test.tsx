// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { saveMixedWorkout } from '@/lib/workouts/actions'

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

// Common fixture: resistance + running + mma
function make3SectionData() {
  return makeData([
    makeSection({
      id: 1,
      section_name: 'Strength',
      modality: 'resistance',
      order: 1,
      slots: [
        makeSlot({ id: 1, exercise_name: 'Squat', sets: 3, reps: '5', weight: 100 }),
        makeSlot({ id: 2, exercise_name: 'Leg Press', sets: 2, reps: '12', weight: 150, is_main: false, order: 2 }),
      ],
    }),
    makeSection({
      id: 2,
      section_name: 'Conditioning',
      modality: 'running',
      order: 2,
      run_type: 'easy',
      target_pace: '6:00/km',
      hr_zone: 2,
    }),
    makeSection({
      id: 3,
      section_name: 'Sparring',
      modality: 'mma',
      order: 3,
      planned_duration: 60,
    }),
  ])
}

describe('MixedLoggingForm — characterization', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // ================================================================
  // Header rendering
  // ================================================================

  it('renders mesocycle name', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('Block A')).toBeInTheDocument()
  })

  it('renders template name as heading', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('Hybrid Day')).toBeInTheDocument()
  })

  it('renders formatted date with weekday', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('Sun 15/03/2026')).toBeInTheDocument()
  })

  // ================================================================
  // Section ordering and headers
  // ================================================================

  it('renders sections sorted by order', () => {
    const reversed = makeData([
      makeSection({ id: 3, section_name: 'Last', modality: 'mma', order: 3, planned_duration: 30 }),
      makeSection({ id: 1, section_name: 'First', modality: 'resistance', order: 1, slots: [makeSlot()] }),
      makeSection({ id: 2, section_name: 'Middle', modality: 'running', order: 2, run_type: 'easy' }),
    ])
    render(<MixedLoggingForm data={reversed} />)
    const headers = screen.getAllByTestId('mixed-section-header')
    expect(headers[0]).toHaveTextContent('First')
    expect(headers[1]).toHaveTextContent('Middle')
    expect(headers[2]).toHaveTextContent('Last')
  })

  it('renders modality badges', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    const badges = screen.getAllByTestId('mixed-section-modality')
    expect(badges[0]).toHaveTextContent('Resistance')
    expect(badges[1]).toHaveTextContent('Running')
    expect(badges[2]).toHaveTextContent('MMA')
  })

  it('renders separator between sections but not before first', () => {
    const { container } = render(<MixedLoggingForm data={make3SectionData()} />)
    // There are 3 sections, so there should be 2 separators (border-t divs between sections)
    const separators = container.querySelectorAll('.border-t.border-border')
    expect(separators.length).toBe(2)
  })

  // ================================================================
  // Resistance section — initial state
  // ================================================================

  it('resistance: renders exercise names', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('Squat')).toBeInTheDocument()
    expect(screen.getByText('Leg Press')).toBeInTheDocument()
  })

  it('resistance: renders correct number of set rows per slot', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    // Squat: 3 sets, Leg Press: 2 sets = 5 set rows
    const setRows = screen.getAllByTestId('set-row')
    expect(setRows.length).toBe(5)
  })

  it('resistance: set number labels are 1-indexed per exercise', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    const labels = screen.getAllByTestId('set-number-label')
    // Squat: 1,2,3 Leg Press: 1,2
    expect(labels.map((l) => l.textContent)).toEqual(['1', '2', '3', '1', '2'])
  })

  it('resistance: weight inputs start empty with planned value as placeholder', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    const weightInput = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
    expect(weightInput.value).toBe('')
    expect(weightInput.placeholder).toBe('100')
  })

  it('resistance: reps inputs start empty with planned value as placeholder', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    const repsInput = screen.getByTestId('reps-input-0-0-0') as HTMLInputElement
    expect(repsInput.value).toBe('')
    expect(repsInput.placeholder).toBe('5')
  })

  it('resistance: weight placeholder is em-dash when null', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'BW',
        modality: 'resistance',
        order: 1,
        slots: [makeSlot({ weight: null })],
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    const weightInput = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
    expect(weightInput.placeholder).toBe('\u2014')
  })

  it('resistance: shows Main/Complementary badges', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('Main')).toBeInTheDocument()
    expect(screen.getByText('Complementary')).toBeInTheDocument()
  })

  it('resistance: RPE buttons 1-10 rendered per exercise', () => {
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
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: `RPE ${i}` })).toBeInTheDocument()
    }
  })

  it('resistance: shows planned RPE reference when slot has rpe', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getAllByText('(plan: 8)').length).toBeGreaterThan(0)
  })

  // ================================================================
  // Resistance section — interactions
  // ================================================================

  it('resistance: typing weight updates input value', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
    await user.type(input, '105')
    expect(input.value).toBe('105')
  })

  it('resistance: typing reps updates input value', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('reps-input-0-0-0') as HTMLInputElement
    await user.type(input, '6')
    expect(input.value).toBe('6')
  })

  it('resistance: clicking RPE button selects it', async () => {
    const user = userEvent.setup()
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
    const btn = screen.getByRole('button', { name: 'RPE 7' })
    await user.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('resistance: clicking same RPE toggles it off', async () => {
    const user = userEvent.setup()
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
    const btn = screen.getByRole('button', { name: 'RPE 7' })
    await user.click(btn)
    await user.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('resistance: Add Set copies last set values', async () => {
    const user = userEvent.setup()
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'S',
        modality: 'resistance',
        order: 1,
        slots: [makeSlot({ sets: 1 })],
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    // Type into the first set
    await user.type(screen.getByTestId('weight-input-0-0-0'), '90')
    await user.type(screen.getByTestId('reps-input-0-0-0'), '5')
    // Add set
    await user.click(screen.getByText('+ Add Set'))
    // New set should have same values
    const newWeight = screen.getByTestId('weight-input-0-0-1') as HTMLInputElement
    const newReps = screen.getByTestId('reps-input-0-0-1') as HTMLInputElement
    expect(newWeight.value).toBe('90')
    expect(newReps.value).toBe('5')
  })

  it('resistance: remove set disabled when only one set', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'S',
        modality: 'resistance',
        order: 1,
        slots: [makeSlot({ sets: 1 })],
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    const removeBtn = screen.getByRole('button', { name: 'Remove set 1' })
    expect(removeBtn).toBeDisabled()
  })

  it('resistance: remove set works when multiple sets', async () => {
    const user = userEvent.setup()
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'S',
        modality: 'resistance',
        order: 1,
        slots: [makeSlot({ sets: 2 })],
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getAllByTestId('set-row')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Remove set 2' }))
    expect(screen.getAllByTestId('set-row')).toHaveLength(1)
  })

  // ================================================================
  // Running section — initial state
  // ================================================================

  it('running: shows planned reference with run type badge', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    // "Easy" badge rendered inside running section's planned reference
    expect(screen.getByText('Easy')).toBeInTheDocument()
    // Multiple "Planned" headings possible (running + mma), just check at least one
    expect(screen.getAllByText('Planned').length).toBeGreaterThanOrEqual(1)
  })

  it('running: shows target pace in planned reference', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('6:00/km')).toBeInTheDocument()
    expect(screen.getByText('Target Pace')).toBeInTheDocument()
  })

  it('running: shows HR zone in planned reference', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('Zone 2')).toBeInTheDocument()
  })

  it('running: shows coaching cues when present', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Run',
        modality: 'running',
        order: 1,
        run_type: 'easy',
        coaching_cues: 'Keep it relaxed',
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByText('Keep it relaxed')).toBeInTheDocument()
    expect(screen.getByText('Coaching Cues')).toBeInTheDocument()
  })

  it('running: omits coaching cues when null', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.queryByText('Coaching Cues')).not.toBeInTheDocument()
  })

  it('running: actual inputs start empty', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    // Running is section index 1 (0-based in render)
    expect((screen.getByTestId('actual-distance-1') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-avg-pace-1') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('actual-avg-hr-1') as HTMLInputElement).value).toBe('')
  })

  it('running: interval planned fields shown for interval run_type', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Speed Work',
        modality: 'running',
        order: 1,
        run_type: 'interval',
        interval_count: 6,
        interval_rest: 90,
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    // "Intervals" label inside planned reference
    expect(screen.getByText('Intervals')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Rest')).toBeInTheDocument()
    expect(screen.getByText('1m30s')).toBeInTheDocument()
  })

  it('running: interval fields hidden for non-interval run_type', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    // "easy" run type should not show Intervals/Rest
    expect(screen.queryByText('Rest')).not.toBeInTheDocument()
  })

  // ================================================================
  // Running section — interactions
  // ================================================================

  it('running: typing distance updates value', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('actual-distance-1') as HTMLInputElement
    await user.type(input, '5.5')
    expect(input.value).toBe('5.5')
  })

  it('running: typing pace updates value', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('actual-avg-pace-1') as HTMLInputElement
    await user.type(input, '5:45/km')
    expect(input.value).toBe('5:45/km')
  })

  it('running: typing HR updates value', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('actual-avg-hr-1') as HTMLInputElement
    await user.type(input, '155')
    expect(input.value).toBe('155')
  })

  // ================================================================
  // MMA section — initial state
  // ================================================================

  it('mma: shows planned duration reference', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByText('60 min')).toBeInTheDocument()
  })

  it('mma: shows "No planned duration set" when null', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Grappling',
        modality: 'mma',
        order: 1,
        planned_duration: null,
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByText('No planned duration set')).toBeInTheDocument()
  })

  it('mma: actual duration input starts empty', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('actual-duration-2') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('mma: feeling buttons 1-5 rendered', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Feeling ${i}` })).toBeInTheDocument()
    }
  })

  it('mma: feeling starts unselected', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Feeling ${i}` }).getAttribute('aria-pressed')).toBe('false')
    }
  })

  // ================================================================
  // MMA section — interactions
  // ================================================================

  it('mma: typing duration updates value', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const input = screen.getByTestId('actual-duration-2') as HTMLInputElement
    await user.type(input, '45')
    expect(input.value).toBe('45')
  })

  it('mma: clicking feeling selects it (fills up to that star)', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByRole('button', { name: 'Feeling 3' }))
    // Stars 1-3 pressed, 4-5 not
    expect(screen.getByRole('button', { name: 'Feeling 1' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Feeling 3' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('mma: clicking same feeling toggles it off', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByRole('button', { name: 'Feeling 3' }))
    await user.click(screen.getByRole('button', { name: 'Feeling 3' }))
    expect(screen.getByRole('button', { name: 'Feeling 3' }).getAttribute('aria-pressed')).toBe('false')
  })

  // ================================================================
  // Rating + notes
  // ================================================================

  it('renders rating buttons 1-5', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i}` })).toBeInTheDocument()
    }
  })

  it('clicking rating selects it', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const btn = screen.getByRole('button', { name: 'Rate 4' })
    await user.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking same rating toggles it off', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const btn = screen.getByRole('button', { name: 'Rate 4' })
    await user.click(btn)
    await user.click(btn)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders notes textarea', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByLabelText('Workout Notes')).toBeInTheDocument()
  })

  it('typing in notes updates textarea', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    const textarea = screen.getByLabelText('Workout Notes') as HTMLTextAreaElement
    await user.type(textarea, 'Felt strong')
    expect(textarea.value).toBe('Felt strong')
  })

  // ================================================================
  // Save behavior
  // ================================================================

  it('renders save button with correct text', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    const btn = screen.getByTestId('save-mixed-btn')
    expect(btn).toHaveTextContent('Save Workout')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('save calls saveMixedWorkout with correct structure for empty form', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveMixedWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByTestId('save-mixed-btn'))

    expect(mockSave).toHaveBeenCalledWith({
      templateId: 100,
      logDate: '2026-03-15',
      rating: null,
      notes: null,
      sections: [
        // Resistance section
        expect.objectContaining({
          sectionId: 1,
          modality: 'resistance',
          exercises: expect.arrayContaining([
            expect.objectContaining({
              exerciseName: 'Squat',
              rpe: null,
              sets: expect.arrayContaining([
                { weight: null, reps: null },
              ]),
            }),
          ]),
        }),
        // Running section
        expect.objectContaining({
          sectionId: 2,
          modality: 'running',
          actualDistance: null,
          actualAvgPace: null,
          actualAvgHr: null,
        }),
        // MMA section
        expect.objectContaining({
          sectionId: 3,
          modality: 'mma',
          actualDurationMinutes: null,
          feeling: null,
        }),
      ],
    })
  })

  it('save with filled values passes parsed numbers', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveMixedWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<MixedLoggingForm data={make3SectionData()} />)

    // Fill resistance
    await user.type(screen.getByTestId('weight-input-0-0-0'), '100')
    await user.type(screen.getByTestId('reps-input-0-0-0'), '5')

    // Fill running
    await user.type(screen.getByTestId('actual-distance-1'), '5')
    await user.type(screen.getByTestId('actual-avg-pace-1'), '6:00/km')
    await user.type(screen.getByTestId('actual-avg-hr-1'), '140')

    // Fill MMA
    await user.type(screen.getByTestId('actual-duration-2'), '45')

    // Rate and note
    await user.click(screen.getByRole('button', { name: 'Rate 4' }))
    await user.type(screen.getByLabelText('Workout Notes'), 'Good session')

    await user.click(screen.getByTestId('save-mixed-btn'))

    const call = mockSave.mock.calls[0][0]
    expect(call.rating).toBe(4)
    expect(call.notes).toBe('Good session')

    // Resistance: first set of first exercise
    const resistanceSec = call.sections[0]
    expect(resistanceSec.modality).toBe('resistance')
    if (resistanceSec.modality === 'resistance') {
      expect(resistanceSec.exercises[0].sets[0]).toEqual({ weight: 100, reps: 5 })
    }

    // Running
    const runningSec = call.sections[1]
    expect(runningSec.modality).toBe('running')
    if (runningSec.modality === 'running') {
      expect(runningSec.actualDistance).toBe(5)
      expect(runningSec.actualAvgPace).toBe('6:00/km')
      expect(runningSec.actualAvgHr).toBe(140)
    }

    // MMA
    const mmaSec = call.sections[2]
    expect(mmaSec.modality).toBe('mma')
    if (mmaSec.modality === 'mma') {
      expect(mmaSec.actualDurationMinutes).toBe(45)
    }
  })

  it('shows success message after save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMixedWorkout).mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByTestId('save-mixed-btn'))
    expect(await screen.findByTestId('save-success')).toBeInTheDocument()
    expect(screen.getByText('Workout saved!')).toBeInTheDocument()
  })

  it('disables save button and shows "Saved" after success', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMixedWorkout).mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByTestId('save-mixed-btn'))
    await screen.findByTestId('save-success')
    expect(screen.getByTestId('save-mixed-btn')).toBeDisabled()
    expect(screen.getByTestId('save-mixed-btn')).toHaveTextContent('Saved')
  })

  it('shows error message on failed save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMixedWorkout).mockResolvedValueOnce({ success: false, error: 'Already logged' })
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByTestId('save-mixed-btn'))
    expect(await screen.findByTestId('save-error')).toBeInTheDocument()
    expect(screen.getByText('Already logged')).toBeInTheDocument()
  })

  it('calls onSaveSuccess callback after successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMixedWorkout).mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })
    const onSuccess = vi.fn()
    render(<MixedLoggingForm data={make3SectionData()} onSaveSuccess={onSuccess} />)
    await user.click(screen.getByTestId('save-mixed-btn'))
    await screen.findByTestId('save-success')
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  // ================================================================
  // Log as Planned button
  // ================================================================

  it('shows Log as Planned button on initial render', () => {
    render(<MixedLoggingForm data={make3SectionData()} />)
    expect(screen.getByTestId('log-as-planned-btn')).toBeInTheDocument()
  })

  it('hides Log as Planned when resistance weight is modified', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.type(screen.getByTestId('weight-input-0-0-0'), '1')
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('hides Log as Planned when running distance is modified', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.type(screen.getByTestId('actual-distance-1'), '5')
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('hides Log as Planned when MMA duration is modified', async () => {
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.type(screen.getByTestId('actual-duration-2'), '45')
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('Log as Planned scrolls to rating section and shows toast', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<MixedLoggingForm data={make3SectionData()} />)

    const ratingSection = screen.getByTestId('rating-notes-section')
    ratingSection.scrollIntoView = vi.fn()

    await user.click(screen.getByTestId('log-as-planned-btn'))
    expect(ratingSection.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(toast.info).toHaveBeenCalledWith('Review and save when ready.')
  })

  it('hides Log as Planned after successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMixedWorkout).mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })
    render(<MixedLoggingForm data={make3SectionData()} />)
    await user.click(screen.getByTestId('save-mixed-btn'))
    await screen.findByTestId('save-success')
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  it('does not show Log as Planned when no sections', () => {
    render(<MixedLoggingForm data={makeData([])} />)
    expect(screen.queryByTestId('log-as-planned-btn')).not.toBeInTheDocument()
  })

  // ================================================================
  // Edge: multiple resistance sections
  // ================================================================

  it('handles multiple resistance sections with independent state', async () => {
    const user = userEvent.setup()
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Upper',
        modality: 'resistance',
        order: 1,
        slots: [makeSlot({ id: 1, exercise_name: 'Bench', sets: 2 })],
      }),
      makeSection({
        id: 2,
        section_name: 'Lower',
        modality: 'resistance',
        order: 2,
        slots: [makeSlot({ id: 3, exercise_name: 'Squat', sets: 2, order: 1 })],
      }),
    ])
    render(<MixedLoggingForm data={data} />)

    // Section 0 has exercise in slot 0; section 1 has exercise in slot 0
    // Testid format: weight-input-{sectionIndex}-{slotIndex}-{setIndex}
    const upperWeight = screen.getByTestId('weight-input-0-0-0') as HTMLInputElement
    const lowerWeight = screen.getByTestId('weight-input-1-0-0') as HTMLInputElement

    await user.type(upperWeight, '80')
    expect(upperWeight.value).toBe('80')
    expect(lowerWeight.value).toBe('')
  })

  // ================================================================
  // formatRest utility (tested via rendered output)
  // ================================================================

  it('formatRest: seconds < 60 shown as Ns', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Int',
        modality: 'running',
        order: 1,
        run_type: 'interval',
        interval_rest: 45,
        interval_count: 3,
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByText('45s')).toBeInTheDocument()
  })

  it('formatRest: exact minutes shown as Nm', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Int',
        modality: 'running',
        order: 1,
        run_type: 'interval',
        interval_rest: 120,
        interval_count: 3,
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('formatRest: minutes+seconds shown as NmNs', () => {
    const data = makeData([
      makeSection({
        id: 1,
        section_name: 'Int',
        modality: 'running',
        order: 1,
        run_type: 'interval',
        interval_rest: 90,
        interval_count: 3,
      }),
    ])
    render(<MixedLoggingForm data={data} />)
    expect(screen.getByText('1m30s')).toBeInTheDocument()
  })

  // ================================================================
  // Export
  // ================================================================

  it('exports MixedWorkoutData type (compile-time check)', () => {
    const data: MixedWorkoutData = make3SectionData()
    expect(data.date).toBe('2026-03-15')
  })
})
