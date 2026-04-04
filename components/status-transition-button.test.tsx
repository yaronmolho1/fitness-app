// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/mesocycles/actions', () => ({
  activateMesocycle: vi.fn(),
  completeMesocycle: vi.fn(),
  planMesocycle: vi.fn(),
}))

import { activateMesocycle, completeMesocycle } from '@/lib/mesocycles/actions'
import { StatusTransitionButton } from './status-transition-button'

describe('StatusTransitionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders "Activate" for planned status', () => {
    render(<StatusTransitionButton mesocycleId={1} status="planned" />)
    expect(screen.getByText('Activate')).toBeDefined()
  })

  it('renders "Complete" for active status', () => {
    render(<StatusTransitionButton mesocycleId={1} status="active" />)
    expect(screen.getByText('Complete')).toBeDefined()
  })

  it('renders nothing for completed status', () => {
    const { container } = render(<StatusTransitionButton mesocycleId={1} status="completed" />)
    expect(container.innerHTML).toBe('')
  })

  it('calls activateMesocycle on click', async () => {
    const user = userEvent.setup()
    vi.mocked(activateMesocycle).mockResolvedValue({ success: true })

    render(<StatusTransitionButton mesocycleId={5} status="planned" />)
    await user.click(screen.getByText('Activate'))

    expect(activateMesocycle).toHaveBeenCalledWith(5)
  })

  it('shows error when activation fails', async () => {
    const user = userEvent.setup()
    vi.mocked(activateMesocycle).mockResolvedValue({
      success: false,
      error: 'Another mesocycle is already active',
    })

    render(<StatusTransitionButton mesocycleId={5} status="planned" />)
    await user.click(screen.getByText('Activate'))

    expect(await screen.findByText('Another mesocycle is already active')).toBeDefined()
  })

  it('asks confirmation before completing', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<StatusTransitionButton mesocycleId={3} status="active" />)
    await user.click(screen.getByText('Complete'))

    expect(confirmSpy).toHaveBeenCalled()
    expect(completeMesocycle).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('calls completeMesocycle when confirmed', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(completeMesocycle).mockResolvedValue({ success: true })

    render(<StatusTransitionButton mesocycleId={3} status="active" />)
    await user.click(screen.getByText('Complete'))

    expect(completeMesocycle).toHaveBeenCalledWith(3)

    confirmSpy.mockRestore()
  })
})
