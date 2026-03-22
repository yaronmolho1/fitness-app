'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { NumericInput } from '@/components/ui/numeric-input'
import { getModalityAccentClass } from '@/lib/ui/modality-colors'
import { saveRunningWorkout } from '@/lib/workouts/actions'
import type { SaveRunningWorkoutInput, IntervalRepData } from '@/lib/workouts/actions'
import type { MesocycleInfo, TemplateInfo } from '@/lib/today/queries'
import { SectionHeading } from '@/components/layout/section-heading'
import { formatDateWithWeekday } from '@/lib/date-format'

export type RunningWorkoutData = {
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
}

const runTypeConfig: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  tempo: { label: 'Tempo', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  interval: { label: 'Interval', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  long: { label: 'Long', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  race: { label: 'Race', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
}

function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

export function RunningLoggingForm({ data }: { data: RunningWorkoutData }) {
  const { template } = data
  const config = template.run_type ? runTypeConfig[template.run_type] : null
  const isInterval = template.run_type === 'interval'

  const intervalCount = isInterval && template.interval_count ? template.interval_count : 0

  const [distance, setDistance] = useState('')
  const [pace, setPace] = useState('')
  const [hr, setHr] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Interval rep state — one entry per interval_count
  const [intervalReps, setIntervalReps] = useState<
    Array<{ pace: string; hr: string; notes: string }>
  >(() =>
    Array.from({ length: intervalCount }, () => ({
      pace: '',
      hr: '',
      notes: '',
    }))
  )
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())

  function updateIntervalRep(
    index: number,
    field: 'pace' | 'hr' | 'notes',
    value: string
  ) {
    setIntervalReps((prev) =>
      prev.map((rep, i) => (i === index ? { ...rep, [field]: value } : rep))
    )
  }

  function toggleNotes(index: number) {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  async function handleSave() {
    setError(null)

    // Build interval data if applicable
    let intervalData: IntervalRepData[] | null = null
    if (isInterval && intervalCount > 0) {
      intervalData = intervalReps.map((rep, i) => ({
        rep_number: i + 1,
        interval_pace: rep.pace === '' ? null : rep.pace,
        interval_avg_hr: rep.hr === '' ? null : parseInt(rep.hr, 10),
        interval_notes: rep.notes === '' ? null : rep.notes,
      }))
    }

    const input: SaveRunningWorkoutInput = {
      templateId: template.id,
      logDate: data.date,
      actualDistance: distance === '' ? null : parseFloat(distance),
      actualAvgPace: pace === '' ? null : pace,
      actualAvgHr: hr === '' ? null : parseInt(hr, 10),
      rating,
      notes: notes || null,
      intervalData,
    }

    // Client-side validation for immediate feedback
    if (input.actualDistance !== null && (isNaN(input.actualDistance) || input.actualDistance < 0)) {
      setError('Distance must be a non-negative number')
      return
    }
    if (input.actualAvgHr !== null && (isNaN(input.actualAvgHr) || input.actualAvgHr <= 0)) {
      setError('Average HR must be a positive integer')
      return
    }
    if (intervalData) {
      for (const rep of intervalData) {
        if (rep.interval_avg_hr !== null && (isNaN(rep.interval_avg_hr) || rep.interval_avg_hr <= 0)) {
          setError(`Interval rep ${rep.rep_number}: HR must be a positive integer`)
          return
        }
      }
    }

    startTransition(async () => {
      const result = await saveRunningWorkout(input)
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
        {config && (
          <span
            data-testid="run-type-badge"
            className={cn('mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold', config.color)}
          >
            {config.label}
          </span>
        )}
      </div>

      {/* Planned reference (read-only) */}
      <div data-testid="planned-reference" className={cn('rounded-xl border border-l-4 bg-card p-4 space-y-3', getModalityAccentClass('running'))}>
        <SectionHeading className="mt-0 mb-0 text-sm uppercase tracking-wider text-muted-foreground">
          Planned
        </SectionHeading>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {template.target_distance !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Distance
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {template.target_distance}km
              </div>
            </div>
          )}
          {template.target_duration !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Duration
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {template.target_duration}min
              </div>
            </div>
          )}
          {template.target_pace && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Target Pace
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {template.target_pace}
              </div>
            </div>
          )}
          {template.hr_zone !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                HR Zone
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                Zone {template.hr_zone}
              </div>
            </div>
          )}
          {isInterval && template.interval_count !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Intervals
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {template.interval_count}
              </div>
            </div>
          )}
          {isInterval && template.interval_rest !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Rest
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {formatRest(template.interval_rest)}
              </div>
            </div>
          )}
        </div>

        {template.coaching_cues && (
          <div className="rounded-md bg-green-500/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Coaching Cues
            </p>
            <p className="mt-1 text-sm">{template.coaching_cues}</p>
          </div>
        )}
      </div>

      {/* Actual fields */}
      <div data-testid="actual-fields" className="rounded-xl border bg-card p-4 space-y-4">
        <SectionHeading className="mt-0 mb-0 text-sm uppercase tracking-wider text-muted-foreground">
          Actual
        </SectionHeading>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="actual-distance"
              className="text-sm font-medium"
            >
              Distance (km)
            </label>
            <NumericInput
              id="actual-distance"
              data-testid="actual-distance"
              mode="decimal"
              placeholder="e.g. 8.5"
              value={distance}
              onValueChange={setDistance}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="actual-avg-pace"
              className="text-sm font-medium"
            >
              Avg Pace
            </label>
            <input
              id="actual-avg-pace"
              data-testid="actual-avg-pace"
              type="text"
              placeholder="e.g. 5:45/km"
              value={pace}
              onChange={(e) => setPace(e.target.value)}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="actual-avg-hr"
              className="text-sm font-medium"
            >
              Avg HR (bpm)
            </label>
            <NumericInput
              id="actual-avg-hr"
              data-testid="actual-avg-hr"
              mode="integer"
              placeholder="e.g. 155"
              value={hr}
              onValueChange={setHr}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Interval reps — only for interval runs */}
      {isInterval && intervalCount > 0 && (
        <div data-testid="interval-section" className="rounded-xl border bg-card p-4 space-y-3">
          <SectionHeading className="mt-0 mb-0 text-sm uppercase tracking-wider text-muted-foreground">
            Intervals ({intervalCount})
          </SectionHeading>

          <div className="space-y-3">
            {intervalReps.map((rep, index) => (
              <div
                key={index}
                data-testid={`interval-rep-${index + 1}`}
                className="rounded-lg border bg-muted/30 p-3 space-y-2"
              >
                <div className="text-xs font-semibold text-muted-foreground">
                  Rep {index + 1}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor={`interval-pace-${index + 1}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Pace
                    </label>
                    <input
                      id={`interval-pace-${index + 1}`}
                      data-testid={`interval-pace-${index + 1}`}
                      type="text"
                      placeholder="e.g. 4:55/km"
                      value={rep.pace}
                      onChange={(e) => updateIntervalRep(index, 'pace', e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`interval-hr-${index + 1}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Avg HR
                    </label>
                    <NumericInput
                      id={`interval-hr-${index + 1}`}
                      data-testid={`interval-hr-${index + 1}`}
                      mode="integer"
                      placeholder="bpm"
                      value={rep.hr}
                      onValueChange={(v) => updateIntervalRep(index, 'hr', v)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {/* Notes — collapsed by default */}
                {expandedNotes.has(index) ? (
                  <div className="space-y-1">
                    <label
                      htmlFor={`interval-notes-${index + 1}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Notes
                    </label>
                    <input
                      id={`interval-notes-${index + 1}`}
                      data-testid={`interval-notes-${index + 1}`}
                      type="text"
                      placeholder="How did this rep feel?"
                      value={rep.notes}
                      onChange={(e) => updateIntervalRep(index, 'notes', e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid={`interval-notes-toggle-${index + 1}`}
                    onClick={() => toggleNotes(index)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Add notes
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rating + notes */}
      <div data-testid="rating-notes-section" className="rounded-xl border bg-card p-4 space-y-4">
        <div>
          <span className="text-sm font-medium">Workout Rating</span>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Rate ${value}`}
                aria-pressed={rating === value}
                onClick={() => setRating(rating === value ? null : value)}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                  rating !== null && value <= rating
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:border-primary hover:text-primary'
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={rating !== null && value <= rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="running-notes" className="text-sm font-medium">
            Notes
          </label>
          <textarea
            id="running-notes"
            placeholder="How did the run feel?"
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
          <p className="text-sm font-medium text-primary">Run logged!</p>
        </div>
      )}

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-4 safe-area-pb">
        <button
          type="button"
          data-testid="save-running-btn"
          disabled={isPending || saved}
          onClick={handleSave}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-all hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save Run'}
        </button>
      </div>
    </div>
  )
}
