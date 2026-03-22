// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteMesocycleButton } from './delete-mesocycle-button'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockDeleteMesocycle = vi.fn()
vi.mock('@/lib/mesocycles/delete-actions', () => ({
  deleteMesocycle: (...args: unknown[]) => mockDeleteMesocycle(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const defaultSummary = { templates: 3, schedules: 5, routineItems: 2 }

// Click the trigger to open dialog, return the dialog element
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  // Before dialog opens there's only one delete button (the trigger)
  const triggers = screen.getAllByRole('button', { name: /delete/i })
  await user.click(triggers[0])
  return screen.getByRole('alertdialog')
}

describe('DeleteMesocycleButton', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a disabled delete button for active mesocycles', () => {
    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="Active Meso"
        status="active"
        cascadeSummary={defaultSummary}
      />
    )

    const btn = screen.getByRole('button', { name: /delete/i })
    expect(btn).toBeDisabled()
    expect(screen.getByText(/complete first/i)).toBeInTheDocument()
  })

  it('renders an enabled delete button for planned mesocycles', () => {
    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="Planned Meso"
        status="planned"
        cascadeSummary={defaultSummary}
      />
    )

    const btn = screen.getByRole('button', { name: /delete/i })
    expect(btn).not.toBeDisabled()
  })

  it('renders an enabled delete button for completed mesocycles', () => {
    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="Done Meso"
        status="completed"
        cascadeSummary={defaultSummary}
      />
    )

    const btn = screen.getByRole('button', { name: /delete/i })
    expect(btn).not.toBeDisabled()
  })

  it('shows confirmation dialog with cascade counts on click', async () => {
    const user = userEvent.setup()
    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="Test Meso"
        status="planned"
        cascadeSummary={{ templates: 2, schedules: 4, routineItems: 1 }}
      />
    )

    const dialog = await openDialog(user)

    expect(within(dialog).getByText(/delete.+test meso/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/2 templates/)).toBeInTheDocument()
    expect(within(dialog).getByText(/4 schedule entr/)).toBeInTheDocument()
    expect(within(dialog).getByText(/1 routine item/)).toBeInTheDocument()
  })

  it('hides routine items line when count is zero', async () => {
    const user = userEvent.setup()
    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="No Routines"
        status="planned"
        cascadeSummary={{ templates: 1, schedules: 0, routineItems: 0 }}
      />
    )

    const dialog = await openDialog(user)

    expect(within(dialog).queryByText(/routine item/)).not.toBeInTheDocument()
  })

  it('calls deleteMesocycle and redirects on success', async () => {
    const user = userEvent.setup()
    mockDeleteMesocycle.mockResolvedValue({ success: true })

    render(
      <DeleteMesocycleButton
        mesocycleId={42}
        mesocycleName="Bye Meso"
        status="planned"
        cascadeSummary={defaultSummary}
      />
    )

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(mockDeleteMesocycle).toHaveBeenCalledWith(42)
      expect(mockPush).toHaveBeenCalledWith('/mesocycles')
    })
  })

  it('shows error in dialog on failure', async () => {
    const user = userEvent.setup()
    mockDeleteMesocycle.mockResolvedValue({ success: false, error: 'DB exploded' })

    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="Fail Meso"
        status="planned"
        cascadeSummary={defaultSummary}
      />
    )

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.getByText('DB exploded')).toBeInTheDocument()
    })

    // Dialog still open, no redirect
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('closes dialog on cancel with no side effects', async () => {
    const user = userEvent.setup()
    render(
      <DeleteMesocycleButton
        mesocycleId={1}
        mesocycleName="Cancel Test"
        status="planned"
        cascadeSummary={defaultSummary}
      />
    )

    const dialog = await openDialog(user)
    expect(within(dialog).getByText(/delete.+cancel test/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    expect(mockDeleteMesocycle).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
