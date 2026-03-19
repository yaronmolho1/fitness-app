// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

const mockCreateMixedTemplate = vi.fn()

vi.mock('@/lib/templates/section-actions', () => ({
  createMixedTemplate: (...args: unknown[]) => mockCreateMixedTemplate(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))

import { MixedTemplateForm } from './mixed-template-form'

describe('MixedTemplateForm', () => {
  const defaultProps = { mesocycleId: 1 }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // ============================================================================
  // Rendering
  // ============================================================================

  it('renders template name input and Add Section button', () => {
    render(<MixedTemplateForm {...defaultProps} />)

    expect(screen.getByLabelText(/template name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add section/i })).toBeInTheDocument()
  })

  it('renders Cancel and Create buttons', () => {
    render(<MixedTemplateForm {...defaultProps} onCancel={() => {}} />)

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('shows no sections initially', () => {
    render(<MixedTemplateForm {...defaultProps} />)

    // No section cards should appear
    expect(screen.queryByText(/section 1/i)).not.toBeInTheDocument()
  })

  // ============================================================================
  // Adding sections
  // ============================================================================

  it('adds a section when Add Section is clicked', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add section/i }))

    // Should show section name input and modality selector
    expect(screen.getByPlaceholderText(/section name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/modality/i)).toBeInTheDocument()
  })

  it('shows running-specific fields when modality is running', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add section/i }))

    // Select running modality
    await user.selectOptions(screen.getByLabelText(/modality/i), 'running')

    expect(screen.getByLabelText(/run type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target pace/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hr zone/i)).toBeInTheDocument()
  })

  it('shows MMA-specific fields when modality is mma', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.selectOptions(screen.getByLabelText(/modality/i), 'mma')

    expect(screen.getByLabelText(/planned duration/i)).toBeInTheDocument()
  })

  it('shows no extra fields for resistance modality', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add section/i }))

    // Default or explicit resistance — no run/mma fields
    expect(screen.queryByLabelText(/run type/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/planned duration/i)).not.toBeInTheDocument()
  })

  it('can add multiple sections', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    // Both sections have section name inputs
    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    expect(nameInputs).toHaveLength(2)
  })

  it('can remove a section', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /add section/i }))

    // Should have a remove button
    const removeBtn = screen.getByRole('button', { name: /remove/i })
    await user.click(removeBtn)

    expect(screen.queryByPlaceholderText(/section name/i)).not.toBeInTheDocument()
  })

  // ============================================================================
  // Validation
  // ============================================================================

  it('shows error when template name is empty on submit', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    // Add 2 sections with different modalities but no template name
    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs[0], 'Main Lift')
    await user.type(nameInputs[1], 'Cooldown Run')

    // Set second section to running
    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'running')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/name.*required/i)
    expect(mockCreateMixedTemplate).not.toHaveBeenCalled()
  })

  it('shows error when fewer than 2 sections', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Mixed Workout')
    await user.click(screen.getByRole('button', { name: /add section/i }))

    const nameInput = screen.getByPlaceholderText(/section name/i)
    await user.type(nameInput, 'Main Lift')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/2.*section/i)
    expect(mockCreateMixedTemplate).not.toHaveBeenCalled()
  })

  it('shows error when all sections have same modality', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Mixed Workout')

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs[0], 'Lift A')
    await user.type(nameInputs[1], 'Lift B')

    // Both default to resistance
    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/different modal/i)
    expect(mockCreateMixedTemplate).not.toHaveBeenCalled()
  })

  it('shows error when a section name is empty', async () => {
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Mixed Workout')

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    // Only fill first section name
    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs[0], 'Main Lift')

    // Set second to running but leave name empty
    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'running')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/section name/i)
    expect(mockCreateMixedTemplate).not.toHaveBeenCalled()
  })

  // ============================================================================
  // Successful submission
  // ============================================================================

  it('calls createMixedTemplate with correct data on valid submit', async () => {
    mockCreateMixedTemplate.mockResolvedValue({ success: true, data: { template: {}, sections: [] } })
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<MixedTemplateForm {...defaultProps} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/template name/i), 'Strength + Cardio')

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs[0], 'Main Lift')
    await user.type(nameInputs[1], 'Cooldown Run')

    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'running')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    await waitFor(() => {
      expect(mockCreateMixedTemplate).toHaveBeenCalledWith({
        name: 'Strength + Cardio',
        mesocycle_id: 1,
        sections: [
          expect.objectContaining({
            section_name: 'Main Lift',
            modality: 'resistance',
            order: 1,
          }),
          expect.objectContaining({
            section_name: 'Cooldown Run',
            modality: 'running',
            order: 2,
          }),
        ],
      })
    })

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('displays server error from createMixedTemplate', async () => {
    mockCreateMixedTemplate.mockResolvedValue({
      success: false,
      error: 'Duplicate canonical name',
    })
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Mixed')

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs[0], 'Lift')
    await user.type(nameInputs[1], 'Run')

    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'running')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/duplicate canonical/i)
    })
  })

  it('disables submit button while submitting', async () => {
    // Never resolve to keep in pending state
    mockCreateMixedTemplate.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Mixed')

    await user.click(screen.getByRole('button', { name: /add section/i }))
    await user.click(screen.getByRole('button', { name: /add section/i }))

    const nameInputs = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs[0], 'Lift')
    await user.type(nameInputs[1], 'Run')

    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'running')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
    })
  })

  // ============================================================================
  // Running section fields
  // ============================================================================

  it('submits running section with all running fields', async () => {
    mockCreateMixedTemplate.mockResolvedValue({ success: true, data: { template: {}, sections: [] } })
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Combo')

    // Add resistance section
    await user.click(screen.getByRole('button', { name: /add section/i }))
    const nameInputs1 = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs1[0], 'Lift')

    // Add running section
    await user.click(screen.getByRole('button', { name: /add section/i }))
    const nameInputs2 = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs2[1], 'Intervals')

    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'running')

    // Fill running fields
    await user.selectOptions(screen.getByLabelText(/run type/i), 'interval')
    await user.type(screen.getByLabelText(/target pace/i), '4:30/km')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    await waitFor(() => {
      expect(mockCreateMixedTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              section_name: 'Intervals',
              modality: 'running',
              run_type: 'interval',
              target_pace: '4:30/km',
            }),
          ]),
        })
      )
    })
  })

  // ============================================================================
  // MMA section fields
  // ============================================================================

  it('submits MMA section with planned_duration', async () => {
    mockCreateMixedTemplate.mockResolvedValue({ success: true, data: { template: {}, sections: [] } })
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} />)

    await user.type(screen.getByLabelText(/template name/i), 'Combo')

    // Resistance section
    await user.click(screen.getByRole('button', { name: /add section/i }))
    const nameInputs1 = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs1[0], 'Lift')

    // MMA section
    await user.click(screen.getByRole('button', { name: /add section/i }))
    const nameInputs2 = screen.getAllByPlaceholderText(/section name/i)
    await user.type(nameInputs2[1], 'Sparring')

    const modalitySelects = screen.getAllByLabelText(/modality/i)
    await user.selectOptions(modalitySelects[1], 'mma')

    await user.type(screen.getByLabelText(/planned duration/i), '60')

    await user.click(screen.getByRole('button', { name: /create mixed/i }))

    await waitFor(() => {
      expect(mockCreateMixedTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              section_name: 'Sparring',
              modality: 'mma',
              planned_duration: 60,
            }),
          ]),
        })
      )
    })
  })

  // ============================================================================
  // Cancel
  // ============================================================================

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<MixedTemplateForm {...defaultProps} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalled()
  })
})
