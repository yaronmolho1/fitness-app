// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NumericInput } from './numeric-input'

describe('NumericInput', () => {
  afterEach(cleanup)

  // AC1: backspace to empty shows blank, not "0"
  describe('AC1 — backspace to empty shows blank', () => {
    it('integer: clearing value "8" shows empty', async () => {
      const onChange = vi.fn()
      const { rerender } = render(
        <NumericInput value="8" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement

      await userEvent.setup().clear(input)
      // onValueChange should be called with ''
      expect(onChange).toHaveBeenLastCalledWith('')
    })

    it('decimal: clearing value "82.5" shows empty', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="82.5" onValueChange={onChange} mode="decimal" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().clear(input)
      expect(onChange).toHaveBeenLastCalledWith('')
    })
  })

  // AC2: typing after clear gives clean value, not "05"
  describe('AC2 — typing after clear gives clean value', () => {
    it('typing "5" into empty input yields "5"', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().type(input, '5')
      expect(onChange).toHaveBeenLastCalledWith('5')
    })
  })

  // AC3: blur normalizes — empty stays empty
  describe('AC3 — blur behavior', () => {
    it('blur on empty value keeps empty', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().click(input)
      await userEvent.setup().tab()
      // No call with '0' or anything — stays empty
      // If onValueChange was called, it should not be '0'
      const calls = onChange.mock.calls
      const lastVal = calls.length > 0 ? calls[calls.length - 1][0] : ''
      expect(lastVal).not.toBe('0')
    })

    it('blur normalizes leading zeros: "007" becomes "7"', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="007" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement

      // Focus then blur to trigger normalization
      const user = userEvent.setup()
      await user.click(input)
      await user.tab()

      expect(onChange).toHaveBeenLastCalledWith('7')
    })

    it('blur normalizes "12." to "12" for decimal mode', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="12." onValueChange={onChange} mode="decimal" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      const user = userEvent.setup()
      await user.click(input)
      await user.tab()
      expect(onChange).toHaveBeenLastCalledWith('12')
    })
  })

  // AC4: select-all and type replaces
  describe('AC4 — select all and type replaces', () => {
    it('select all + type "8" shows "8"', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="12" onValueChange={onChange} mode="integer" />
      )
      const user = userEvent.setup()
      const input = screen.getByRole('textbox') as HTMLInputElement
      await user.clear(input)
      await user.type(input, '8')
      expect(onChange).toHaveBeenLastCalledWith('8')
    })
  })

  // AC5: decimal input accepts "82.5"
  describe('AC5 — decimal input', () => {
    it('accepts "82.5" in decimal mode', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="decimal" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().type(input, '82.5')
      expect(onChange).toHaveBeenLastCalledWith('82.5')
    })

    it('rejects decimal in integer mode', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().type(input, '82.5')
      // Should strip the dot, resulting in "825"
      expect(onChange).toHaveBeenLastCalledWith('825')
    })
  })

  // AC6: non-numeric characters rejected
  describe('AC6 — non-numeric rejected', () => {
    it('letters are stripped from input', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().type(input, 'abc')
      // No numeric value produced — onValueChange should not be called with letters
      const calls = onChange.mock.calls.filter((args: string[]) => args[0] !== '')
      expect(calls).toHaveLength(0)
    })

    it('mixed input: "1a2b3" yields "123"', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.setup().type(input, '1a2b3')
      // Only the digits should get through
      expect(onChange).toHaveBeenLastCalledWith('123')
    })
  })

  // AC7: correct inputMode
  describe('AC7 — inputMode', () => {
    it('integer mode has inputMode="numeric"', () => {
      render(
        <NumericInput value="" onValueChange={vi.fn()} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.inputMode).toBe('numeric')
    })

    it('decimal mode has inputMode="decimal"', () => {
      render(
        <NumericInput value="" onValueChange={vi.fn()} mode="decimal" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.inputMode).toBe('decimal')
    })
  })

  // Edge cases
  describe('edge cases', () => {
    it('explicitly typed "0" is accepted', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      await userEvent.setup().type(screen.getByRole('textbox'), '0')
      expect(onChange).toHaveBeenLastCalledWith('0')
    })

    it('negative sign is rejected (all fitness inputs non-negative)', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      await userEvent.setup().type(screen.getByRole('textbox'), '-5')
      // '-' stripped, only '5' gets through
      expect(onChange).toHaveBeenLastCalledWith('5')
    })

    it('large numbers accepted (no artificial max)', async () => {
      const onChange = vi.fn()
      render(
        <NumericInput value="" onValueChange={onChange} mode="integer" />
      )
      await userEvent.setup().type(screen.getByRole('textbox'), '99999')
      expect(onChange).toHaveBeenLastCalledWith('99999')
    })

    it('renders as type="text" (not type="number")', () => {
      render(
        <NumericInput value="" onValueChange={vi.fn()} mode="integer" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.type).toBe('text')
    })

    it('passes through className prop', () => {
      render(
        <NumericInput value="" onValueChange={vi.fn()} mode="integer" className="w-20" />
      )
      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.className).toContain('w-20')
    })

    it('passes through id prop', () => {
      render(
        <NumericInput value="5" onValueChange={vi.fn()} mode="integer" id="my-input" />
      )
      expect(document.getElementById('my-input')).toBeTruthy()
    })

    it('passes through placeholder prop', () => {
      render(
        <NumericInput value="" onValueChange={vi.fn()} mode="integer" placeholder="0" />
      )
      expect(screen.getByPlaceholderText('0')).toBeTruthy()
    })
  })
})
