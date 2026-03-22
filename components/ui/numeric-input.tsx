'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type NumericInputOwnProps = {
  value: string
  onValueChange: (value: string) => void
  mode: 'integer' | 'decimal'
}

type NumericInputProps = NumericInputOwnProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof NumericInputOwnProps | 'type' | 'inputMode' | 'onChange' | 'onBlur'>

// Controlled text input with numeric filtering.
// Replaces type="number" to fix the zero/backspace problem.
const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, mode, className, ...props }, ref) => {
    const [internal, setInternal] = React.useState(value)
    const pattern = mode === 'decimal' ? /[^0-9.]/g : /[^0-9]/g

    // Sync from parent when the controlled value changes
    React.useEffect(() => {
      setInternal(value)
    }, [value])

    function sanitize(raw: string): string {
      let cleaned = raw.replace(pattern, '')
      if (mode === 'decimal') {
        // Allow only one decimal point
        const parts = cleaned.split('.')
        if (parts.length > 2) {
          cleaned = parts[0] + '.' + parts.slice(1).join('')
        }
      }
      return cleaned
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const sanitized = sanitize(e.target.value)
      setInternal(sanitized)
      onValueChange(sanitized)
    }

    function handleBlur() {
      if (internal === '' || internal === '.') {
        if (internal === '.') {
          setInternal('')
          onValueChange('')
        }
        return
      }
      // Normalize: strip leading zeros, trailing dot
      const num = parseFloat(internal)
      if (isNaN(num)) {
        setInternal('')
        onValueChange('')
        return
      }
      const normalized = String(num)
      if (normalized !== internal) {
        setInternal(normalized)
        onValueChange(normalized)
      }
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode={mode === 'decimal' ? 'decimal' : 'numeric'}
        value={internal}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        {...props}
      />
    )
  },
)
NumericInput.displayName = 'NumericInput'

export { NumericInput }
export type { NumericInputProps }
