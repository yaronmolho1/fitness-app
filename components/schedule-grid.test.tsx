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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const mockTemplates = [
  { id: 1, name: 'Push A', canonical_name: 'push-a', modality: 'resistance' as const },
  { id: 2, name: 'Pull A', canonical_name: 'pull-a', modality: 'resistance' as const },
  { id: 3, name: 'Legs A', canonical_name: 'legs-a', modality: 'resistance' as const },
]

function buildSchedule(
  assignments: Array<{ day_of_week: number; template_id: number; template_name: string }>
) {
  return assignments.map((a) => ({
    day_of_week: a.day_of_week,
    template_id: a.template_id,
    template_name: a.template_name,
  }))
}

describe('ScheduleGrid', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
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

    // Tuesday (day 1) is a rest day — no template name shown
    const tuesdayCell = screen.getByTestId('day-cell-1')
    expect(within(tuesdayCell).getByTestId('rest-label')).toHaveTextContent('Rest')
    expect(within(tuesdayCell).queryByText('Push A')).not.toBeInTheDocument()
    expect(within(tuesdayCell).queryByText('Pull A')).not.toBeInTheDocument()
    expect(within(tuesdayCell).queryByText('Legs A')).not.toBeInTheDocument()
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

  it('calls assignTemplate when selecting a template for a day', async () => {
    const user = userEvent.setup()
    vi.mocked(assignTemplate).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        mesocycle_id: 1,
        day_of_week: 0,
        template_id: 2,
        week_type: 'normal',
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

    // Click assign button on Monday (day 0)
    const mondayCell = screen.getByTestId('day-cell-0')
    const assignBtn = within(mondayCell).getByRole('button', { name: /assign/i })
    await user.click(assignBtn)

    // Select a template from the picker
    const templateOption = screen.getByText(/pull a/i)
    await user.click(templateOption)

    await waitFor(() => {
      expect(assignTemplate).toHaveBeenCalledWith({
        mesocycle_id: 1,
        day_of_week: 0,
        template_id: 2,
        week_type: 'normal',
      })
    })
  })

  it('calls removeAssignment when removing a template', async () => {
    const user = userEvent.setup()
    vi.mocked(removeAssignment).mockResolvedValue({ success: true })

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

    const mondayCell = screen.getByTestId('day-cell-0')
    const removeBtn = within(mondayCell).getByRole('button', { name: /remove/i })
    await user.click(removeBtn)

    await waitFor(() => {
      expect(removeAssignment).toHaveBeenCalledWith({
        mesocycle_id: 1,
        day_of_week: 0,
        week_type: 'normal',
      })
    })
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

    // No assign/remove buttons when completed
    expect(screen.queryByRole('button', { name: /assign/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('shows template picker with only mesocycle templates', async () => {
    const user = userEvent.setup()
    vi.mocked(assignTemplate).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        mesocycle_id: 1,
        day_of_week: 0,
        template_id: 1,
        week_type: 'normal',
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
    const assignBtn = within(mondayCell).getByRole('button', { name: /assign/i })
    await user.click(assignBtn)

    // All 3 templates should be listed in the picker
    const picker = mondayCell.querySelector('.mt-2.rounded-md')!
    const pickerEl = within(picker as HTMLElement)
    expect(pickerEl.getByText('Push A')).toBeInTheDocument()
    expect(pickerEl.getByText('Pull A')).toBeInTheDocument()
    expect(pickerEl.getByText('Legs A')).toBeInTheDocument()
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
    const assignBtn = within(mondayCell).getByRole('button', { name: /assign/i })
    await user.click(assignBtn)

    const templateOption = screen.getByText(/push a/i)
    await user.click(templateOption)

    await waitFor(() => {
      expect(screen.getByText(/template not found/i)).toBeInTheDocument()
    })
  })
})
