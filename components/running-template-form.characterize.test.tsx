// Characterization test — captures current behavior for safe refactoring
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/templates/actions', () => ({
  createRunningTemplate: vi.fn(),
}))

import { RunningTemplateForm } from './running-template-form'
import { createRunningTemplate } from '@/lib/templates/actions'

const mockedCreate = vi.mocked(createRunningTemplate)

const mockSuccessResult = {
  success: true as const,
  data: {
    id: 1, mesocycle_id: 5, name: 'Tuesday Tempo', canonical_name: 'tuesday-tempo',
    modality: 'running' as const, notes: null, run_type: 'tempo' as const,
    target_pace: null, hr_zone: null, interval_count: null, interval_rest: null,
    coaching_cues: null, target_distance: null, target_duration: null,
    target_elevation_gain: null, planned_duration: null, estimated_duration: null, display_order: 0, created_at: null,
  },
}

describe('RunningTemplateForm — characterization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('renders all standard fields', () => {
    render(<RunningTemplateForm mesocycleId={1} />)

    expect(screen.getByLabelText('Template Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Run Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Target Pace')).toBeInTheDocument()
    expect(screen.getByLabelText('HR Zone')).toBeInTheDocument()
    expect(screen.getByLabelText('Coaching Cues')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Running Template' })).toBeInTheDocument()
  })

  it('renders run type options', () => {
    render(<RunningTemplateForm mesocycleId={1} />)
    const select = screen.getByLabelText('Run Type')
    expect(select).toHaveValue('')
    const options = select.querySelectorAll('option')
    expect(options).toHaveLength(6) // placeholder + 5 types
    expect(options[1]).toHaveTextContent('Easy')
    expect(options[2]).toHaveTextContent('Tempo')
    expect(options[3]).toHaveTextContent('Interval')
    expect(options[4]).toHaveTextContent('Long Run')
    expect(options[5]).toHaveTextContent('Race')
  })

  it('renders HR zone options', () => {
    render(<RunningTemplateForm mesocycleId={1} />)
    const select = screen.getByLabelText('HR Zone')
    const options = select.querySelectorAll('option')
    // placeholder "—" + zones 1-5
    expect(options).toHaveLength(6)
    expect(options[1]).toHaveTextContent('Zone 1')
    expect(options[5]).toHaveTextContent('Zone 5')
  })

  it('interval fields present in DOM even when run type is not interval', () => {
    render(<RunningTemplateForm mesocycleId={1} />)
    // CSS animated show/hide — fields always in DOM
    expect(screen.getByLabelText('Intervals')).toBeInTheDocument()
    expect(screen.getByLabelText('Rest (seconds)')).toBeInTheDocument()
  })

  it('shows interval fields when run type is interval', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    await user.selectOptions(screen.getByLabelText('Run Type'), 'interval')

    expect(screen.getByLabelText('Intervals')).toHaveAttribute('tabindex', '0')
    expect(screen.getByLabelText('Rest (seconds)')).toHaveAttribute('tabindex', '0')
  })

  it('shows error when submitting empty form', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    const buttons = screen.getAllByRole('button', { name: 'Create Running Template' })
    await user.click(buttons[0])

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('shows run type error when name filled but no run type', async () => {
    const user = userEvent.setup()
    render(<RunningTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Test Run')
    const buttons = screen.getAllByRole('button', { name: 'Create Running Template' })
    await user.click(buttons[0])

    expect(screen.getByRole('alert')).toHaveTextContent('Run type is required')
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('calls createRunningTemplate on valid submit', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    mockedCreate.mockResolvedValueOnce(mockSuccessResult)

    render(<RunningTemplateForm mesocycleId={5} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Template Name'), 'Tuesday Tempo')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'tempo')
    const buttons = screen.getAllByRole('button', { name: 'Create Running Template' })
    await user.click(buttons[0])

    expect(mockedCreate).toHaveBeenCalledWith({
      name: 'Tuesday Tempo',
      mesocycle_id: 5,
      run_type: 'tempo',
      target_pace: undefined,
      hr_zone: null,
      interval_count: null,
      interval_rest: null,
      coaching_cues: undefined,
      target_distance: null,
      target_duration: null,
      target_elevation_gain: null,
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows server error on failed submit', async () => {
    const user = userEvent.setup()
    mockedCreate.mockResolvedValueOnce({ success: false, error: 'Duplicate name' })

    render(<RunningTemplateForm mesocycleId={1} />)

    await user.type(screen.getByLabelText('Template Name'), 'Test')
    await user.selectOptions(screen.getByLabelText('Run Type'), 'easy')
    const buttons = screen.getAllByRole('button', { name: 'Create Running Template' })
    await user.click(buttons[0])

    expect(screen.getByRole('alert')).toHaveTextContent('Duplicate name')
  })

  it('does not render error alert initially', () => {
    render(<RunningTemplateForm mesocycleId={1} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
