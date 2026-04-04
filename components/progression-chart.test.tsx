// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'

// Radix primitives use pointer capture APIs missing from jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', async () => {
  const React = await import('react')
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) =>
      React.createElement('div', { 'data-testid': 'line-chart', 'data-points': data?.length ?? 0 }, children),
    Line: ({ dataKey, name, stroke }: { dataKey: string; name: string; stroke?: string }) =>
      React.createElement('div', { 'data-testid': `line-${dataKey}`, 'data-name': name, 'data-stroke': stroke }),
    XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
    ReferenceLine: ({ x, label, strokeDasharray }: { x: string; label?: { value: string }; strokeDasharray?: string }) =>
      React.createElement('div', {
        'data-testid': `reference-line-${x}`,
        'data-label': label?.value ?? '',
        'data-dash': strokeDasharray ?? '',
      }),
    Dot: () => null,
  }
})

const exercises = [
  { id: 1, name: 'Bench Press', modality: 'resistance', muscle_group: 'Chest', equipment: 'Barbell', created_at: new Date() },
  { id: 2, name: 'Squat', modality: 'resistance', muscle_group: 'Legs', equipment: 'Barbell', created_at: new Date() },
]

const progressionData = {
  data: [
    { date: '2025-01-15', mesocycleId: 1, mesocycleName: 'Hypertrophy A', plannedWeight: 80, actualWeight: 82.5, plannedVolume: 4800, actualVolume: 4950 },
    { date: '2025-01-22', mesocycleId: 1, mesocycleName: 'Hypertrophy A', plannedWeight: 82.5, actualWeight: 82.5, plannedVolume: 4950, actualVolume: 4950 },
    { date: '2025-02-05', mesocycleId: 2, mesocycleName: 'Strength B', plannedWeight: 90, actualWeight: 87.5, plannedVolume: 5400, actualVolume: 5250 },
  ],
  phases: [
    { mesocycleId: 1, mesocycleName: 'Hypertrophy A', startDate: '2025-01-01', endDate: '2025-02-01' },
    { mesocycleId: 2, mesocycleName: 'Strength B', startDate: '2025-02-01', endDate: '2025-03-01' },
  ],
}

import { ProgressionChart } from './progression-chart'

describe('ProgressionChart', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(progressionData)))
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders exercise selector with all exercises', () => {
    render(<ProgressionChart exercises={exercises} />)

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText(/select exercise/i)).toBeInTheDocument()
  })

  it('shows empty state when no exercise is selected', () => {
    render(<ProgressionChart exercises={exercises} />)

    expect(screen.getByText(/select an exercise/i)).toBeInTheDocument()
  })

  it('shows empty state when exercise has no logged data', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ data: [] })))
    )

    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      expect(screen.getByText(/no progression data/i)).toBeInTheDocument()
    })
  })

  it('fetches and renders chart after selecting exercise', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/progression?exercise_id=1')
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })
  })

  it('renders planned and actual data series for weight view', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      expect(screen.getByTestId('line-plannedWeight')).toBeInTheDocument()
      expect(screen.getByTestId('line-actualWeight')).toBeInTheDocument()
    })

    // Verify series names
    expect(screen.getByTestId('line-plannedWeight')).toHaveAttribute('data-name', 'Planned')
    expect(screen.getByTestId('line-actualWeight')).toHaveAttribute('data-name', 'Actual')
  })

  it('toggles between weight and volume view', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      expect(screen.getByTestId('line-plannedWeight')).toBeInTheDocument()
    })

    // Switch to volume view
    const volumeTab = screen.getByRole('tab', { name: /volume/i })
    await user.click(volumeTab)

    await waitFor(() => {
      expect(screen.getByTestId('line-plannedVolume')).toBeInTheDocument()
      expect(screen.getByTestId('line-actualVolume')).toBeInTheDocument()
    })
  })

  it('renders weight tab as default active view', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const weightTab = screen.getByRole('tab', { name: /weight/i })
    expect(weightTab).toHaveAttribute('data-state', 'active')
  })

  it('chart receives correct number of data points', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      const chart = screen.getByTestId('line-chart')
      expect(chart).toHaveAttribute('data-points', '3')
    })
  })

  it('passes exercise_id in API call', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('exercise_id=1')
      )
    })
  })

  it('renders phase boundary reference lines for start and end dates', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      // Start lines for each phase
      expect(screen.getByTestId('reference-line-2025-01-01')).toBeInTheDocument()
      expect(screen.getByTestId('reference-line-2025-02-01')).toBeInTheDocument()
      // End lines
      expect(screen.getByTestId('reference-line-2025-03-01')).toBeInTheDocument()
    })

    // Start lines have solid style (no dash)
    const startLine = screen.getByTestId('reference-line-2025-01-01')
    expect(startLine).toHaveAttribute('data-dash', '')

    // End lines have dashed style
    const endLine = screen.getByTestId('reference-line-2025-03-01')
    expect(endLine).toHaveAttribute('data-dash', '4 4')
  })

  it('phase boundary lines have mesocycle name labels', async () => {
    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    await waitFor(() => {
      const startLine = screen.getByTestId('reference-line-2025-01-01')
      expect(startLine).toHaveAttribute('data-label', 'Hypertrophy A')
    })
  })

  it('shows loading state while fetching data', async () => {
    // Delay the fetch response
    global.fetch = vi.fn((): Promise<Response> =>
      new Promise((resolve) =>
        setTimeout(() => resolve(new Response(JSON.stringify(progressionData))), 100)
      )
    )

    render(<ProgressionChart exercises={exercises} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Bench Press' })
    await user.click(option)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
