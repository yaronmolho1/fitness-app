'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { assignTemplate, removeAssignment } from '@/lib/schedule/actions'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  schedule: ScheduleEntry[]
  isCompleted: boolean
  variant: 'normal' | 'deload'
}

export function ScheduleGrid({ mesocycleId, templates, schedule: initialSchedule, isCompleted, variant }: Props) {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [pickerDay, setPickerDay] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function getAssignment(day: number) {
    return schedule.find((s) => s.day_of_week === day) ?? null
  }

  function handleAssignClick(day: number) {
    setError(null)
    setPickerDay(day)
  }

  function handleTemplatePick(templateId: number) {
    if (pickerDay === null) return
    const day = pickerDay
    setPickerDay(null)

    startTransition(async () => {
      const result = await assignTemplate({
        mesocycle_id: mesocycleId,
        day_of_week: day,
        template_id: templateId,
        week_type: variant,
      })

      if (result.success) {
        const tmpl = templates.find((t) => t.id === templateId)
        setSchedule((prev) => {
          const filtered = prev.filter((s) => s.day_of_week !== day)
          return [
            ...filtered,
            {
              day_of_week: day,
              template_id: templateId,
              template_name: tmpl?.name ?? 'Unknown',
            },
          ]
        })
        setError(null)
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove(day: number) {
    setError(null)
    startTransition(async () => {
      const result = await removeAssignment({
        mesocycle_id: mesocycleId,
        day_of_week: day,
        week_type: variant,
      })

      if (result.success) {
        setSchedule((prev) => prev.filter((s) => s.day_of_week !== day))
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
        {DAY_NAMES.map((dayName, dayIndex) => {
          const assignment = getAssignment(dayIndex)
          const showPicker = pickerDay === dayIndex

          return (
            <div
              key={dayIndex}
              data-testid={`day-cell-${dayIndex}`}
              className={cn(
                'rounded-xl border p-3 transition-colors duration-150',
                assignment
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-dashed border-muted-foreground/30 bg-muted/20'
              )}
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {dayName}
              </p>

              {assignment ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{assignment.template_name}</p>
                  {!isCompleted && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleAssignClick(dayIndex)}
                        disabled={isPending}
                        aria-label="Replace template"
                      >
                        Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRemove(dayIndex)}
                        disabled={isPending}
                        aria-label="Remove assignment"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm italic text-muted-foreground" data-testid="rest-label">Rest</p>
                  {!isCompleted && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-full text-xs"
                      onClick={() => handleAssignClick(dayIndex)}
                      disabled={isPending}
                      aria-label="Assign template"
                    >
                      Assign
                    </Button>
                  )}
                </div>
              )}

              {showPicker && (
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
