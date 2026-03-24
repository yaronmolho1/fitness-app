// T140 tests: Label alignment on section name field (AC1)
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/templates/section-actions', () => ({
  createMixedTemplate: vi.fn(),
}))

import { MixedTemplateForm } from './mixed-template-form'

describe('MixedTemplateForm — Label alignment (T140 AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let counter = 0
    vi.stubGlobal('crypto', {
      ...crypto,
      randomUUID: () => `uuid-${++counter}`,
    })
  })

  afterEach(cleanup)

  it('section name field has a Label element', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.click(screen.getAllByRole('button', { name: 'Add Section' })[0])

    // Both section name and modality should have labels for alignment
    expect(screen.getByText('Section Name', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Modality', { selector: 'label' })).toBeInTheDocument()
  })

  it('section name input is accessible via label', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm mesocycleId={1} />)

    await user.click(screen.getAllByRole('button', { name: 'Add Section' })[0])

    // Should be findable by label text
    const input = screen.getByLabelText(/Section Name/i)
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })
})
