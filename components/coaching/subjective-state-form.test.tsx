// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { SubjectiveStateForm } from './subjective-state-form'
import type { SubjectiveState } from './subjective-state-form'

afterEach(cleanup)

// Wrapper that manages state so controlled inputs work with userEvent.type
function StatefulWrapper({
  initial,
  onChangeSpy,
}: {
  initial: SubjectiveState
  onChangeSpy: (s: SubjectiveState) => void
}) {
  const [state, setState] = useState(initial)
  return (
    <SubjectiveStateForm
      value={state}
      onChange={(s) => {
        setState(s)
        onChangeSpy(s)
      }}
    />
  )
}

const defaultState: SubjectiveState = {
  fatigue: null,
  soreness: null,
  sleepQuality: null,
  currentInjuries: '',
  notes: '',
}

describe('SubjectiveStateForm', () => {
  describe('rendering', () => {
    it('renders section heading', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)
      expect(screen.getByText('Subjective State')).toBeInTheDocument()
    })

    it('renders fatigue rating group with 5 options', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)
      expect(screen.getByText('Fatigue')).toBeInTheDocument()
      const group = screen.getByTestId('rating-fatigue')
      expect(group.querySelectorAll('button')).toHaveLength(5)
    })

    it('renders soreness rating group with 5 options', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)
      expect(screen.getByText('Soreness')).toBeInTheDocument()
      const group = screen.getByTestId('rating-soreness')
      expect(group.querySelectorAll('button')).toHaveLength(5)
    })

    it('renders sleep quality rating group with 5 options', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)
      expect(screen.getByText('Sleep Quality')).toBeInTheDocument()
      const group = screen.getByTestId('rating-sleepQuality')
      expect(group.querySelectorAll('button')).toHaveLength(5)
    })

    it('renders current injuries input', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)
      expect(screen.getByLabelText('Current Injuries')).toBeInTheDocument()
    })

    it('renders notes textarea', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)
      expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    })
  })

  describe('rating selection', () => {
    it('calls onChange with fatigue value when clicked', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<SubjectiveStateForm value={defaultState} onChange={onChange} />)

      const group = screen.getByTestId('rating-fatigue')
      const buttons = group.querySelectorAll('button')
      await user.click(buttons[2]) // click "3"

      expect(onChange).toHaveBeenCalledWith({ ...defaultState, fatigue: 3 })
    })

    it('calls onChange with soreness value when clicked', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<SubjectiveStateForm value={defaultState} onChange={onChange} />)

      const group = screen.getByTestId('rating-soreness')
      const buttons = group.querySelectorAll('button')
      await user.click(buttons[4]) // click "5"

      expect(onChange).toHaveBeenCalledWith({ ...defaultState, soreness: 5 })
    })

    it('calls onChange with sleepQuality value when clicked', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<SubjectiveStateForm value={defaultState} onChange={onChange} />)

      const group = screen.getByTestId('rating-sleepQuality')
      const buttons = group.querySelectorAll('button')
      await user.click(buttons[0]) // click "1"

      expect(onChange).toHaveBeenCalledWith({ ...defaultState, sleepQuality: 1 })
    })

    it('highlights the selected rating button', () => {
      render(
        <SubjectiveStateForm
          value={{ ...defaultState, fatigue: 4 }}
          onChange={vi.fn()}
        />
      )
      const group = screen.getByTestId('rating-fatigue')
      const buttons = group.querySelectorAll('button')
      expect(buttons[3]).toHaveAttribute('aria-pressed', 'true')
      expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
    })

    it('deselects rating when clicking already-selected value', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <SubjectiveStateForm
          value={{ ...defaultState, fatigue: 3 }}
          onChange={onChange}
        />
      )

      const group = screen.getByTestId('rating-fatigue')
      const buttons = group.querySelectorAll('button')
      await user.click(buttons[2]) // click "3" again to deselect

      expect(onChange).toHaveBeenCalledWith({ ...defaultState, fatigue: null })
    })
  })

  describe('text inputs', () => {
    it('calls onChange when typing in current injuries', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<StatefulWrapper initial={defaultState} onChangeSpy={onChange} />)

      const input = screen.getByLabelText('Current Injuries')
      await user.type(input, 'Left knee pain')

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
      expect(lastCall.currentInjuries).toBe('Left knee pain')
    })

    it('calls onChange when typing in notes', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<StatefulWrapper initial={defaultState} onChangeSpy={onChange} />)

      const textarea = screen.getByLabelText('Notes')
      await user.type(textarea, 'Felt good today')

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
      expect(lastCall.notes).toBe('Felt good today')
    })

    it('displays existing text values from props', () => {
      render(
        <SubjectiveStateForm
          value={{ ...defaultState, currentInjuries: 'Sore shoulder', notes: 'Week 3' }}
          onChange={vi.fn()}
        />
      )

      expect(screen.getByLabelText('Current Injuries')).toHaveValue('Sore shoulder')
      expect(screen.getByLabelText('Notes')).toHaveValue('Week 3')
    })
  })

  describe('accessibility', () => {
    it('rating buttons have accessible labels', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)

      const group = screen.getByTestId('rating-fatigue')
      const buttons = group.querySelectorAll('button')
      expect(buttons[0]).toHaveAttribute('aria-label', 'Fatigue: 1')
      expect(buttons[4]).toHaveAttribute('aria-label', 'Fatigue: 5')
    })

    it('rating groups have role="group"', () => {
      render(<SubjectiveStateForm value={defaultState} onChange={vi.fn()} />)

      const group = screen.getByTestId('rating-fatigue')
      expect(group).toHaveAttribute('role', 'group')
    })
  })
})
