'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { assignTemplate, removeAssignment } from '@/lib/schedule/actions'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'
import { DAY_NAMES, displayToInternal } from '@/lib/day-mapping'

const PERIODS = ['morning', 'afternoon', 'evening'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_LABELS: Record<Period, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

// Default time_slot for each period (used when UI still picks by period)
const PERIOD_DEFAULT_TIME: Record<Period, string> = {
  morning: '07:00',
  afternoon: '13:00',
  evening: '18:00',
}

const DEFAULT_DURATION = 90

// Stable sort order for period display
const PERIOD_ORDER: Record<Period, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
}

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  schedule: ScheduleEntry[]
  isCompleted: boolean
  variant: 'normal' | 'deload'
}

type PickerState = {
  day: number
  period: Period
} | null

export function ScheduleGrid({ mesocycleId, templates, schedule: initialSchedule, isCompleted, variant }: Props) {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [picker, setPicker] = useState<PickerState>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function getAssignments(day: number): ScheduleEntry[] {
    return schedule
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period])
  }

  function getUsedPeriods(day: number): Set<Period> {
    return new Set(schedule.filter((s) => s.day_of_week === day).map((s) => s.period))
  }

  function handleAddClick(day: number, period: Period) {
    setError(null)
    setPicker({ day, period })
  }

  function handleTemplatePick(templateId: number) {
    if (!picker) return
    const { day, period } = picker
    setPicker(null)

    const timeSlot = PERIOD_DEFAULT_TIME[period]

    startTransition(async () => {
      const result = await assignTemplate({
        mesocycle_id: mesocycleId,
        day_of_week: day,
        template_id: templateId,
        week_type: variant,
        time_slot: timeSlot,
        duration: DEFAULT_DURATION,
      })

      if (result.success) {
        const tmpl = templates.find((t) => t.id === templateId)
        setSchedule((prev) => [
          ...prev,
          {
            id: result.data.id,
            day_of_week: day,
            template_id: templateId,
            template_name: tmpl?.name ?? 'Unknown',
            period: result.data.period,
            time_slot: result.data.time_slot,
            duration: result.data.duration,
          },
        ])
        setError(null)
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove(entry: ScheduleEntry) {
    setError(null)
    startTransition(async () => {
      const result = await removeAssignment({ id: entry.id })

      if (result.success) {
        setSchedule((prev) =>
          prev.filter((s) => s.id !== entry.id)
        )
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {DAY_NAMES.map((dayName, displayIdx) => {
          const internalDay = displayToInternal(displayIdx)
          const assignments = getAssignments(internalDay)
          const usedPeriods = getUsedPeriods(internalDay)
          const hasAssignments = assignments.length > 0
          const unusedPeriods = PERIODS.filter((p) => !usedPeriods.has(p))

          return (
            <div
              key={displayIdx}
              data-testid={`day-cell-${internalDay}`}
              className={cn(
                'rounded-xl border p-3 transition-colors duration-150',
                hasAssignments
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-dashed border-muted-foreground/30 bg-muted/20'
              )}
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {dayName}
              </p>

              {/* Existing entries stacked by period */}
              {assignments.map((entry) => (
                <div
                  key={entry.id}
                  data-testid="schedule-entry"
                  className="mb-2 space-y-1"
                >
                  <p
                    data-testid="period-label"
                    className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {PERIOD_LABELS[entry.period]}
                  </p>
                  <p className="text-sm font-semibold">{entry.template_name}</p>
                  {!isCompleted && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRemove(entry)}
                        disabled={isPending}
                        aria-label="Remove assignment"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Rest label when no assignments */}
              {!hasAssignments && (
                <p className="text-sm italic text-muted-foreground" data-testid="rest-label">Rest</p>
              )}

              {/* Add buttons for unused period slots */}
              {!isCompleted && unusedPeriods.length > 0 && (
                <div className="mt-1 space-y-1">
                  {unusedPeriods.map((period) => (
                    <Button
                      key={period}
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-xs"
                      onClick={() => handleAddClick(internalDay, period)}
                      disabled={isPending}
                      aria-label={`Add ${period}`}
                    >
                      + {PERIOD_LABELS[period]}
                    </Button>
                  ))}
                </div>
              )}

              {/* Template picker for the active slot */}
              {picker?.day === internalDay && (
                <div className="mt-2 rounded-md border bg-background p-2 shadow-md">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-accent"
                      onClick={() => handleTemplatePick(tmpl.id)}
                    >
                      {tmpl.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
