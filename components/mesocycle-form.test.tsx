// @vitest-environment jsdom
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/mesocycles/actions', () => ({
  createMesocycle: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

import { MesocycleForm } from './mesocycle-form'
import { createMesocycle } from '@/lib/mesocycles/actions'

// Helper: set input value via fireEvent (reliable for date/number inputs in jsdom)
function setInputValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

describe('MesocycleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all form fields', () => {
    render(<MesocycleForm />)

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/work weeks/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/deload/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('displays end date preview', () => {
    render(<MesocycleForm />)
    expect(screen.getByText(/end date/i)).toBeInTheDocument()
  })

  it('end date is read-only (no input for end date)', () => {
    render(<MesocycleForm />)
    const inputs = screen.getAllByRole('textbox')
    const allInputIds = inputs.map((el) => el.getAttribute('id') || '')
    expect(allInputIds).not.toContain('end_date')
  })

  it('computes end date for 4 weeks without deload', () => {
    render(<MesocycleForm />)

    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')

    expect(screen.getByText('2026-03-28')).toBeInTheDocument()
  })

  it('computes end date for 4 weeks with deload', () => {
    render(<MesocycleForm />)

    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    fireEvent.click(screen.getByLabelText(/deload/i))

    expect(screen.getByText('2026-04-04')).toBeInTheDocument()
  })

  it('updates end date live when work_weeks changes', () => {
    render(<MesocycleForm />)

    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '2')

    expect(screen.getByText('2026-03-14')).toBeInTheDocument()

    setInputValue(screen.getByLabelText(/work weeks/i), '6')

    expect(screen.getByText('2026-04-11')).toBeInTheDocument()
  })

  it('updates end date live when start_date changes', () => {
    render(<MesocycleForm />)

    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    setInputValue(screen.getByLabelText(/start date/i), '2026-06-01')

    expect(screen.getByText('2026-06-28')).toBeInTheDocument()
  })

  it('shows no end date when inputs are incomplete', () => {
    render(<MesocycleForm />)
    expect(screen.queryByText(/^\d{4}-\d{2}-\d{2}$/)).not.toBeInTheDocument()
  })

  it('shows validation error when name is empty on submit', async () => {
    const user = userEvent.setup()
    render(<MesocycleForm />)

    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(createMesocycle).not.toHaveBeenCalled()
  })

  it('shows validation error when start_date is empty on submit', async () => {
    const user = userEvent.setup()
    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'Test Meso')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/start date is required/i)).toBeInTheDocument()
    expect(createMesocycle).not.toHaveBeenCalled()
  })

  it('shows validation error when work_weeks is empty', async () => {
    const user = userEvent.setup()
    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'Test Meso')
    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    // Leave work_weeks empty
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/work weeks must be at least 1/i)).toBeInTheDocument()
    expect(createMesocycle).not.toHaveBeenCalled()
  })

  it('shows validation error when work_weeks is 0', async () => {
    const user = userEvent.setup()
    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'Test Meso')
    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '0')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText(/work weeks must be at least 1/i)).toBeInTheDocument()
    expect(createMesocycle).not.toHaveBeenCalled()
  })

  it('calls createMesocycle with FormData on valid submit', async () => {
    const user = userEvent.setup()
    vi.mocked(createMesocycle).mockResolvedValue({ success: true, id: 1 })

    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'Hypertrophy Block')
    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(createMesocycle).toHaveBeenCalledTimes(1)
    })

    const fd = vi.mocked(createMesocycle).mock.calls[0][0] as FormData
    expect(fd.get('name')).toBe('Hypertrophy Block')
    expect(fd.get('start_date')).toBe('2026-03-01')
    expect(fd.get('work_weeks')).toBe('4')
    expect(fd.get('has_deload')).toBe('false')
  })

  it('sends has_deload=true when deload is checked', async () => {
    const user = userEvent.setup()
    vi.mocked(createMesocycle).mockResolvedValue({ success: true, id: 1 })

    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'Deload Meso')
    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    fireEvent.click(screen.getByLabelText(/deload/i))
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(createMesocycle).toHaveBeenCalledTimes(1)
    })

    const fd = vi.mocked(createMesocycle).mock.calls[0][0] as FormData
    expect(fd.get('has_deload')).toBe('true')
  })

  it('displays server validation errors', async () => {
    const user = userEvent.setup()
    vi.mocked(createMesocycle).mockResolvedValue({
      success: false,
      errors: { name: 'Name is required' },
    })

    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'x')
    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    await user.click(screen.getByRole('button', { name: /create/i }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
  })

  it('navigates on successful creation', async () => {
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

    vi.mocked(createMesocycle).mockResolvedValue({ success: true, id: 42 })
    const user = userEvent.setup()

    render(<MesocycleForm />)

    await user.type(screen.getByLabelText(/name/i), 'Test')
    setInputValue(screen.getByLabelText(/start date/i), '2026-03-01')
    setInputValue(screen.getByLabelText(/work weeks/i), '4')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/mesocycles/42')
    })
  })
})
