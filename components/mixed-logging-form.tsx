'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { NumericInput } from '@/components/ui/numeric-input'
import { getModalityAccentClass, getModalityBadgeClasses } from '@/lib/ui/modality-colors'
import { saveMixedWorkout } from '@/lib/workouts/actions'
import type { SaveMixedWorkoutInput, MixedSectionInput } from '@/lib/workouts/save-mixed-workout'
import type { MesocycleInfo, TemplateInfo, SectionData, SlotData } from '@/lib/today/queries'
import { SectionHeading } from '@/components/layout/section-heading'
import { formatDateWithWeekday } from '@/lib/date-format'
import { useLogAsPlanned } from '@/lib/use-log-as-planned'
import { parseRepsLowerBound, isRepsRange } from '@/lib/reps-parsing'

export type MixedWorkoutData = {
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
  sections: SectionData[]
}

type SetFormData = {
  weight: string
  reps: string
}

// Per-section state for running
type RunningSectionState = {
  distance: string
  pace: string
  hr: string
}

// Per-section state for MMA
type MmaSectionState = {
  duration: string
  feeling: number | null
}

const MODALITY_LABELS: Record<string, string> = {
  resistance: 'Resistance',
  running: 'Running',
  mma: 'MMA',
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

// Resistance section logging (embedded, reusing the same input pattern as workout-logging-form)
function ResistanceSectionInputs({
  sectionIndex,
  resistanceIdx,
  slots,
  sets,
  exerciseRpe,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
  onUpdateRpe,
  onResetToPlanned,
  set1Edited,
  onCopyDown,
}: {
  sectionIndex: number
  resistanceIdx: number
  slots: SlotData[]
  sets: SetFormData[][]
  exerciseRpe: (number | null)[]
  onUpdateSet: (slotIndex: number, setIndex: number, field: keyof SetFormData, value: string) => void
  onAddSet: (slotIndex: number) => void
  onRemoveSet: (slotIndex: number, setIndex: number) => void
  onUpdateRpe: (slotIndex: number, value: number | null) => void
  onResetToPlanned: (slotIndex: number) => void
  set1Edited: boolean[]
  onCopyDown: (slotIndex: number) => void
}) {
  return (
    <div className="space-y-3">
      {slots.map((slot, slotIndex) => (
        <div
          key={slot.id}
          data-testid="exercise-section"
          className={cn(
            'rounded-xl border bg-card overflow-hidden',
            slot.is_main
              ? 'border-l-4 border-l-primary'
              : 'border-l-4 border-l-muted'
          )}
        >
          {/* Exercise header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
            <h3 className="text-base font-semibold leading-tight">
              {slot.exercise_name}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid={`as-planned-resistance-${resistanceIdx}-${slotIndex}`}
                onClick={() => onResetToPlanned(slotIndex)}
                className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
              >
                As Planned
              </button>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  slot.is_main
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {slot.is_main ? 'Main' : 'Complementary'}
              </span>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 px-4 pb-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">
              Set
            </div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">
              Weight
            </div>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">
              Reps
            </div>
            <div />
          </div>

          {/* Set rows */}
          <div className="space-y-1.5 px-4 pb-2">
            {sets[slotIndex]?.map((setData, setIndex) => (
              <div key={setIndex}>
                <div
                  data-testid="set-row"
                  className="grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 items-center"
                >
                  <div
                    data-testid="set-number-label"
                    className="flex min-h-[44px] items-center justify-center text-sm font-bold tabular-nums text-muted-foreground"
                  >
                    {setIndex + 1}
                  </div>

                  <NumericInput
                    data-testid={`weight-input-${sectionIndex}-${slotIndex}-${setIndex}`}
                    aria-label={`Actual weight for set ${setIndex + 1}`}
                    mode="decimal"
                    placeholder={slot.weight !== null ? String(slot.weight) : '\u2014'}
                    value={setData.weight}
                    onValueChange={(v) =>
                      onUpdateSet(slotIndex, setIndex, 'weight', v)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-input bg-background px-3 text-center text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />

                  <NumericInput
                    data-testid={`reps-input-${sectionIndex}-${slotIndex}-${setIndex}`}
                    aria-label={`Actual reps for set ${setIndex + 1}`}
                    mode="integer"
                    placeholder={slot.reps || '\u2014'}
                    value={setData.reps}
                    onValueChange={(v) =>
                      onUpdateSet(slotIndex, setIndex, 'reps', v)
                    }
                    className="min-h-[44px] w-full rounded-lg border border-input bg-background px-3 text-center text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />

                  <button
                    type="button"
                    aria-label={`Remove set ${setIndex + 1}`}
                    disabled={sets[slotIndex].length <= 1}
                    onClick={() => onRemoveSet(slotIndex, setIndex)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Copy-down button: after set 1, when 2+ sets and set 1 edited */}
                {setIndex === 0 && (sets[slotIndex]?.length ?? 0) >= 2 && set1Edited[slotIndex] && (
                  <div className="flex justify-end mt-1 mb-0.5">
                    <button
                      type="button"
                      data-testid={`copy-down-resistance-${resistanceIdx}-${slotIndex}`}
                      onClick={() => onCopyDown(slotIndex)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
                    >
                      Copy down
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add set */}
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={() => onAddSet(slotIndex)}
              className="w-full min-h-[44px] rounded-lg border border-dashed border-muted-foreground/30 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.98]"
            >
              + Add Set
            </button>
          </div>

          {/* RPE selector */}
          <div className="border-t px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                RPE {slot.rpe !== null && <span className="text-[10px]">(plan: {slot.rpe})</span>}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                const isSelected = exerciseRpe[slotIndex] === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`RPE ${value}`}
                    aria-pressed={isSelected}
                    onClick={() => onUpdateRpe(slotIndex, isSelected ? null : value)}
                    className={cn(
                      'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors active:scale-95',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background text-muted-foreground hover:border-primary hover:text-primary'
                    )}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Running section logging (embedded, reusing the same input pattern as running-logging-form)
function RunningSectionInputs({
  sectionIndex,
  runningIdx,
  section,
  state,
  onUpdate,
  onResetToPlanned,
}: {
  sectionIndex: number
  runningIdx: number
  section: SectionData
  state: RunningSectionState
  onUpdate: (field: keyof RunningSectionState, value: string) => void
  onResetToPlanned: () => void
}) {
  const config = section.run_type ? runTypeConfig[section.run_type] : null
  const isInterval = section.run_type === 'interval'

  return (
    <div className="space-y-3">
      {/* Planned reference */}
      <div className={cn('rounded-xl border border-l-4 bg-card p-4 space-y-3', getModalityAccentClass('running'))}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Planned
        </h3>
        {config && (
          <span className={cn('inline-block rounded-full px-3 py-1 text-sm font-semibold', config.color)}>
            {config.label}
          </span>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {section.target_pace && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Target Pace</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{section.target_pace}</div>
            </div>
          )}
          {section.hr_zone !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">HR Zone</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">Zone {section.hr_zone}</div>
            </div>
          )}
          {isInterval && section.interval_count !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Intervals</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{section.interval_count}</div>
            </div>
          )}
          {isInterval && section.interval_rest !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Rest</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">{formatRest(section.interval_rest)}</div>
            </div>
          )}
        </div>
        {section.coaching_cues && (
          <div className="rounded-md bg-green-500/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Coaching Cues</p>
            <p className="mt-1 text-sm">{section.coaching_cues}</p>
          </div>
        )}
      </div>

      {/* Actual fields */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Actual
          </h3>
          <button
            type="button"
            data-testid={`as-planned-running-${runningIdx}`}
            onClick={onResetToPlanned}
            className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
          >
            As Planned
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor={`actual-distance-${sectionIndex}`} className="text-sm font-medium">
              Distance (km)
            </label>
            <NumericInput
              id={`actual-distance-${sectionIndex}`}
              data-testid={`actual-distance-${sectionIndex}`}
              mode="decimal"
              placeholder="e.g. 8.5"
              value={state.distance}
              onValueChange={(v) => onUpdate('distance', v)}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`actual-avg-pace-${sectionIndex}`} className="text-sm font-medium">
              Avg Pace
            </label>
            <input
              id={`actual-avg-pace-${sectionIndex}`}
              data-testid={`actual-avg-pace-${sectionIndex}`}
              type="text"
              placeholder="e.g. 5:45/km"
              value={state.pace}
              onChange={(e) => onUpdate('pace', e.target.value)}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`actual-avg-hr-${sectionIndex}`} className="text-sm font-medium">
              Avg HR (bpm)
            </label>
            <NumericInput
              id={`actual-avg-hr-${sectionIndex}`}
              data-testid={`actual-avg-hr-${sectionIndex}`}
              mode="integer"
              placeholder="e.g. 155"
              value={state.hr}
              onValueChange={(v) => onUpdate('hr', v)}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// MMA section logging (embedded, reusing the same input pattern as mma-logging-form)
function MmaSectionInputs({
  sectionIndex,
  mmaIdx,
  section,
  state,
  onUpdate,
  onResetToPlanned,
}: {
  sectionIndex: number
  mmaIdx: number
  section: SectionData
  state: MmaSectionState
  onUpdate: (field: 'duration' | 'feeling', value: string | number | null) => void
  onResetToPlanned: () => void
}) {
  return (
    <div className="space-y-3">
      {/* Planned reference */}
      <div className={cn('rounded-xl border border-l-4 bg-card p-4 space-y-3', getModalityAccentClass('mma'))}>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Planned
        </h3>
        {section.planned_duration !== null && (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center inline-block">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Duration</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums">{section.planned_duration} min</div>
          </div>
        )}
        {section.planned_duration === null && (
          <p className="text-sm text-muted-foreground">No planned duration set</p>
        )}
      </div>

      {/* Actual fields */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Actual
          </h3>
          <button
            type="button"
            data-testid={`as-planned-mma-${mmaIdx}`}
            onClick={onResetToPlanned}
            className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95"
          >
            As Planned
          </button>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`actual-duration-${sectionIndex}`} className="text-sm font-medium">
            Duration (minutes)
          </label>
          <NumericInput
            id={`actual-duration-${sectionIndex}`}
            data-testid={`actual-duration-${sectionIndex}`}
            mode="integer"
            placeholder="e.g. 90"
            value={state.duration}
            onValueChange={(v) => onUpdate('duration', v)}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"
          />
        </div>
      </div>

      {/* Feeling selector */}
      <div className="rounded-xl border bg-card p-4">
        <span className="text-sm font-medium">Session Feeling</span>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Feeling ${value}`}
              aria-pressed={state.feeling === value}
              onClick={() => onUpdate('feeling', state.feeling === value ? null : value)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                state.feeling !== null && value <= state.feeling
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-muted-foreground hover:border-primary hover:text-primary'
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={state.feeling !== null && value <= state.feeling ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MixedLoggingForm({ data, onSaveSuccess }: { data: MixedWorkoutData; onSaveSuccess?: () => void }) {
  const sections = [...data.sections].sort((a, b) => a.order - b.order)

  // State per section: resistance has sets + rpe, running has distance/pace/hr, mma has duration/feeling
  const [resistanceState, setResistanceState] = useState(() => {
    const state: { sets: SetFormData[][]; rpe: (number | null)[]; set1Edited: boolean[]; initialSet1: SetFormData[] }[] = []
    for (const section of sections) {
      if (section.modality === 'resistance') {
        const slots = [...(section.slots ?? [])].sort((a, b) => a.order - b.order)
        const initialSets = slots.map((slot) =>
          Array.from({ length: slot.sets }, () => ({ weight: '', reps: '' }))
        )
        state.push({
          sets: initialSets,
          rpe: slots.map(() => null),
          set1Edited: slots.map(() => false),
          initialSet1: initialSets.map((s) => ({ ...s[0] })),
        })
      }
    }
    return state
  })

  const [runningState, setRunningState] = useState<RunningSectionState[]>(() => {
    return sections
      .filter((s) => s.modality === 'running')
      .map((s) => ({
        distance: s.target_distance !== null ? String(s.target_distance) : '',
        pace: s.target_pace ?? '',
        hr: '',
      }))
  })

  const [mmaState, setMmaState] = useState<MmaSectionState[]>(() => {
    return sections
      .filter((s) => s.modality === 'mma')
      .map((s) => ({
        duration: s.planned_duration !== null ? String(s.planned_duration) : '',
        feeling: null,
      }))
  })

  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const hasSections = sections.length > 0
  const { showButton: showLogAsPlanned, markModified, handleLogAsPlanned } = useLogAsPlanned({ saved })

  // Track index offsets for each modality across sections
  let resistanceIdx = 0
  let runningIdx = 0
  let mmaIdx = 0

  function handleSave() {
    setError(null)

    let rIdx = 0
    let ruIdx = 0
    let mIdx = 0

    const sectionInputs: MixedSectionInput[] = sections.map((section) => {
      if (section.modality === 'resistance') {
        const idx = rIdx++
        const slots = [...(section.slots ?? [])].sort((a, b) => a.order - b.order)
        const state = resistanceState[idx]
        return {
          sectionId: section.id,
          modality: 'resistance' as const,
          exercises: slots.map((slot, slotIndex) => ({
            slotId: slot.id,
            exerciseId: slot.exercise_id,
            exerciseName: slot.exercise_name,
            order: slot.order,
            rpe: state.rpe[slotIndex],
            sets: (state.sets[slotIndex] ?? []).map((s) => ({
              reps: s.reps === '' || isNaN(parseInt(s.reps, 10)) ? null : parseInt(s.reps, 10),
              weight: s.weight === '' || isNaN(parseFloat(s.weight)) ? null : parseFloat(s.weight),
            })),
          })),
        }
      }

      if (section.modality === 'running') {
        const idx = ruIdx++
        const s = runningState[idx]
        return {
          sectionId: section.id,
          modality: 'running' as const,
          actualDistance: s.distance === '' || isNaN(parseFloat(s.distance)) ? null : parseFloat(s.distance),
          actualAvgPace: s.pace === '' ? null : s.pace,
          actualAvgHr: s.hr === '' || isNaN(parseInt(s.hr, 10)) ? null : parseInt(s.hr, 10),
        }
      }

      // mma
      const idx = mIdx++
      const s = mmaState[idx]
      return {
        sectionId: section.id,
        modality: 'mma' as const,
        actualDurationMinutes: s.duration === '' || isNaN(parseInt(s.duration, 10)) ? null : parseInt(s.duration, 10),
        feeling: s.feeling,
      }
    })

    const input: SaveMixedWorkoutInput = {
      templateId: data.template.id,
      logDate: data.date,
      sections: sectionInputs,
      rating,
      notes: notes || null,
    }

    startTransition(async () => {
      const result = await saveMixedWorkout(input)
      if (result.success) {
        setSaved(true)
        onSaveSuccess?.()
      } else {
        setError(result.error)
      }
    })
  }

  // Reset modality indices for rendering
  resistanceIdx = 0
  runningIdx = 0
  mmaIdx = 0

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
          {data.template.name}
        </h1>
      </div>

      {/* Log as Planned button */}
      {hasSections && showLogAsPlanned && (
        <button
          type="button"
          data-testid="log-as-planned-btn"
          onClick={handleLogAsPlanned}
          className="w-full rounded-xl border-2 border-primary/30 bg-primary/5 py-3 text-base font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.98]"
        >
          Log as Planned
        </button>
      )}

      {/* Sections */}
      {sections.map((section, sectionIndex) => {
        let content: React.ReactNode = null

        if (section.modality === 'resistance') {
          const idx = resistanceIdx++
          const slots = [...(section.slots ?? [])].sort((a, b) => a.order - b.order)
          const state = resistanceState[idx]

          content = (
            <ResistanceSectionInputs
              sectionIndex={sectionIndex}
              resistanceIdx={idx}
              slots={slots}
              sets={state.sets}
              exerciseRpe={state.rpe}
              onResetToPlanned={(slotIndex) => {
                const slot = slots[slotIndex]
                const weight = slot.weight != null && slot.weight !== 0 ? String(slot.weight) : ''
                const lowerBound = parseRepsLowerBound(slot.reps)
                const reps = lowerBound !== null ? String(lowerBound) : ''
                setResistanceState((prev) => {
                  const next = [...prev]
                  const sectionState = { ...next[idx] }
                  sectionState.sets = sectionState.sets.map((s) => s.map((r) => ({ ...r })))
                  sectionState.sets[slotIndex] = Array.from({ length: slot.sets }, () => ({ weight, reps }))
                  next[idx] = sectionState
                  return next
                })
              }}
              set1Edited={state.set1Edited}
              onCopyDown={(slotIndex) => {
                setResistanceState((prev) => {
                  const next = [...prev]
                  const sectionState = { ...next[idx] }
                  sectionState.sets = sectionState.sets.map((s) => s.map((r) => ({ ...r })))
                  const source = sectionState.sets[slotIndex][0]
                  for (let i = 1; i < sectionState.sets[slotIndex].length; i++) {
                    sectionState.sets[slotIndex][i] = { weight: source.weight, reps: source.reps }
                  }
                  next[idx] = sectionState
                  return next
                })
              }}
              onUpdateSet={(slotIndex, setIndex, field, value) => {
                markModified()
                setResistanceState((prev) => {
                  const next = [...prev]
                  const sectionState = { ...next[idx] }
                  sectionState.sets = sectionState.sets.map((s) => s.map((r) => ({ ...r })))
                  sectionState.sets[slotIndex][setIndex][field] = value
                  // Track set-1 edits for copy-down
                  if (setIndex === 0) {
                    const initVal = sectionState.initialSet1[slotIndex]
                    const updated = { ...sectionState.sets[slotIndex][0], [field]: value }
                    if (updated.weight !== initVal.weight || updated.reps !== initVal.reps) {
                      sectionState.set1Edited = [...sectionState.set1Edited]
                      sectionState.set1Edited[slotIndex] = true
                    }
                  }
                  next[idx] = sectionState
                  return next
                })
              }}
              onAddSet={(slotIndex) => {
                setResistanceState((prev) => {
                  const next = [...prev]
                  const sectionState = { ...next[idx] }
                  sectionState.sets = sectionState.sets.map((s) => s.map((r) => ({ ...r })))
                  const slotSets = sectionState.sets[slotIndex]
                  const last = slotSets[slotSets.length - 1]
                  const newSet: SetFormData = last
                    ? { weight: last.weight, reps: last.reps }
                    : { weight: '', reps: '' }
                  sectionState.sets[slotIndex] = [...slotSets, newSet]
                  next[idx] = sectionState
                  return next
                })
              }}
              onRemoveSet={(slotIndex, setIndex) => {
                setResistanceState((prev) => {
                  const next = [...prev]
                  const sectionState = { ...next[idx] }
                  sectionState.sets = sectionState.sets.map((s) => s.map((r) => ({ ...r })))
                  if (sectionState.sets[slotIndex].length <= 1) return prev
                  sectionState.sets[slotIndex] = sectionState.sets[slotIndex].filter((_, i) => i !== setIndex)
                  next[idx] = sectionState
                  return next
                })
              }}
              onUpdateRpe={(slotIndex, value) => {
                setResistanceState((prev) => {
                  const next = [...prev]
                  const sectionState = { ...next[idx] }
                  sectionState.rpe = [...sectionState.rpe]
                  sectionState.rpe[slotIndex] = value
                  next[idx] = sectionState
                  return next
                })
              }}
            />
          )
        } else if (section.modality === 'running') {
          const idx = runningIdx++
          content = (
            <RunningSectionInputs
              sectionIndex={sectionIndex}
              runningIdx={idx}
              section={section}
              state={runningState[idx]}
              onUpdate={(field, value) => {
                markModified()
                setRunningState((prev) => {
                  const next = [...prev]
                  next[idx] = { ...next[idx], [field]: value }
                  return next
                })
              }}
              onResetToPlanned={() => {
                setRunningState((prev) => {
                  const next = [...prev]
                  next[idx] = {
                    ...next[idx],
                    distance: section.target_distance !== null ? String(section.target_distance) : '',
                    pace: section.target_pace ?? '',
                  }
                  return next
                })
              }}
            />
          )
        } else if (section.modality === 'mma') {
          const idx = mmaIdx++
          content = (
            <MmaSectionInputs
              sectionIndex={sectionIndex}
              mmaIdx={idx}
              section={section}
              state={mmaState[idx]}
              onUpdate={(field, value) => {
                markModified()
                setMmaState((prev) => {
                  const next = [...prev]
                  if (field === 'duration') {
                    next[idx] = { ...next[idx], duration: value as string }
                  } else {
                    next[idx] = { ...next[idx], feeling: value as number | null }
                  }
                  return next
                })
              }}
              onResetToPlanned={() => {
                setMmaState((prev) => {
                  const next = [...prev]
                  next[idx] = {
                    ...next[idx],
                    duration: section.planned_duration !== null ? String(section.planned_duration) : '',
                  }
                  return next
                })
              }}
            />
          )
        }

        return (
          <div key={section.id}>
            {sectionIndex > 0 && (
              <div className="my-6 border-t border-border" />
            )}
            <div data-testid="mixed-section-header" className="mb-3 flex items-center gap-2">
              <SectionHeading className="mt-0 mb-0">{section.section_name}</SectionHeading>
              <span
                data-testid="mixed-section-modality"
                className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', getModalityBadgeClasses(section.modality))}
              >
                {MODALITY_LABELS[section.modality] ?? section.modality}
              </span>
            </div>
            {content}
          </div>
        )
      })}

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
                  'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border transition-colors',
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
          <label htmlFor="mixed-notes" className="text-sm font-medium">
            Workout Notes
          </label>
          <textarea
            id="mixed-notes"
            placeholder="How did the workout feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div data-testid="save-error" className="rounded-xl border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Success */}
      {saved && (
        <div data-testid="save-success" className="rounded-xl border border-primary bg-primary/10 p-4">
          <p className="text-sm font-medium text-primary">Workout saved!</p>
        </div>
      )}

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-4 safe-area-pb">
        <button
          type="button"
          data-testid="save-mixed-btn"
          disabled={isPending || saved}
          onClick={handleSave}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-all hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Save Workout'}
        </button>
      </div>
    </div>
  )
}
