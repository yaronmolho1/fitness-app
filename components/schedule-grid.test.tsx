// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/schedule/actions', () => ({
  assignTemplate: vi.fn(),
  removeAssignment: vi.fn(),
  updateScheduleEntry: vi.fn(),
}))

vi.mock('@/components/rotation-editor-modal', () => ({
  RotationEditorModal: () => null,
}))

import { ScheduleGrid } from './schedule-grid'
import { assignTemplate, removeAssignment } from '@/lib/schedule/actions'
import type { ScheduleEntry } from '@/lib/schedule/queries'

const mockTemplates = [
  { id: 1, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' as const },
  { id: 2, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' as const },
  { id: 3, name: 'Legs A', canonical_name: 'legs-a', modality: 'resistance' as const },
  { id: 4, name: 'Strength + Cardio', canonical_name: 'strength-cardio', modality: 'mixed' as const },
  { id: 5, name: 'Easy Run', canonical_name: 'easy-run', modality: 'running' as const, target_duration: 45 },
  { id: 6, name: 'MMA Sparring', canonical_name: 'mma-sparring', modality: 'mma' as const, planned_duration: 60 },
  { id: 7, name: 'Upper Body', canonical_name: 'upper-body', modality: 'resistance' as const, estimated_duration: 75 },
]

let nextId = 1

function buildSchedule(
  assignments: Array<{
    day_of_week: number
    template_id: number
    template_name: string
    period?: 'morning' | 'afternoon' | 'evening'
    time_slot?: string
    duration?: number
  }>
): ScheduleEntry[] {
  return assignments.map((a) => ({
    id: nextId++,
    day_of_week: a.day_of_week,
    template_id: a.template_id,
    template_name: a.template_name,
    period: a.period ?? 'morning',
    time_slot: a.time_slot ?? '07:00',
    duration: a.duration ?? 90,
    cycle_length: 1,
    cycle_position: 1,
  }))
}

describe('ScheduleGrid', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.restoreAllMocks()
    nextId = 1
  })

  it('renders all 7 day labels', () => {
    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={[]}
        isCompleted={false}
        variant="normal"
      />
    )

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for (const day of dayNames) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
  })

  it('shows rest state for unassigned days', () => {
    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={[]}
        isCompleted={false}
        variant="normal"
      />
    )

    const restLabels = screen.getAllByTestId('rest-label')
    expect(restLabels).toHaveLength(7)
    for (const label of restLabels) {
      expect(label).toHaveTextContent('Rest')
    }
  })

  it('rest days show no template name', () => {
    const schedule = buildSchedule([
      { day_of_week: 0, template_id: 1, template_name: 'Push A' },
    ])

    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={schedule}
        isCompleted={false}
        variant="normal"
      />
    )

    const tuesdayCell = screen.getByTestId('day-cell-1')
    expect(within(tuesdayCell).getByTestId('rest-label')).toHaveTextContent('Rest')
    expect(within(tuesdayCell).queryByText('Push A')).not.toBeInTheDocument()
  })

  it('rest days have dashed border styling', () => {
    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={[]}
        isCompleted={false}
        variant="normal"
      />
    )

    const dayCell = screen.getByTestId('day-cell-0')
    expect(dayCell.className).toContain('border-dashed')
  })

  it('shows template name for assigned days', () => {
    const schedule = buildSchedule([
      { day_of_week: 0, template_id: 1, template_name: 'Push A' },
      { day_of_week: 2, template_id: 3, template_name: 'Legs A' },
    ])

    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={schedule}
        isCompleted={false}
        variant="normal"
      />
    )

    expect(screen.getByText('Push A')).toBeInTheDocument()
    expect(screen.getByText('Legs A')).toBeInTheDocument()
  })

  it('disables interactions when mesocycle is completed', () => {
    const schedule = buildSchedule([
      { day_of_week: 0, template_id: 1, template_name: 'Push A' },
    ])

    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={schedule}
        isCompleted={true}
        variant="normal"
      />
    )

    expect(screen.queryByRole('button', { name: /add workout/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('day cell has assigned styling when at least one entry exists', () => {
    const schedule = buildSchedule([
      { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
    ])

    render(
      <ScheduleGrid
        mesocycleId={1}
        templates={mockTemplates}
        schedule={schedule}
        isCompleted={false}
        variant="normal"
      />
    )

    const mondayCell = screen.getByTestId('day-cell-0')
    expect(mondayCell.className).not.toContain('border-dashed')
  })

  // ===== T201: Time-first UI =====

  describe('single add workout button', () => {
    it('shows single "+ Add Workout" button per day instead of 3 period buttons', () => {
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      // Should have single add button
      expect(within(mondayCell).getByRole('button', { name: /add workout/i })).toBeInTheDocument()
      // Should NOT have period-specific buttons
      expect(within(mondayCell).queryByRole('button', { name: /add morning/i })).not.toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button', { name: /add afternoon/i })).not.toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button', { name: /add evening/i })).not.toBeInTheDocument()
    })

    it('still shows "+ Add Workout" when day already has entries (unlimited)', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', time_slot: '13:00' },
        { day_of_week: 0, template_id: 3, template_name: 'Legs A', time_slot: '18:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      expect(within(mondayCell).getByRole('button', { name: /add workout/i })).toBeInTheDocument()
    })

    it('no add button when completed', () => {
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={true}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      expect(within(mondayCell).queryByRole('button', { name: /add workout/i })).not.toBeInTheDocument()
    })
  })

  describe('inline form', () => {
    it('clicking "+ Add Workout" opens inline form with template picker, then time/duration after selection', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      // Form should appear with assignment type picker
      const form = within(mondayCell).getByTestId('add-workout-form')
      expect(form).toBeInTheDocument()
      expect(within(form).getByText('Assign template')).toBeInTheDocument()
      expect(within(form).getByText('Assign rotation')).toBeInTheDocument()

      // Select "Assign template" to see template picker
      await user.click(within(form).getByText('Assign template'))
      expect(within(form).getByText('Push A')).toBeInTheDocument()

      // Select template to see time/duration inputs
      await user.click(within(form).getByText('Push A'))
      expect(within(form).getByLabelText(/time/i)).toBeInTheDocument()
      expect(within(form).getByLabelText(/duration/i)).toBeInTheDocument()
    })

    it('selecting template with no duration defaults to 90 min for resistance', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      // Click Push A (resistance, no duration fields)
      await user.click(within(form).getByText('Push A'))

      const durationTrigger = within(form).getByLabelText(/duration/i)
      expect(durationTrigger).toHaveValue('90')
    })

    it('selecting running template pre-fills target_duration', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Easy Run'))

      const durationTrigger = within(form).getByLabelText(/duration/i)
      expect(durationTrigger).toHaveValue('45')
    })

    it('selecting MMA template pre-fills planned_duration', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('MMA Sparring'))

      const durationTrigger = within(form).getByLabelText(/duration/i)
      expect(durationTrigger).toHaveValue('60')
    })

    it('selecting resistance template with estimated_duration pre-fills it', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Upper Body'))

      const durationTrigger = within(form).getByLabelText(/duration/i)
      expect(durationTrigger).toHaveValue('75')
    })

    it('submits form with default time and duration to assignTemplate', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: true,
        data: {
          id: 10,
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 1,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 90,
          cycle_length: 1,
          cycle_position: 1,
          created_at: new Date(),
        },
      })

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Push A'))

      // Time defaults to 07:00, duration defaults to 90 (1h 30m) for resistance
      expect(within(form).getByLabelText(/time/i)).toHaveValue('07:00')
      expect(within(form).getByLabelText(/duration/i)).toHaveValue('90')

      await user.click(within(form).getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(assignTemplate).toHaveBeenCalledWith({
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 1,
          week_type: 'normal',
          time_slot: '07:00',
          duration: 90,
        })
      })
    })

    it('submits form with template default duration', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: true,
        data: {
          id: 10,
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 5,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 45,
          cycle_length: 1,
          cycle_position: 1,
          created_at: new Date(),
        },
      })

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Easy Run'))

      // Duration pre-filled from Easy Run's target_duration (45)
      expect(within(form).getByLabelText(/duration/i)).toHaveValue('45')

      await user.click(within(form).getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(assignTemplate).toHaveBeenCalledWith({
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 5,
          week_type: 'normal',
          time_slot: '07:00',
          duration: 45,
        })
      })
    })

    it('displays error when assignTemplate fails', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: false,
        error: 'Template not found',
      })

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Push A'))

      await user.click(within(form).getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(screen.getByText(/template not found/i)).toBeInTheDocument()
      })
    })

    it('cancel button closes the form without submitting', async () => {
      const user = userEvent.setup()

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      expect(within(mondayCell).getByTestId('add-workout-form')).toBeInTheDocument()

      // Select a template first to get to the cancel button
      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Push A'))

      await user.click(within(mondayCell).getByRole('button', { name: /cancel/i }))

      expect(within(mondayCell).queryByTestId('add-workout-form')).not.toBeInTheDocument()
      expect(assignTemplate).not.toHaveBeenCalled()
    })
  })

  describe('chronological sorting', () => {
    it('orders entries by time_slot chronologically', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 3, template_name: 'Legs A', period: 'evening', time_slot: '18:00' },
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', period: 'afternoon', time_slot: '13:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      const entries = within(mondayCell).getAllByTestId('schedule-entry')
      expect(entries).toHaveLength(3)
      expect(within(entries[0]).getByText('Push A')).toBeInTheDocument()
      expect(within(entries[1]).getByText('Pull A')).toBeInTheDocument()
      expect(within(entries[2]).getByText('Legs A')).toBeInTheDocument()
    })

    it('sorts entries within same period by time', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', time_slot: '09:00', period: 'morning' },
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '06:30', period: 'morning' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      const entries = within(mondayCell).getAllByTestId('schedule-entry')
      expect(entries).toHaveLength(2)
      expect(within(entries[0]).getByText('Push A')).toBeInTheDocument()
      expect(within(entries[1]).getByText('Pull A')).toBeInTheDocument()
    })
  })

  describe('derived period headers', () => {
    it('shows period label derived from time_slot', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '07:00', period: 'morning' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', time_slot: '18:00', period: 'evening' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      const entries = within(mondayCell).getAllByTestId('schedule-entry')
      expect(within(entries[0]).getByTestId('period-label')).toHaveTextContent('Morning')
      expect(within(entries[1]).getByTestId('period-label')).toHaveTextContent('Evening')
    })

    it('displays time alongside period label', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '08:30', period: 'morning' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      const entry = within(mondayCell).getByTestId('schedule-entry')
      // Should display the time
      expect(within(entry).getByTestId('time-display')).toHaveTextContent('08:30')
    })
  })

  describe('overlap warning', () => {
    it('shows overlap warning when new entry default time intersects existing', async () => {
      const user = userEvent.setup()
      // Existing entry at 07:00 with 90min → occupies 07:00-08:30
      // New entry defaults to 07:00 with 90min → overlaps
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '07:00', duration: 90 },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Pull A'))

      // Default time 07:00 overlaps with existing 07:00-08:30
      expect(within(form).getByTestId('overlap-warning')).toBeInTheDocument()
    })

    it('no overlap warning when time ranges do not intersect', async () => {
      const user = userEvent.setup()
      // Existing entry at 10:00 with 60min → occupies 10:00-11:00
      // New entry defaults to 07:00 with 90min → no overlap
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '10:00', duration: 60 },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Pull A'))

      expect(within(form).queryByTestId('overlap-warning')).not.toBeInTheDocument()
    })

    it('overlap warning is non-blocking (can still submit)', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: true,
        data: {
          id: 10,
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 2,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 90,
          cycle_length: 1,
          cycle_position: 1,
          created_at: new Date(),
        },
      })

      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', time_slot: '07:00', duration: 90 },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Pull A'))

      // Default time 07:00 overlaps — warning shows but confirm still enabled
      expect(within(form).getByTestId('overlap-warning')).toBeInTheDocument()
      const confirmBtn = within(form).getByRole('button', { name: /confirm/i })
      expect(confirmBtn).not.toBeDisabled()
      await user.click(confirmBtn)

      await waitFor(() => {
        expect(assignTemplate).toHaveBeenCalled()
      })
    })
  })

  describe('multiple entries per day', () => {
    it('renders multiple entries stacked within a day cell', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', period: 'evening', time_slot: '18:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      expect(within(mondayCell).getByText('Push A')).toBeInTheDocument()
      expect(within(mondayCell).getByText('Pull A')).toBeInTheDocument()
    })

    it('remove works for individual entries', async () => {
      const user = userEvent.setup()
      vi.mocked(removeAssignment).mockResolvedValue({ success: true })

      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', period: 'evening', time_slot: '18:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      const entries = within(mondayCell).getAllByTestId('schedule-entry')
      const removeBtn = within(entries[0]).getByRole('button', { name: /remove/i })
      await user.click(removeBtn)

      await waitFor(() => {
        expect(removeAssignment).toHaveBeenCalledWith({ id: schedule[0].id })
      })
    })

    it('optimistically adds entry after successful assignment', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: true,
        data: {
          id: 10,
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 2,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 90,
          cycle_length: 1,
          cycle_position: 1,
          created_at: new Date(),
        },
      })

      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '10:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Pull A'))

      // Uses default time 07:00
      await user.click(within(form).getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(within(mondayCell).getByText('Push A')).toBeInTheDocument()
        // Pull A was added optimistically
        expect(within(mondayCell).getByText('Pull A')).toBeInTheDocument()
      })
    })

    it('no add or remove buttons when completed with multiple entries', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', period: 'evening', time_slot: '18:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={true}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      expect(within(mondayCell).getByText('Push A')).toBeInTheDocument()
      expect(within(mondayCell).getByText('Pull A')).toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button')).not.toBeInTheDocument()
    })

    it('optimistically removes single entry without affecting others', async () => {
      const user = userEvent.setup()
      vi.mocked(removeAssignment).mockResolvedValue({ success: true })

      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', period: 'evening', time_slot: '18:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      const entries = within(mondayCell).getAllByTestId('schedule-entry')
      const removeBtn = within(entries[0]).getByRole('button', { name: /remove/i })
      await user.click(removeBtn)

      await waitFor(() => {
        expect(within(mondayCell).queryByText('Push A')).not.toBeInTheDocument()
        expect(within(mondayCell).getByText('Pull A')).toBeInTheDocument()
      })
    })

    // T123: mixed template in schedule grid
    it('renders mixed template name in schedule entry', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 4, template_name: 'Strength + Cardio', period: 'morning', time_slot: '07:00' },
      ])

      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={schedule}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      expect(within(mondayCell).getByText('Strength + Cardio')).toBeInTheDocument()
    })
  })

  describe('select dropdowns prevent invalid input', () => {
    it('time select defaults to valid HH:MM value', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Push A'))

      // Select dropdowns always have valid values — no free-text entry possible
      expect(within(form).getByLabelText(/time/i)).toHaveValue('07:00')
      expect(within(form).getByLabelText(/duration/i)).toHaveValue('90')
    })

    it('cancel button closes form without submitting', async () => {
      const user = userEvent.setup()
      render(
        <ScheduleGrid
          mesocycleId={1}
          templates={mockTemplates}
          schedule={[]}
          isCompleted={false}
          variant="normal"
        />
      )

      const mondayCell = screen.getByTestId('day-cell-0')
      await user.click(within(mondayCell).getByRole('button', { name: /add workout/i }))

      const form = within(mondayCell).getByTestId('add-workout-form')
      await user.click(within(form).getByText('Assign template'))
      await user.click(within(form).getByText('Push A'))

      await user.click(within(form).getByRole('button', { name: /cancel/i }))

      expect(within(mondayCell).queryByTestId('add-workout-form')).not.toBeInTheDocument()
      expect(assignTemplate).not.toHaveBeenCalled()
    })
  })
})
