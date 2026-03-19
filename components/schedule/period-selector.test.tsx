// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PeriodSelector, derivePeriodFromTime } from './period-selector'
import type { Period } from './period-selector'

afterEach(cleanup)

describe('derivePeriodFromTime', () => {
  it('maps times before 12:00 to morning', () => {
    expect(derivePeriodFromTime('00:00')).toBe('morning')
    expect(derivePeriodFromTime('06:30')).toBe('morning')
    expect(derivePeriodFromTime('11:59')).toBe('morning')
  })

  it('maps 12:00-16:59 to afternoon', () => {
    expect(derivePeriodFromTime('12:00')).toBe('afternoon')
    expect(derivePeriodFromTime('14:30')).toBe('afternoon')
    expect(derivePeriodFromTime('16:59')).toBe('afternoon')
  })

  it('maps 17:00+ to evening', () => {
    expect(derivePeriodFromTime('17:00')).toBe('evening')
    expect(derivePeriodFromTime('20:00')).toBe('evening')
    expect(derivePeriodFromTime('23:59')).toBe('evening')
  })

  it('returns null for invalid input', () => {
    expect(derivePeriodFromTime('')).toBeNull()
    expect(derivePeriodFromTime('invalid')).toBeNull()
  })
})

describe('PeriodSelector', () => {
  const defaultProps = {
    period: 'morning' as Period,
    onPeriodChange: vi.fn(),
  }

  it('renders 3 period pills', () => {
    render(<PeriodSelector {...defaultProps} />)

    expect(screen.getByRole('button', { name: /morning/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /afternoon/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /evening/i })).toBeDefined()
  })

  it('marks the active period with aria-pressed', () => {
    render(<PeriodSelector {...defaultProps} period="afternoon" />)

    expect(screen.getByRole('button', { name: /morning/i }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /afternoon/i }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /evening/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onPeriodChange when a different pill is clicked', async () => {
    const onPeriodChange = vi.fn()
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} onPeriodChange={onPeriodChange} />)

    await user.click(screen.getByRole('button', { name: /evening/i }))
    expect(onPeriodChange).toHaveBeenCalledWith('evening')
  })

  it('does not call onPeriodChange when active pill is clicked', async () => {
    const onPeriodChange = vi.fn()
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} period="morning" onPeriodChange={onPeriodChange} />)

    await user.click(screen.getByRole('button', { name: /morning/i }))
    expect(onPeriodChange).not.toHaveBeenCalled()
  })

  it('has 44px minimum touch targets on pills', () => {
    render(<PeriodSelector {...defaultProps} />)

    const pill = screen.getByRole('button', { name: /morning/i })
    expect(pill.className).toMatch(/min-h-\[44px\]/)
    expect(pill.className).toMatch(/min-w-\[44px\]/)
  })

  it('does not show time picker by default', () => {
    render(<PeriodSelector {...defaultProps} />)

    expect(screen.queryByLabelText('Time')).toBeNull()
  })

  it('shows time picker when "Set time" is clicked', async () => {
    const user = userEvent.setup()
    render(<PeriodSelector {...defaultProps} onTimeSlotChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /set time/i }))
    expect(screen.getByLabelText('Time')).toBeDefined()
  })

  it('auto-derives period when time is entered', async () => {
    const onPeriodChange = vi.fn()
    const onTimeSlotChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PeriodSelector
        {...defaultProps}
        period="morning"
        onPeriodChange={onPeriodChange}
        onTimeSlotChange={onTimeSlotChange}
      />
    )

    // Open time picker
    await user.click(screen.getByRole('button', { name: /set time/i }))
    const input = screen.getByLabelText('Time') as HTMLInputElement

    // Use fireEvent for time inputs (userEvent.type doesn't work well with type="time")
    fireEvent.change(input, { target: { value: '17:30' } })

    expect(onPeriodChange).toHaveBeenCalledWith('evening')
    expect(onTimeSlotChange).toHaveBeenCalledWith('17:30')
  })

  it('allows manual period override after time auto-derivation', async () => {
    const onPeriodChange = vi.fn()
    const onTimeSlotChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PeriodSelector
        period="evening"
        onPeriodChange={onPeriodChange}
        timeSlot="17:30"
        onTimeSlotChange={onTimeSlotChange}
      />
    )

    // Click morning pill to manually override
    await user.click(screen.getByRole('button', { name: /morning/i }))
    expect(onPeriodChange).toHaveBeenCalledWith('morning')
  })

  it('hides time picker and clears time when toggle is clicked again', async () => {
    const onTimeSlotChange = vi.fn()
    const user = userEvent.setup()

    render(
      <PeriodSelector
        {...defaultProps}
        timeSlot="14:00"
        onTimeSlotChange={onTimeSlotChange}
      />
    )

    // Time picker should be visible since timeSlot is set
    expect(screen.getByLabelText('Time')).toBeDefined()

    // Click "Clear time" to hide
    await user.click(screen.getByRole('button', { name: /clear time/i }))
    expect(onTimeSlotChange).toHaveBeenCalledWith(undefined)
    expect(screen.queryByLabelText('Time')).toBeNull()
  })

  it('uses role="group" with accessible label', () => {
    render(<PeriodSelector {...defaultProps} />)

    expect(screen.getByRole('group', { name: /period/i })).toBeDefined()
  })
})
