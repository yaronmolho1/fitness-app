// @vitest-environment jsdom
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TargetPickerModal } from './target-picker-modal'
import type { TransferTarget } from '@/lib/templates/transfer-queries'

function makeMeso(overrides: Partial<TransferTarget> = {}): TransferTarget {
  return {
    id: 1,
    name: 'Hypertrophy Block',
    status: 'active',
    templates: [
      {
        id: 10,
        name: 'Push A',
        modality: 'resistance',
        sections: [],
      },
    ],
    ...overrides,
  }
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  targets: [] as TransferTarget[],
  isPending: false,
  mode: 'copy' as const,
}

describe('TargetPickerModal', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('renders dialog with title reflecting mode', () => {
    render(<TargetPickerModal {...defaultProps} mode="copy" targets={[makeMeso()]} />)
    expect(screen.getByText(/copy to/i)).toBeInTheDocument()
  })

  it('renders move title when mode is move', () => {
    render(<TargetPickerModal {...defaultProps} mode="move" targets={[makeMeso()]} />)
    expect(screen.getByText(/move to/i)).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(<TargetPickerModal {...defaultProps} open={false} />)
    expect(screen.queryByText(/copy to/i)).not.toBeInTheDocument()
  })

  // Step 1: mesocycle selection
  it('shows mesocycles in step 1', () => {
    const targets = [
      makeMeso({ id: 1, name: 'Block A' }),
      makeMeso({ id: 2, name: 'Block B' }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    expect(screen.getByText('Block A')).toBeInTheDocument()
    expect(screen.getByText('Block B')).toBeInTheDocument()
  })

  it('shows empty state when no targets available', () => {
    render(<TargetPickerModal {...defaultProps} targets={[]} />)
    expect(screen.getByText(/no available/i)).toBeInTheDocument()
  })

  // Step 2: selecting a meso shows its templates
  it('shows templates after selecting a mesocycle', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({
        id: 1,
        name: 'Block A',
        templates: [
          { id: 10, name: 'Push A', modality: 'resistance', sections: [] },
          { id: 11, name: 'Pull A', modality: 'resistance', sections: [] },
        ],
      }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    await user.click(screen.getByText('Block A'))

    expect(screen.getByText('Push A')).toBeInTheDocument()
    expect(screen.getByText('Pull A')).toBeInTheDocument()
  })

  // Step 2→3: selecting a pure resistance template triggers confirm directly
  it('calls onConfirm with template id when selecting pure resistance template', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({
        id: 1,
        name: 'Block A',
        templates: [
          { id: 10, name: 'Push A', modality: 'resistance', sections: [] },
        ],
      }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    await user.click(screen.getByText('Block A'))
    await user.click(screen.getByText('Push A'))

    // For resistance with no sections, confirm button should be available
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      targetTemplateId: 10,
      targetSectionId: undefined,
    })
  })

  // Step 3: mixed template with sections shows section selection
  it('shows section selection for mixed template with sections', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({
        id: 1,
        name: 'Block A',
        templates: [
          {
            id: 10,
            name: 'Mixed Day',
            modality: 'mixed',
            sections: [
              { id: 100, section_name: 'Strength', order: 1 },
              { id: 101, section_name: 'Hypertrophy', order: 2 },
            ],
          },
        ],
      }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    await user.click(screen.getByText('Block A'))
    await user.click(screen.getByText('Mixed Day'))

    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('Hypertrophy')).toBeInTheDocument()
  })

  it('calls onConfirm with section id for mixed template', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({
        id: 1,
        name: 'Block A',
        templates: [
          {
            id: 10,
            name: 'Mixed Day',
            modality: 'mixed',
            sections: [
              { id: 100, section_name: 'Strength', order: 1 },
            ],
          },
        ],
      }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    await user.click(screen.getByText('Block A'))
    await user.click(screen.getByText('Mixed Day'))
    await user.click(screen.getByText('Strength'))

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)

    expect(defaultProps.onConfirm).toHaveBeenCalledWith({
      targetTemplateId: 10,
      targetSectionId: 100,
    })
  })

  // Back navigation
  it('allows going back from template step to mesocycle step', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({ id: 1, name: 'Block A' }),
      makeMeso({ id: 2, name: 'Block B' }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    await user.click(screen.getByText('Block A'))

    // Should be on template step, go back
    const backBtn = screen.getByRole('button', { name: /back/i })
    await user.click(backBtn)

    // Should see mesocycles again
    expect(screen.getByText('Block A')).toBeInTheDocument()
    expect(screen.getByText('Block B')).toBeInTheDocument()
  })

  it('allows going back from section step to template step', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({
        id: 1,
        name: 'Block A',
        templates: [
          {
            id: 10,
            name: 'Mixed Day',
            modality: 'mixed',
            sections: [
              { id: 100, section_name: 'Strength', order: 1 },
            ],
          },
          { id: 11, name: 'Push A', modality: 'resistance', sections: [] },
        ],
      }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} />)
    await user.click(screen.getByText('Block A'))
    await user.click(screen.getByText('Mixed Day'))

    // Now in section step
    expect(screen.getByText('Strength')).toBeInTheDocument()

    const backBtn = screen.getByRole('button', { name: /back/i })
    await user.click(backBtn)

    // Back to template list
    expect(screen.getByText('Mixed Day')).toBeInTheDocument()
    expect(screen.getByText('Push A')).toBeInTheDocument()
  })

  // Pending state
  it('disables confirm button when isPending', async () => {
    const user = userEvent.setup()
    const targets = [
      makeMeso({
        id: 1,
        name: 'Block A',
        templates: [
          { id: 10, name: 'Push A', modality: 'resistance', sections: [] },
        ],
      }),
    ]
    render(<TargetPickerModal {...defaultProps} targets={targets} isPending={true} />)
    await user.click(screen.getByText('Block A'))
    await user.click(screen.getByText('Push A'))

    const confirmBtn = screen.getByRole('button', { name: /transferring/i })
    expect(confirmBtn).toBeDisabled()
  })

  // Error display
  it('displays error message', () => {
    render(<TargetPickerModal {...defaultProps} error="Transfer failed" targets={[makeMeso()]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Transfer failed')
  })

  // Resets state when reopened via onOpenChange(false)
  it('resets to step 1 when dialog is reopened', async () => {
    const user = userEvent.setup()
    const targets = [makeMeso({ id: 1, name: 'Block A' })]
    let isOpen = true
    const onOpenChange = vi.fn((next: boolean) => { isOpen = next })

    const { rerender } = render(
      <TargetPickerModal {...defaultProps} targets={targets} open={isOpen} onOpenChange={onOpenChange} />
    )
    await user.click(screen.getByText('Block A'))

    // Simulate closing via X button — triggers handleOpenChange(false)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await user.click(closeBtn)

    // onOpenChange should have been called with false; rerender as closed then reopened
    rerender(<TargetPickerModal {...defaultProps} targets={targets} open={false} onOpenChange={onOpenChange} />)
    rerender(<TargetPickerModal {...defaultProps} targets={targets} open={true} onOpenChange={onOpenChange} />)

    // Should be back at step 1
    expect(screen.getByText('Block A')).toBeInTheDocument()
  })
})
