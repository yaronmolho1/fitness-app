// @vitest-environment jsdom
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/progression/actions', () => ({
  upsertWeekOverrideAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteWeekOverrideAction: vi.fn().mockResolvedValue({ success: true }),
  getWeekOverridesAction: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { WeekProgressionGrid } from './week-progression-grid'
import { upsertWeekOverrideAction, deleteWeekOverrideAction, getWeekOverridesAction } from '@/lib/progression/actions'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

const makeSlot = (overrides: Partial<SlotWithExercise> = {}): SlotWithExercise => ({
  id: 1,
  template_id: 1,
  exercise_id: 1,
  section_id: null,
  sets: 3,
  reps: '10',
  weight: 60,
  rpe: 7,
  rest_seconds: 120,
  group_id: null,
  group_rest_seconds: null,
  guidelines: null,
  order: 1,
  is_main: false,
  created_at: new Date(),
  exercise_name: 'Bench Press',
  duration: null,
  overrideCount: 0,
  ...overrides,
})

type Props = Parameters<typeof WeekProgressionGrid>[0]

const defaultProps: Props = {
  slot: makeSlot(),
  workWeeks: 4,
  hasDeload: false,
  isCompleted: false,
  open: true,
  onOpenChange: vi.fn(),
}

describe('WeekProgressionGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getWeekOverridesAction).mockResolvedValue([])
  })

  afterEach(cleanup)

  // AC1: Grid shows correct number of rows matching mesocycle work_weeks
  describe('row count', () => {
    it('shows one row per work week', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={4} hasDeload={false} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-4')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('week-row-deload')).not.toBeInTheDocument()
    })

    // AC5: Deload row appears when mesocycle has_deload is true
    it('shows deload row when hasDeload is true', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={3} hasDeload={true} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-deload')).toBeInTheDocument()
      })
    })

    // Edge case: 1 work week
    it('shows single week row for work_weeks=1', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={1} hasDeload={false} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('week-row-2')).not.toBeInTheDocument()
    })
  })

  // AC2: Week 1 row pre-fills with base slot values
  describe('pre-fill with base values', () => {
    it('pre-fills week 1 with base slot values for resistance', async () => {
      const slot = makeSlot({ weight: 60, sets: 3, reps: '10', rpe: 7 })
      render(<WeekProgressionGrid {...defaultProps} slot={slot} />)
      await waitFor(() => {
        const row = screen.getByTestId('week-row-1')
        const inputs = within(row).getAllByRole('textbox')
        // weight, reps, sets, rpe
        expect(inputs.length).toBeGreaterThanOrEqual(4)
      })
      // Check the values are pre-filled
      const row = screen.getByTestId('week-row-1')
      expect(within(row).getByDisplayValue('60')).toBeInTheDocument()
      expect(within(row).getByDisplayValue('10')).toBeInTheDocument()
      expect(within(row).getByDisplayValue('3')).toBeInTheDocument()
      expect(within(row).getByDisplayValue('7')).toBeInTheDocument()
    })
  })

  // AC6: Deload defaults — 60% weight, 50% sets, RPE -2
  describe('deload defaults', () => {
    it('pre-fills deload row with computed defaults', async () => {
      const slot = makeSlot({ weight: 100, sets: 4, reps: '10', rpe: 8 })
      render(<WeekProgressionGrid {...defaultProps} slot={slot} hasDeload={true} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-deload')).toBeInTheDocument()
      })
      const deloadRow = screen.getByTestId('week-row-deload')
      // 60% of 100 = 60
      expect(within(deloadRow).getByDisplayValue('60')).toBeInTheDocument()
      // 50% of 4 = 2
      expect(within(deloadRow).getByDisplayValue('2')).toBeInTheDocument()
      // RPE 8 - 2 = 6
      expect(within(deloadRow).getByDisplayValue('6')).toBeInTheDocument()
      // Reps preserved at 100%
      expect(within(deloadRow).getByDisplayValue('10')).toBeInTheDocument()
    })
  })

  // AC3: Saving overrides calls upsertWeekOverrideAction
  describe('saving overrides', () => {
    it('calls upsert action when field is changed and saved', async () => {
      const user = userEvent.setup()
      render(<WeekProgressionGrid {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
      })

      const row2 = screen.getByTestId('week-row-2')
      const weightInput = within(row2).getByLabelText(/weight/i)
      await user.clear(weightInput)
      await user.type(weightInput, '65')

      const saveBtn = screen.getByRole('button', { name: /save/i })
      await user.click(saveBtn)

      await waitFor(() => {
        expect(upsertWeekOverrideAction).toHaveBeenCalledWith(
          1, // slotId
          2, // weekNumber
          expect.objectContaining({ weight: 65 })
        )
      })
    })
  })

  // AC4: Empty/cleared field deletes override (falls back to base)
  describe('clearing fields', () => {
    it('calls delete action when all fields cleared for a week', async () => {
      const user = userEvent.setup()
      vi.mocked(getWeekOverridesAction).mockResolvedValue([
        {
          id: 10,
          exercise_slot_id: 1,
          week_number: 2,
          weight: 65,
          reps: null,
          sets: null,
          rpe: null,
          distance: null,
          duration: null,
          pace: null,
          elevation_gain: null,
          is_deload: 0,
          created_at: new Date(),
        },
      ])

      render(<WeekProgressionGrid {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
      })

      const row2 = screen.getByTestId('week-row-2')
      const weightInput = within(row2).getByLabelText(/weight/i)
      await user.clear(weightInput)
      // Type the base value back (60) — same as base means no override needed
      await user.type(weightInput, '60')

      const saveBtn = screen.getByRole('button', { name: /save/i })
      await user.click(saveBtn)

      // When all values match base, the override should be deleted
      await waitFor(() => {
        expect(deleteWeekOverrideAction).toHaveBeenCalledWith(1, 2)
      })
    })
  })

  // AC8: Resistance fields — weight, sets, reps, RPE
  describe('resistance modality columns', () => {
    it('shows weight, sets, reps, RPE columns for resistance slot', async () => {
      render(<WeekProgressionGrid {...defaultProps} />)
      await waitFor(() => {
        const headers = screen.getByTestId('column-headers')
        expect(within(headers).getByText(/weight/i)).toBeInTheDocument()
        expect(within(headers).getByText(/sets/i)).toBeInTheDocument()
        expect(within(headers).getByText(/reps/i)).toBeInTheDocument()
        expect(within(headers).getByText(/rpe/i)).toBeInTheDocument()
      })
    })
  })

  // AC9: Running fields — distance, duration, pace
  describe('running modality columns', () => {
    it('shows distance, duration, pace columns for running slot', async () => {
      render(
        <WeekProgressionGrid
          {...defaultProps}
          slot={makeSlot()}
          modality="running"
          runningBase={{ distance: 5, duration: 30, pace: '6:00' }}
        />
      )
      await waitFor(() => {
        const headers = screen.getByTestId('column-headers')
        expect(within(headers).getByText(/distance/i)).toBeInTheDocument()
        expect(within(headers).getByText(/duration/i)).toBeInTheDocument()
        expect(within(headers).getByText(/pace/i)).toBeInTheDocument()
      })
    })
  })

  // Read-only in completed mesocycles
  describe('completed mesocycle', () => {
    it('renders all inputs as read-only when isCompleted is true', async () => {
      render(<WeekProgressionGrid {...defaultProps} isCompleted={true} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      })
      const inputs = screen.getAllByRole('textbox')
      for (const input of inputs) {
        expect(input).toHaveAttribute('readonly')
      }
    })

    it('does not show save button when completed', async () => {
      render(<WeekProgressionGrid {...defaultProps} isCompleted={true} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    })
  })

  // Loads existing overrides on mount
  describe('loading existing overrides', () => {
    it('displays saved overrides from server', async () => {
      vi.mocked(getWeekOverridesAction).mockResolvedValue([
        {
          id: 10,
          exercise_slot_id: 1,
          week_number: 2,
          weight: 62.5,
          reps: null,
          sets: null,
          rpe: null,
          distance: null,
          duration: null,
          pace: null,
          elevation_gain: null,
          is_deload: 0,
          created_at: new Date(),
        },
      ])

      render(<WeekProgressionGrid {...defaultProps} />)
      await waitFor(() => {
        const row2 = screen.getByTestId('week-row-2')
        expect(within(row2).getByDisplayValue('62.5')).toBeInTheDocument()
      })
    })
  })

  // Deload visual distinction
  describe('deload styling', () => {
    it('deload row has distinct visual class', async () => {
      render(<WeekProgressionGrid {...defaultProps} hasDeload={true} />)
      await waitFor(() => {
        const deloadRow = screen.getByTestId('week-row-deload')
        expect(deloadRow.className).toMatch(/deload|muted|dashed/)
      })
    })
  })

  // Title shows exercise name
  describe('dialog header', () => {
    it('shows exercise name in title', async () => {
      render(<WeekProgressionGrid {...defaultProps} />)
      expect(screen.getByText(/bench press/i)).toBeInTheDocument()
      expect(screen.getByText(/plan weeks/i)).toBeInTheDocument()
    })
  })

  // T219: activeWeeks filter
  describe('activeWeeks filter', () => {
    it('shows all weeks when activeWeeks is not provided (backward compat)', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={4} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-4')).toBeInTheDocument()
      })
    })

    it('shows only specified weeks when activeWeeks is provided', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={6} activeWeeks={[1, 3, 5]} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('week-row-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('week-row-4')).not.toBeInTheDocument()
      expect(screen.queryByTestId('week-row-6')).not.toBeInTheDocument()
    })

    it('shows no week rows when activeWeeks is empty', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={4} activeWeeks={[]} />)
      expect(screen.queryByTestId('week-row-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('week-row-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('week-row-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('week-row-4')).not.toBeInTheDocument()
    })

    it('preserves actual week numbers (not renumbered)', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={8} activeWeeks={[2, 5, 7]} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-7')).toBeInTheDocument()
      })
      // Verify labels show actual week numbers
      expect(screen.getByText('Week 2')).toBeInTheDocument()
      expect(screen.getByText('Week 5')).toBeInTheDocument()
      expect(screen.getByText('Week 7')).toBeInTheDocument()
      // Not renumbered to 1,2,3
      expect(screen.queryByTestId('week-row-1')).not.toBeInTheDocument()
    })

    it('shows deload row when hasDeload is true even with activeWeeks', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={8} activeWeeks={[1, 5]} hasDeload={true} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-deload')).toBeInTheDocument()
      })
    })

    it('hides deload row when hasDeload is false with activeWeeks', async () => {
      render(<WeekProgressionGrid {...defaultProps} workWeeks={8} activeWeeks={[1, 5]} hasDeload={false} />)
      await waitFor(() => {
        expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
        expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('week-row-deload')).not.toBeInTheDocument()
    })

    it('pre-fills active weeks with base slot values', async () => {
      const slot = makeSlot({ weight: 80, sets: 4, reps: '12', rpe: 7 })
      render(<WeekProgressionGrid {...defaultProps} slot={slot} workWeeks={6} activeWeeks={[3]} />)
      await waitFor(() => {
        const row = screen.getByTestId('week-row-3')
        expect(within(row).getByDisplayValue('80')).toBeInTheDocument()
        expect(within(row).getByDisplayValue('12')).toBeInTheDocument()
        expect(within(row).getByDisplayValue('4')).toBeInTheDocument()
      })
    })
  })
})
