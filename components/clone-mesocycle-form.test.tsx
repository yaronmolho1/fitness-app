// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/mesocycles/clone-actions', () => ({
  cloneMesocycle: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

import { CloneMesocycleForm } from './clone-mesocycle-form'
import { cloneMesocycle } from '@/lib/mesocycles/clone-actions'

const defaultSource = {
  id: 1,
  name: 'Hypertrophy Block',
  work_weeks: 4,
  has_deload: true,
}

// Helper: set input value via fireEvent (reliable for date inputs in jsdom)
function setInputValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

describe('CloneMesocycleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all form fields', () => {
    render(<CloneMesocycleForm source={defaultSource} />)

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/work weeks/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/deload/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clone/i })).toBeInTheDocument()
  })

  it('pre-fills work_weeks and has_deload from source', () => {
    render(<CloneMesocycleForm source={defaultSource} />)

    const workWeeksInput = screen.getByLabelText(/work weeks/i) as HTMLInputElement
    expect(workWeeksInput.value).toBe('4')

    const deloadCheckbox = screen.getByLabelText(/deload/i) as HTMLInputElement
    expect(deloadCheckbox.checked).toBe(true)
  })

  it('name field starts empty (not copied from source)', () => {
    render(<CloneMesocycleForm source={defaultSource} />)

    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('')
  })

  it('shows validation error when name is empty on submit', async () => {
    const user = userEvent.setup()
    render(<CloneMesocycleForm source={defaultSource} />)

    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    await user.click(screen.getByRole('button', { name: /clone/i }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(cloneMesocycle).not.toHaveBeenCalled()
  })

  it('shows validation error when start_date is empty on submit', async () => {
    const user = userEvent.setup()
    render(<CloneMesocycleForm source={defaultSource} />)

    await user.type(screen.getByLabelText(/name/i), 'New Block')
    await user.click(screen.getByRole('button', { name: /clone/i }))

    expect(await screen.findByText(/start date is required/i)).toBeInTheDocument()
    expect(cloneMesocycle).not.toHaveBeenCalled()
  })

  it('calls cloneMesocycle with correct input on valid submit', async () => {
    const user = userEvent.setup()
    vi.mocked(cloneMesocycle).mockResolvedValue({ success: true, id: 99 })

    render(<CloneMesocycleForm source={defaultSource} />)

    await user.type(screen.getByLabelText(/name/i), 'Cloned Block')
    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    await user.click(screen.getByRole('button', { name: /clone/i }))

    await waitFor(() => {
      expect(cloneMesocycle).toHaveBeenCalledTimes(1)
    })

    expect(cloneMesocycle).toHaveBeenCalledWith({
      source_id: 1,
      name: 'Cloned Block',
      start_date: '2026-04-01',
      work_weeks: 4,
      has_deload: true,
    })
  })

  it('sends overridden work_weeks and has_deload', async () => {
    const user = userEvent.setup()
    vi.mocked(cloneMesocycle).mockResolvedValue({ success: true, id: 100 })

    render(<CloneMesocycleForm source={defaultSource} />)

    await user.type(screen.getByLabelText(/name/i), 'Modified Clone')
    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '6')
    fireEvent.click(screen.getByLabelText(/deload/i)) // uncheck
    await user.click(screen.getByRole('button', { name: /clone/i }))

    await waitFor(() => {
      expect(cloneMesocycle).toHaveBeenCalledTimes(1)
    })

    expect(cloneMesocycle).toHaveBeenCalledWith({
      source_id: 1,
      name: 'Modified Clone',
      start_date: '2026-04-01',
      work_weeks: 6,
      has_deload: false,
    })
  })

  it('navigates to new mesocycle on success', async () => {
    const push = vi.fn()
    const { useRouter } = await import('next/navigation')
    vi.mocked(useRouter).mockReturnValue({
      push,
      refresh: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    })

    vi.mocked(cloneMesocycle).mockResolvedValue({ success: true, id: 42 })
    const user = userEvent.setup()

    render(<CloneMesocycleForm source={defaultSource} />)

    await user.type(screen.getByLabelText(/name/i), 'Clone')
    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    await user.click(screen.getByRole('button', { name: /clone/i }))

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/mesocycles/42')
    })
  })

  it('displays server error', async () => {
    const user = userEvent.setup()
    vi.mocked(cloneMesocycle).mockResolvedValue({
      success: false,
      error: 'Cannot clone a mesocycle with no templates',
    })

    render(<CloneMesocycleForm source={defaultSource} />)

    await user.type(screen.getByLabelText(/name/i), 'Clone')
    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    await user.click(screen.getByRole('button', { name: /clone/i }))

    expect(await screen.findByText(/cannot clone a mesocycle with no templates/i)).toBeInTheDocument()
  })

  it('shows end date preview', () => {
    render(<CloneMesocycleForm source={defaultSource} />)

    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')

    // 4 work weeks + 1 deload = 35 days from April 1
    expect(screen.getByText('2026-05-05')).toBeInTheDocument()
  })

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup()
    let resolveClone: (v: { success: true; id: number }) => void
    vi.mocked(cloneMesocycle).mockImplementation(
      () => new Promise((resolve) => { resolveClone = resolve })
    )

    render(<CloneMesocycleForm source={defaultSource} />)

    await user.type(screen.getByLabelText(/name/i), 'Clone')
    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    await user.click(screen.getByRole('button', { name: /clone/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cloning/i })).toBeDisabled()
    })

    resolveClone!({ success: true, id: 1 })
  })

  it('pre-fills has_deload=false from source', () => {
    render(<CloneMesocycleForm source={{ ...defaultSource, has_deload: false }} />)

    const deloadCheckbox = screen.getByLabelText(/deload/i) as HTMLInputElement
    expect(deloadCheckbox.checked).toBe(false)
  })

  it('shows validation error for invalid work_weeks', async () => {
    render(<CloneMesocycleForm source={defaultSource} />)

    setInputValue(screen.getByLabelText(/name/i), 'Clone')
    setInputValue(screen.getByLabelText(/start date/i), '2026-04-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '0')
    fireEvent.submit(screen.getByRole('button', { name: /clone/i }).closest('form')!)

    expect(await screen.findByText(/work weeks must be at least 1/i)).toBeInTheDocument()
    expect(cloneMesocycle).not.toHaveBeenCalled()
  })
})
