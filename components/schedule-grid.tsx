'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { assignTemplate, removeAssignment } from '@/lib/schedule/actions'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'
import { DAY_NAMES, displayToInternal } from '@/lib/day-mapping'
import { derivePeriod, checkOverlap, timeSlotSchema } from '@/lib/schedule/time-utils'

const PERIOD_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

const DEFAULT_TIME_SLOT = '07:00'
const DEFAULT_DURATION = 90

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  schedule: ScheduleEntry[]
  isCompleted: boolean
  variant: 'normal' | 'deload'
}

type FormState = {
  day: number
  selectedTemplateId: number | null
  timeSlot: string
  duration: string
} | null

// Get duration from template fields: estimated_duration > target_duration > planned_duration > 90
function getTemplateDuration(tmpl: TemplateOption): number {
  if (tmpl.estimated_duration) return tmpl.estimated_duration
  if (tmpl.target_duration) return tmpl.target_duration
  if (tmpl.planned_duration) return tmpl.planned_duration
  return DEFAULT_DURATION
}

export function ScheduleGrid({ mesocycleId, templates, schedule: initialSchedule, isCompleted, variant }: Props) {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [form, setForm] = useState<FormState>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function getAssignments(day: number): ScheduleEntry[] {
    return schedule
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
  }

  function handleAddClick(day: number) {
    setError(null)
    setFormError(null)
    setForm({ day, selectedTemplateId: null, timeSlot: DEFAULT_TIME_SLOT, duration: String(DEFAULT_DURATION) })
  }

  function handleTemplateSelect(templateId: number) {
    if (!form) return
    const tmpl = templates.find((t) => t.id === templateId)
    const duration = tmpl ? getTemplateDuration(tmpl) : DEFAULT_DURATION
    setForm({ ...form, selectedTemplateId: templateId, duration: String(duration) })
  }

  function handleCancel() {
    setForm(null)
    setFormError(null)
  }

  function handleConfirm() {
    if (!form || !form.selectedTemplateId) return
    const { day, selectedTemplateId, timeSlot } = form

    const timeResult = timeSlotSchema.safeParse(timeSlot)
    if (!timeResult.success) {
      setFormError('Invalid time format. Use HH:MM (00:00-23:59)')
      return
    }

    const duration = parseInt(form.duration, 10)
    if (isNaN(duration) || duration <= 0) {
      setFormError('Duration must be a positive number')
      return
    }

    setFormError(null)
    setForm(null)

    startTransition(async () => {
      const result = await assignTemplate({
        mesocycle_id: mesocycleId,
        day_of_week: day,
        template_id: selectedTemplateId,
        week_type: variant,
        time_slot: timeSlot,
        duration,
      })

      if (result.success) {
        const tmpl = templates.find((t) => t.id === selectedTemplateId)
        setSchedule((prev) => [
          ...prev,
          {
            id: result.data.id,
            day_of_week: day,
            template_id: selectedTemplateId,
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

  // Check overlap for the current form state
  function hasOverlap(): boolean {
    if (!form || !form.selectedTemplateId || !form.timeSlot) return false
    const duration = parseInt(form.duration, 10)
    if (isNaN(duration) || duration <= 0) return false
    const existing = schedule
      .filter((s) => s.day_of_week === form.day)
      .map((s) => ({ time_slot: s.time_slot, duration: s.duration }))
    return checkOverlap(existing, form.timeSlot, duration)
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
          const hasAssignments = assignments.length > 0

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

              {/* Entries sorted chronologically */}
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
                    {PERIOD_LABELS[derivePeriod(entry.time_slot)] ?? entry.period}
                  </p>
                  <span
                    data-testid="time-display"
                    className="text-[10px] font-mono text-muted-foreground"
                  >
                    {entry.time_slot}
                  </span>
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

              {/* Single add button (unlimited per day) */}
              {!isCompleted && (
                <div className="mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => handleAddClick(internalDay)}
                    disabled={isPending || form?.day === internalDay}
                    aria-label="Add workout"
                  >
                    + Add Workout
                  </Button>
                </div>
              )}

              {/* Inline add workout form */}
              {form?.day === internalDay && (
                <div className="mt-2 rounded-md border bg-background p-2 shadow-md" data-testid="add-workout-form">
                  {/* Template picker */}
                  {!form.selectedTemplateId && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Select template</p>
                      {templates.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-accent"
                          onClick={() => handleTemplateSelect(tmpl.id)}
                        >
                          {tmpl.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time + duration inputs (shown after template selected) */}
                  {form.selectedTemplateId && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">
                        {templates.find((t) => t.id === form.selectedTemplateId)?.name}
                      </p>

                      <div>
                        <label htmlFor={`time-${internalDay}`} className="text-xs text-muted-foreground">
                          Time
                        </label>
                        <Input
                          id={`time-${internalDay}`}
                          type="text"
                          placeholder="HH:MM"
                          value={form.timeSlot}
                          onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div>
                        <label htmlFor={`duration-${internalDay}`} className="text-xs text-muted-foreground">
                          Duration (min)
                        </label>
                        <Input
                          id={`duration-${internalDay}`}
                          type="number"
                          min={1}
                          value={form.duration}
                          onChange={(e) => setForm({ ...form, duration: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>

                      {/* Form validation error */}
                      {formError && (
                        <p
                          data-testid="form-error"
                          className="text-xs text-destructive"
                        >
                          {formError}
                        </p>
                      )}

                      {/* Overlap warning */}
                      {hasOverlap() && (
                        <p
                          data-testid="overlap-warning"
                          className="text-xs text-yellow-600 bg-yellow-50 rounded px-2 py-1"
                        >
                          This time overlaps with an existing workout
                        </p>
                      )}

                      <div className="flex gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleConfirm}
                          disabled={isPending}
                          aria-label="Confirm"
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleCancel}
                          disabled={isPending}
                          aria-label="Cancel"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
