'use client'

import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { cn } from '@/lib/utils'

export type FrequencyMode = 'daily' | 'specific_days' | 'weekly_target'

const MODE_OPTIONS: { value: FrequencyMode; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'specific_days', label: 'Specific Days' },
  { value: 'weekly_target', label: 'X per Week' },
]

// 0=Sunday per JS Date.getDay()
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

type FrequencyModeSelectorProps = {
  mode: FrequencyMode
  weeklyTarget: number
  selectedDays: number[]
  onModeChange: (mode: FrequencyMode) => void
  onWeeklyTargetChange: (value: number) => void
  onSelectedDaysChange: (days: number[]) => void
}

export function FrequencyModeSelector({
  mode,
  weeklyTarget,
  selectedDays,
  onModeChange,
  onWeeklyTargetChange,
  onSelectedDaysChange,
}: FrequencyModeSelectorProps) {
  function handleDayToggle(dayIndex: number) {
    const isSelected = selectedDays.includes(dayIndex)
    if (isSelected) {
      // Prevent deselecting the last day
      if (selectedDays.length <= 1) return
      onSelectedDaysChange(selectedDays.filter((d) => d !== dayIndex))
    } else {
      onSelectedDaysChange([...selectedDays, dayIndex])
    }
  }

  return (
    <div className="space-y-3">
      <Label>Frequency</Label>

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg border p-1">
        {MODE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="button"
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
            onClick={() => {
              if (mode !== value) onModeChange(value)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Day pills for specific_days mode */}
      {mode === 'specific_days' && (
        <div className="flex gap-2">
          {DAY_LABELS.map((label, index) => {
            const isSelected = selectedDays.includes(index)
            return (
              <button
                key={index}
                type="button"
                data-selected={isSelected ? 'true' : 'false'}
                className={cn(
                  'h-10 min-h-[40px] w-10 min-w-[40px] rounded-full text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-input bg-background text-muted-foreground hover:bg-muted'
                )}
                onClick={() => handleDayToggle(index)}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Number input for weekly_target mode */}
      {mode === 'weekly_target' && (
        <div className="space-y-2">
          <Label htmlFor="frequency-weekly-target">Times per week</Label>
          <NumericInput
            id="frequency-weekly-target"
            mode="integer"
            value={String(weeklyTarget)}
            onValueChange={(v) => onWeeklyTargetChange(v === '' ? 0 : Number(v))}
          />
        </div>
      )}
    </div>
  )
}
