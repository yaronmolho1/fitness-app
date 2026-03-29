// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/schedule/actions', () => ({
  assignTemplate: vi.fn(),
  removeAssignment: vi.fn(),
}))

import { ScheduleGrid } from './schedule-grid'
import { assignTemplate, removeAssignment } from '@/lib/schedule/actions'
import type { ScheduleEntry } from '@/lib/schedule/queries'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const mockTemplates = [
  { id: 1, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' as const },
  { id: 2, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' as const },
  { id: 3, name: 'Legs A', canonical_name: 'legs-a', modality: 'resistance' as const },
  { id: 4, name: 'Strength + Cardio', canonical_name: 'strength-cardio', modality: 'mixed' as const },
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
  }))
}

describe('ScheduleGrid', () => {
  afterEach(() => {
    cleanup()
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

    for (const day of DAY_NAMES) {
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

    expect(screen.queryByRole('button', { name: /assign/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
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

    // Click add button for morning on Monday
    const mondayCell = screen.getByTestId('day-cell-0')
    const addBtn = within(mondayCell).getByRole('button', { name: /add morning/i })
    await user.click(addBtn)

    // Select a template from the picker
    const templateOption = screen.getByText(/push a/i)
    await user.click(templateOption)

    await waitFor(() => {
      expect(screen.getByText(/template not found/i)).toBeInTheDocument()
    })
  })

  // ===== T113: Multiple entries per day =====

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

    it('orders entries by period: morning -> afternoon -> evening', () => {
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

    it('shows period label on each entry', () => {
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
      expect(within(entries[0]).getByTestId('period-label')).toHaveTextContent('Morning')
      expect(within(entries[1]).getByTestId('period-label')).toHaveTextContent('Evening')
    })

    it('shows add button for each unused period slot', () => {
      // Morning and evening assigned, afternoon should have add button
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
      expect(within(mondayCell).getByRole('button', { name: /add afternoon/i })).toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button', { name: /add morning/i })).not.toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button', { name: /add evening/i })).not.toBeInTheDocument()
    })

    it('empty day shows add buttons for all 3 periods', () => {
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
      expect(within(mondayCell).getByRole('button', { name: /add morning/i })).toBeInTheDocument()
      expect(within(mondayCell).getByRole('button', { name: /add afternoon/i })).toBeInTheDocument()
      expect(within(mondayCell).getByRole('button', { name: /add evening/i })).toBeInTheDocument()
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

      // Remove the morning entry
      const removeBtn = within(entries[0]).getByRole('button', { name: /remove/i })
      await user.click(removeBtn)

      await waitFor(() => {
        expect(removeAssignment).toHaveBeenCalledWith({
          id: schedule[0].id,
        })
      })
    })

    it('assigns template with correct time_slot and duration when using add button', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: true,
        data: {
          id: 10,
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 2,
          week_type: 'normal',
          period: 'afternoon',
          time_slot: '13:00',
          duration: 90,
          created_at: new Date(),
        },
      })

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
      const addBtn = within(mondayCell).getByRole('button', { name: /add afternoon/i })
      await user.click(addBtn)

      const templateOption = screen.getByText(/pull a/i)
      await user.click(templateOption)

      await waitFor(() => {
        expect(assignTemplate).toHaveBeenCalledWith({
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 2,
          week_type: 'normal',
          time_slot: '13:00',
          duration: 90,
        })
      })
    })

    it('no add buttons when all 3 periods assigned', () => {
      const schedule = buildSchedule([
        { day_of_week: 0, template_id: 1, template_name: 'Push A', period: 'morning', time_slot: '07:00' },
        { day_of_week: 0, template_id: 2, template_name: 'Pull A', period: 'afternoon', time_slot: '13:00' },
        { day_of_week: 0, template_id: 3, template_name: 'Legs A', period: 'evening', time_slot: '18:00' },
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
      expect(within(mondayCell).queryByRole('button', { name: /add morning/i })).not.toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button', { name: /add afternoon/i })).not.toBeInTheDocument()
      expect(within(mondayCell).queryByRole('button', { name: /add evening/i })).not.toBeInTheDocument()
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
          period: 'evening',
          time_slot: '18:00',
          duration: 90,
          created_at: new Date(),
        },
      })

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
      const addBtn = within(mondayCell).getByRole('button', { name: /add evening/i })
      await user.click(addBtn)

      const templateOption = screen.getByText(/pull a/i)
      await user.click(templateOption)

      await waitFor(() => {
        expect(within(mondayCell).getByText('Push A')).toBeInTheDocument()
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

    it('mixed template appears in picker alongside other modalities', async () => {
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
      const addBtn = within(mondayCell).getByRole('button', { name: /add morning/i })
      await user.click(addBtn)

      expect(screen.getByText('Strength + Cardio')).toBeInTheDocument()
    })

    it('assigns mixed template via picker', async () => {
      const user = userEvent.setup()
      vi.mocked(assignTemplate).mockResolvedValue({
        success: true,
        data: {
          id: 10,
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 4,
          week_type: 'normal',
          period: 'morning',
          time_slot: '07:00',
          duration: 90,
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
      const addBtn = within(mondayCell).getByRole('button', { name: /add morning/i })
      await user.click(addBtn)

      const templateOption = screen.getByText('Strength + Cardio')
      await user.click(templateOption)

      await waitFor(() => {
        expect(assignTemplate).toHaveBeenCalledWith({
          mesocycle_id: 1,
          day_of_week: 0,
          template_id: 4,
          week_type: 'normal',
          time_slot: '07:00',
          duration: 90,
        })
      })
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
  })
})
