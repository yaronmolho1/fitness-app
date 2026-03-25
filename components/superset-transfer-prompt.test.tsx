// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { SupersetTransferPrompt } from './superset-transfer-prompt'

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  slotId: 1,
  groupSlotIds: [1, 2, 3],
  mode: 'copy' as const,
  onChoice: vi.fn(),
}

describe('SupersetTransferPrompt', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // AC10: prompt asks "this exercise only" vs "entire superset group"
  it('shows both transfer options when open', () => {
    render(<SupersetTransferPrompt {...baseProps} />)

    expect(screen.getByRole('button', { name: /this exercise only/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entire superset/i })).toBeInTheDocument()
  })

  it('displays group size info in description', () => {
    render(<SupersetTransferPrompt {...baseProps} />)

    expect(screen.getByText(/part of a superset with 3 exercises/i)).toBeInTheDocument()
  })

  it('shows copy mode in title', () => {
    render(<SupersetTransferPrompt {...baseProps} mode="copy" />)
    expect(screen.getByText(/copy/i)).toBeInTheDocument()
  })

  it('shows move mode in title', () => {
    render(<SupersetTransferPrompt {...baseProps} mode="move" />)
    expect(screen.getByText(/move/i)).toBeInTheDocument()
  })

  // AC12: "this exercise only" → callback with just the selected slot
  it('calls onChoice with single slot id when "this exercise only" selected', async () => {
    const user = userEvent.setup()
    render(<SupersetTransferPrompt {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /this exercise only/i }))

    expect(baseProps.onChoice).toHaveBeenCalledWith([1])
  })

  // AC11: "entire superset" → callback with all group slot ids
  it('calls onChoice with all group slot ids when "entire superset" selected', async () => {
    const user = userEvent.setup()
    render(<SupersetTransferPrompt {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /entire superset/i }))

    expect(baseProps.onChoice).toHaveBeenCalledWith([1, 2, 3])
  })

  it('does not render when open is false', () => {
    render(<SupersetTransferPrompt {...baseProps} open={false} />)
    expect(screen.queryByRole('button', { name: /this exercise only/i })).not.toBeInTheDocument()
  })

  it('calls onOpenChange(false) after choosing', async () => {
    const user = userEvent.setup()
    render(<SupersetTransferPrompt {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /this exercise only/i }))

    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false)
  })
})
