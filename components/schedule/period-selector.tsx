'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export type Period = 'morning' | 'afternoon' | 'evening'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
]

/** Derive period from HH:MM time string. Returns null for invalid input. */
export function derivePeriodFromTime(time: string): Period | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  const hour = parseInt(match[1], 10)
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

type Props = {
  period: Period
  onPeriodChange: (period: Period) => void
  timeSlot?: string
  onTimeSlotChange?: (timeSlot: string | undefined) => void
}

export function PeriodSelector({
  period,
  onPeriodChange,
  timeSlot,
  onTimeSlotChange,
}: Props) {
  const [showTimePicker, setShowTimePicker] = useState(!!timeSlot)

  function handleTimeChange(value: string) {
    onTimeSlotChange?.(value || undefined)
    const derived = derivePeriodFromTime(value)
    if (derived) {
      onPeriodChange(derived)
    }
  }

  function handleToggleTime() {
    if (showTimePicker) {
      onTimeSlotChange?.(undefined)
      setShowTimePicker(false)
    } else {
      setShowTimePicker(true)
    }
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Period">
        <div className="flex gap-1">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="button"
              aria-pressed={period === value}
              onClick={() => {
                if (period !== value) onPeriodChange(value)
              }}
              className={cn(
                'min-h-[44px] min-w-[44px] flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                period === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {onTimeSlotChange && (
        <div className="space-y-2">
          {!showTimePicker ? (
            <button
              type="button"
              onClick={handleToggleTime}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              aria-label="Set time"
            >
              Set time
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="Time"
                value={timeSlot ?? ''}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="min-h-[44px] rounded-md border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleToggleTime}
                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                aria-label="Clear time"
              >
                Clear time
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
