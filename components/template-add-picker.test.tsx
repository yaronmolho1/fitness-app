// @vitest-environment jsdom
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock useIsMobile hook
const mockUseIsMobile = vi.fn(() => false)
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}))

import { TemplateAddPicker } from './template-add-picker'

const defaultProps = {
  onSelect: vi.fn(),
}

describe('TemplateAddPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseIsMobile.mockReturnValue(false)
  })

  afterEach(cleanup)

  it('renders "Add Template" button', () => {
    render(<TemplateAddPicker {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add template/i })).toBeInTheDocument()
  })

  it('does not render 4 separate type buttons', () => {
    render(<TemplateAddPicker {...defaultProps} />)
    expect(screen.queryByRole('button', { name: '+ Resistance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Running' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ MMA/BJJ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Mixed Workout' })).not.toBeInTheDocument()
  })

  it('shows all 5 options when picker opens (desktop popover)', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))

    expect(screen.getByText('Resistance')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('MMA/BJJ')).toBeInTheDocument()
    expect(screen.getByText('Mixed Workout')).toBeInTheDocument()
    expect(screen.getByText('From Existing')).toBeInTheDocument()
  })

  it('calls onSelect with "resistance" when Resistance clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith('resistance')
  })

  it('calls onSelect with "running" when Running clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Running'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith('running')
  })

  it('calls onSelect with "mma" when MMA/BJJ clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('MMA/BJJ'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith('mma')
  })

  it('calls onSelect with "mixed" when Mixed Workout clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Mixed Workout'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith('mixed')
  })

  it('calls onSelect with "from-existing" when From Existing clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('From Existing'))

    expect(defaultProps.onSelect).toHaveBeenCalledWith('from-existing')
  })

  it('renders bottom sheet on mobile', async () => {
    mockUseIsMobile.mockReturnValue(true)
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))

    // Sheet renders with role="dialog" (radix dialog primitive)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Sheet title renders inside the dialog
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Add Template')).toBeInTheDocument()
  })

  it('picker options have minimum 44px touch target on mobile', async () => {
    mockUseIsMobile.mockReturnValue(true)
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))

    // Each option should have min-h-[44px] class for touch targets
    const options = screen.getAllByRole('button').filter(
      btn => ['Resistance', 'Running', 'MMA/BJJ', 'Mixed Workout', 'From Existing'].includes(btn.textContent ?? '')
    )
    expect(options.length).toBe(5)
    options.forEach(option => {
      expect(option.className).toMatch(/min-h-\[44px\]/)
    })
  })

  it('closes picker after selection', async () => {
    const user = userEvent.setup()
    render(<TemplateAddPicker {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add template/i }))
    await user.click(screen.getByText('Resistance'))

    // After selection, options should not be visible
    expect(screen.queryByText('Running')).not.toBeInTheDocument()
    expect(screen.queryByText('From Existing')).not.toBeInTheDocument()
  })
})
