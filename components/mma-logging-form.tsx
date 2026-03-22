'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { NumericInput } from '@/components/ui/numeric-input'
import { getModalityAccentClass } from '@/lib/ui/modality-colors'
import { saveMmaWorkout } from '@/lib/workouts/actions'
import type { SaveMmaWorkoutInput } from '@/lib/workouts/actions'
import type { MesocycleInfo, TemplateInfo } from '@/lib/today/queries'
import { SectionHeading } from '@/components/layout/section-heading'
import { formatDateWithWeekday } from '@/lib/date-format'

export type MmaWorkoutData = {
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
}

export function MmaLoggingForm({ data }: { data: MmaWorkoutData }) {
  const { template } = data

  const [duration, setDuration] = useState('')
  const [feeling, setFeeling] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setError(null)

    const parsedDuration = duration === '' ? null : parseInt(duration, 10)

    // Client-side validation
    if (parsedDuration !== null && (isNaN(parsedDuration) || parsedDuration <= 0)) {
      setError('Duration must be a positive integer (minutes)')
      return
    }

    const input: SaveMmaWorkoutInput = {
      templateId: template.id,
      logDate: data.date,
      actualDurationMinutes: parsedDuration,
      feeling,
      notes: notes || null,
    }

    startTransition(async () => {
      const result = await saveMmaWorkout(input)
      if (result.success) {
        setSaved(true)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {data.mesocycle.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDateWithWeekday(data.date)}
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          {template.name}
        </h1>
        <span
          data-testid="mma-badge"
          className="mt-2 inline-block rounded-full bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-700 dark:text-rose-400"
        >
          MMA / BJJ
        </span>
      </div>

      {/* Planned reference (read-only) */}
      <div data-testid="planned-reference" className={cn('rounded-xl border border-l-4 bg-card p-4 space-y-3', getModalityAccentClass('mma'))}>
        <SectionHeading className="mt-0 mb-0 text-sm uppercase tracking-wider text-muted-foreground">
          Planned
        </SectionHeading>

        <div className="grid grid-cols-2 gap-3">
          {template.planned_duration !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Duration
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {template.planned_duration} min
              </div>
            </div>
          )}
        </div>

        {!template.planned_duration && (
          <p className="text-sm text-muted-foreground">No planned duration set</p>
        )}
      </div>

      {/* Actual fields */}
      <div data-testid="actual-fields" className="rounded-xl border bg-card p-4 space-y-4">
        <SectionHeading className="mt-0 mb-0 text-sm uppercase tracking-wider text-muted-foreground">
          Actual
        </SectionHeading>

        <div className="space-y-1.5">
          <label
            htmlFor="actual-duration"
            className="text-sm font-medium"
          >
            Duration (minutes)
          </label>
          <NumericInput
            id="actual-duration"
            data-testid="actual-duration"
            mode="integer"
            placeholder="e.g. 90"
            value={duration}
            onValueChange={setDuration}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
          />
        </div>
      </div>

      {/* Feeling + notes */}
      <div data-testid="feeling-notes-section" className="rounded-xl border bg-card p-4 space-y-4">
        <div>
          <span className="text-sm font-medium">Session Feeling</span>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Rate ${value}`}
                aria-pressed={feeling === value}
                onClick={() => setFeeling(feeling === value ? null : value)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                  feeling !== null && value <= feeling
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:border-primary hover:text-primary'
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={feeling !== null && value <= feeling ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="mma-notes" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="mma-notes"
            placeholder="How did the session feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div data-testid="save-error" className="rounded-xl border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div data-testid="save-success" className="rounded-xl border border-primary bg-primary/10 p-4">
          <p className="text-sm font-medium text-primary">Session logged!</p>
        </div>
      )}

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-4 safe-area-pb">
        <button
          type="button"
          data-testid="save-mma-btn"
          disabled={isPending || saved}
          onClick={handleSave}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-all hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save Session'}
        </button>
      </div>
    </div>
  )
}
