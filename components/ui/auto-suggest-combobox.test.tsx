// @vitest-environment jsdom
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

import { AutoSuggestCombobox } from './auto-suggest-combobox'

describe('AutoSuggestCombobox', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const items = ['Barbell', 'Dumbbell', 'Cable', 'Bodyweight']

  it('renders with label and placeholder', () => {
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={vi.fn()}
        label="Equipment"
        placeholder="Select equipment..."
      />
    )
    expect(screen.getByLabelText('Equipment')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Select equipment...')).toBeInTheDocument()
  })

  it('shows suggestions on focus', async () => {
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    await user.click(screen.getByLabelText('Equipment'))
    for (const item of items) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
  })

  it('filters suggestions case-insensitively', async () => {
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    const input = screen.getByLabelText('Equipment')
    await user.click(input)
    await user.type(input, 'bar')
    expect(screen.getByText('Barbell')).toBeInTheDocument()
    expect(screen.queryByText('Dumbbell')).not.toBeInTheDocument()
    expect(screen.queryByText('Cable')).not.toBeInTheDocument()
  })

  it('calls onChange when selecting an existing item', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={onChange}
        label="Equipment"
      />
    )
    await user.click(screen.getByLabelText('Equipment'))
    await user.click(screen.getByText('Cable'))
    expect(onChange).toHaveBeenCalledWith('Cable')
  })

  it('allows typing a new custom value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={onChange}
        label="Equipment"
      />
    )
    const input = screen.getByLabelText('Equipment')
    await user.click(input)
    await user.type(input, 'Kettlebell')
    // onChange fires on each keystroke for custom values
    expect(onChange).toHaveBeenLastCalledWith('Kettlebell')
  })

  it('works with empty items array', async () => {
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={[]}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    const input = screen.getByLabelText('Equipment')
    await user.click(input)
    // Should still be usable as a plain text input
    await user.type(input, 'Anything')
    expect(input).toHaveValue('Anything')
  })

  it('excludes empty/null values from suggestions', async () => {
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={['Barbell', '', 'Cable']}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    await user.click(screen.getByLabelText('Equipment'))
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    // Only Barbell and Cable, not empty string
    expect(options).toHaveLength(2)
  })

  it('displays controlled value', () => {
    render(
      <AutoSuggestCombobox
        items={items}
        value="Dumbbell"
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    expect(screen.getByLabelText('Equipment')).toHaveValue('Dumbbell')
  })

  it('has mobile-friendly touch targets (min 44px height)', () => {
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    const input = screen.getByLabelText('Equipment')
    // Check that the input has min-h-[44px] class or equivalent
    expect(input.className).toMatch(/min-h-\[44px\]|min-h-11/)
  })

  it('closes dropdown on item selection', async () => {
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    await user.click(screen.getByLabelText('Equipment'))
    expect(screen.getByText('Barbell')).toBeInTheDocument()
    await user.click(screen.getByText('Barbell'))
    // Dropdown should be closed — items no longer visible
    expect(screen.queryByText('Cable')).not.toBeInTheDocument()
  })

  it('does not show duplicate when typed value matches suggestion exactly', async () => {
    const user = userEvent.setup()
    render(
      <AutoSuggestCombobox
        items={items}
        value=""
        onChange={vi.fn()}
        label="Equipment"
      />
    )
    const input = screen.getByLabelText('Equipment')
    await user.click(input)
    await user.type(input, 'Barbell')
    const listbox = screen.getByRole('listbox')
    const matchingOptions = within(listbox).getAllByText('Barbell')
    expect(matchingOptions).toHaveLength(1)
  })
})
