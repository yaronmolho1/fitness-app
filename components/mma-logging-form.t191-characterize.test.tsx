// Characterization test — captures current behavior for safe refactoring
// Focus: initial state of actual fields (T191 autofill scope)
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@/lib/workouts/actions', () => ({
  saveMmaWorkout: vi.fn(),
}))

vi.mock('@/lib/ui/modality-colors', () => ({
  getModalityAccentClass: () => 'border-rose-500',
}))

import { MmaLoggingForm } from './mma-logging-form'
import type { MmaWorkoutData } from './mma-logging-form'
import { saveMmaWorkout } from '@/lib/workouts/actions'

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'BJJ Sparring',
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

describe('MmaLoggingForm — T191 autofill characterization', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // ================================================================
  // Current behavior: actual fields are always empty on mount
  // planned_duration is displayed read-only but NOT pre-filled
  // ================================================================

  it('duration input starts empty even when planned_duration is set', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: 90 }) })}
      />
    )
    const input = screen.getByTestId('actual-duration') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('duration input starts empty when planned_duration is null', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: null }) })}
      />
    )
    const input = screen.getByTestId('actual-duration') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('feeling is null on mount (no star selected)', () => {
    render(<MmaLoggingForm data={makeData()} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Rate ${i}` }).getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('notes textarea starts empty', () => {
    render(<MmaLoggingForm data={makeData()} />)
    const textarea = screen.getByLabelText('Notes') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  // ================================================================
  // Planned reference section
  // ================================================================

  it('shows planned duration when present', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: 90 }) })}
      />
    )
    expect(screen.getByText('90 min')).toBeInTheDocument()
  })

  it('shows "No planned duration set" when planned_duration is null', () => {
    render(
      <MmaLoggingForm
        data={makeData({ template: makeTemplate({ planned_duration: null }) })}
      />
    )
    expect(screen.getByText('No planned duration set')).toBeInTheDocument()
  })

  // ================================================================
  // Header
  // ================================================================

  it('renders template name', () => {
    render(<MmaLoggingForm data={makeData()} />)
    expect(screen.getByText('BJJ Sparring')).toBeInTheDocument()
  })

  it('renders MMA badge', () => {
    render(<MmaLoggingForm data={makeData()} />)
    expect(screen.getByTestId('mma-badge')).toHaveTextContent('MMA / BJJ')
  })

  it('renders mesocycle name', () => {
    render(<MmaLoggingForm data={makeData()} />)
    expect(screen.getByText('Block A')).toBeInTheDocument()
  })

  // ================================================================
  // Save behavior with empty fields
  // ================================================================

  it('save with all empty sends null values', async () => {
    const user = userEvent.setup()
    const mockSave = vi.mocked(saveMmaWorkout)
    mockSave.mockResolvedValueOnce({ success: true, data: { workoutId: 1 } })

    render(<MmaLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-mma-btn'))

    expect(mockSave).toHaveBeenCalledWith({
      templateId: 1,
      logDate: '2026-03-15',
      actualDurationMinutes: null,
      feeling: null,
      notes: null,
    })
  })

  it('shows success message after save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMmaWorkout).mockResolvedValueOnce({
      success: true,
      data: { workoutId: 1 },
    })

    render(<MmaLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-mma-btn'))

    expect(await screen.findByTestId('save-success')).toBeInTheDocument()
    expect(screen.getByText('Session logged!')).toBeInTheDocument()
  })

  it('save button text is "Save Session"', () => {
    render(<MmaLoggingForm data={makeData()} />)
    expect(screen.getByTestId('save-mma-btn')).toHaveTextContent('Save Session')
  })

  it('disables save button after successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(saveMmaWorkout).mockResolvedValueOnce({
      success: true,
      data: { workoutId: 1 },
    })

    render(<MmaLoggingForm data={makeData()} />)
    await user.click(screen.getByTestId('save-mma-btn'))
    await screen.findByTestId('save-success')

    expect(screen.getByTestId('save-mma-btn')).toBeDisabled()
    expect(screen.getByTestId('save-mma-btn')).toHaveTextContent('Saved')
  })
})
