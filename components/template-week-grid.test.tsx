// @vitest-environment jsdom
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/progression/template-week-actions', () => ({
  upsertTemplateWeekOverrideAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteTemplateWeekOverrideAction: vi.fn().mockResolvedValue({ success: true }),
  getTemplateWeekOverridesAction: vi.fn().mockResolvedValue([]),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { TemplateWeekGrid } from './template-week-grid'
import { getTemplateWeekOverridesAction } from '@/lib/progression/template-week-actions'

type Props = Parameters<typeof TemplateWeekGrid>[0]

const runningProps: Props = {
  templateId: 1,
  sectionId: null,
  workWeeks: 4,
  hasDeload: false,
  isCompleted: false,
  open: true,
  onOpenChange: vi.fn(),
  title: '5K Easy',
  modality: 'running',
  runningBase: { distance: 5, duration: 30, pace: '6:00', run_type: null, interval_count: null, interval_rest: null },
}

const mmaProps: Props = {
  templateId: 2,
  sectionId: null,
  workWeeks: 4,
  hasDeload: false,
  isCompleted: false,
  open: true,
  onOpenChange: vi.fn(),
  title: 'Boxing',
  modality: 'mma',
  mmaBase: { planned_duration: 60 },
}

describe('TemplateWeekGrid — activeWeeks filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getTemplateWeekOverridesAction).mockResolvedValue([])
  })

  afterEach(cleanup)

  it('shows all weeks when activeWeeks is not provided (backward compat)', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={4} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-4')).toBeInTheDocument()
    })
  })

  it('shows only specified weeks when activeWeeks is provided (running)', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={6} activeWeeks={[1, 3, 5]} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('week-row-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-4')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-6')).not.toBeInTheDocument()
  })

  it('shows only specified weeks when activeWeeks is provided (mma)', async () => {
    render(<TemplateWeekGrid {...mmaProps} workWeeks={8} activeWeeks={[2, 6]} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-6')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('week-row-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-3')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-4')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-5')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-7')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-8')).not.toBeInTheDocument()
  })

  it('preserves actual week numbers (not renumbered)', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={12} activeWeeks={[2, 6, 10]} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-2')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-6')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-10')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 2')).toBeInTheDocument()
    expect(screen.getByText('Week 6')).toBeInTheDocument()
    expect(screen.getByText('Week 10')).toBeInTheDocument()
    expect(screen.queryByTestId('week-row-1')).not.toBeInTheDocument()
  })

  it('shows deload row independent of activeWeeks when hasDeload is true', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={8} activeWeeks={[1, 5]} hasDeload={true} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-deload')).toBeInTheDocument()
    })
  })

  it('hides deload row when hasDeload is false with activeWeeks', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={8} activeWeeks={[1, 5]} hasDeload={false} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-5')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('week-row-deload')).not.toBeInTheDocument()
  })

  it('shows no week rows when activeWeeks is empty', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={4} activeWeeks={[]} />)
    expect(screen.queryByTestId('week-row-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-3')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-4')).not.toBeInTheDocument()
  })

  it('filters out activeWeeks beyond workWeeks range', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={4} activeWeeks={[1, 3, 7, 10]} />)
    await waitFor(() => {
      expect(screen.getByTestId('week-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('week-row-3')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('week-row-7')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-row-10')).not.toBeInTheDocument()
  })

  it('pre-fills active weeks with base values (running)', async () => {
    render(<TemplateWeekGrid {...runningProps} workWeeks={6} activeWeeks={[3]} />)
    await waitFor(() => {
      const row = screen.getByTestId('week-row-3')
      expect(within(row).getByDisplayValue('5')).toBeInTheDocument()
      expect(within(row).getByDisplayValue('30')).toBeInTheDocument()
      expect(within(row).getByDisplayValue('6:00')).toBeInTheDocument()
    })
  })
})
