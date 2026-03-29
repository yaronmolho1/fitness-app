'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { NumericInput } from '@/components/ui/numeric-input'
import { SectionHeading } from '@/components/layout/section-heading'
import { groupSlotsByGroupId, getGroupLabel, formatRest as formatRestSeconds } from '@/lib/ui/superset-grouping'
import { formatDateWithWeekday } from '@/lib/date-format'
import { saveWorkout } from '@/lib/workouts/actions'
import type { SaveWorkoutInput } from '@/lib/workouts/actions'
import { parseRepsLowerBound, isRepsRange } from '@/lib/reps-parsing'
import { useLogAsPlanned } from '@/lib/use-log-as-planned'

export type SlotData = {
  id: number
  exercise_id: number
  exercise_name: string
  sets: number
  reps: string
  weight: number | null
  rpe: number | null
  rest_seconds: number | null
  group_id: number | null
  group_rest_seconds: number | null
  guidelines: string | null
  order: number
  is_main: boolean
}

export type WorkoutData = {
  date: string
  mesocycle: {
    id: number
    name: string
    start_date: string
    end_date: string
    week_type: 'normal' | 'deload'
  }
  template: {
    id: number
    name: string
    modality: string
    notes: string | null
  }
  slots: SlotData[]
}

type SetFormData = {
  weight: string
  reps: string
}

function buildInitialSets(slots: SlotData[]): SetFormData[][] {
  return slots.map((slot) => {
    const weight = slot.weight != null && slot.weight !== 0 ? String(slot.weight) : ''
    const lowerBound = parseRepsLowerBound(slot.reps)
    const reps = lowerBound !== null ? String(lowerBound) : ''
    return Array.from({ length: slot.sets }, () => ({ weight, reps }))
  })
}

export function WorkoutLoggingForm({ data, onSaveSuccess }: { data: WorkoutData; onSaveSuccess?: () => void }) {
  const sortedSlots = [...data.slots].sort((a, b) => a.order - b.order)
  const [sets, setSets] = useState<SetFormData[][]>(() =>
    buildInitialSets(sortedSlots)
  )
  const [exerciseRpe, setExerciseRpe] = useState<(number | null)[]>(() =>
    sortedSlots.map(() => null)
  )
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const hasSlots = sortedSlots.length > 0
  const { showButton: showLogAsPlanned, markModified, handleLogAsPlanned } = useLogAsPlanned({ saved })

  async function handleSave() {
    setError(null)
    const input: SaveWorkoutInput = {
      templateId: data.template.id,
      logDate: data.date,
      exercises: sortedSlots.map((slot, slotIndex) => ({
        slotId: slot.id,
        exerciseId: slot.exercise_id,
        exerciseName: slot.exercise_name,
        order: slot.order,
        rpe: exerciseRpe[slotIndex],
        sets: (sets[slotIndex] ?? []).map((s) => ({
          reps: s.reps === '' ? null : parseInt(s.reps, 10),
          weight: s.weight === '' ? null : parseFloat(s.weight),
        })),
      })),
      rating,
      notes: notes || null,
    }

    startTransition(async () => {
      const result = await saveWorkout(input)
      if (result.success) {
        setSaved(true)
        onSaveSuccess?.()
      } else {
        setError(result.error)
      }
    })
  }

  function updateSet(
    slotIndex: number,
    setIndex: number,
    field: keyof SetFormData,
    value: string
  ) {
    markModified()
    setSets((prev) => {
      const next = prev.map((s) => s.map((r) => ({ ...r })))
      next[slotIndex][setIndex][field] = value
      return next
    })
  }

  function resetToPlanned(slotIndex: number) {
    const slot = sortedSlots[slotIndex]
    const weight = slot.weight != null && slot.weight !== 0 ? String(slot.weight) : ''
    const lowerBound = parseRepsLowerBound(slot.reps)
    const reps = lowerBound !== null ? String(lowerBound) : ''
    setSets((prev) => {
      const next = prev.map((s) => s.map((r) => ({ ...r })))
      next[slotIndex] = Array.from({ length: slot.sets }, () => ({ weight, reps }))
      return next
    })
  }

  function addSet(slotIndex: number) {
    setSets((prev) => {
      const next = prev.map((s) => s.map((r) => ({ ...r })))
      const slotSets = next[slotIndex]
      const last = slotSets[slotSets.length - 1]
      const newSet: SetFormData = last
        ? { weight: last.weight, reps: last.reps }
        : { weight: '', reps: '' }
      next[slotIndex] = [...slotSets, newSet]
      return next
    })
  }

  function removeSet(slotIndex: number, setIndex: number) {
    setSets((prev) => {
      const next = prev.map((s) => s.map((r) => ({ ...r })))
      if (next[slotIndex].length <= 1) return prev
      next[slotIndex] = next[slotIndex].filter((_, i) => i !== setIndex)
      return next
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
          {data.template.name}
        </h1>
      </div>

      {/* Log as Planned button */}
      {hasSlots && showLogAsPlanned && (
        <button
          type="button"
          data-testid="log-as-planned-btn"
          onClick={handleLogAsPlanned}
          className="w-full rounded-xl border-2 border-primary/30 bg-primary/5 py-3 text-base font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.98]"
        >
          Log as Planned
        </button>
      )}

      {/* Exercise sections */}
      {sortedSlots.length > 0 ? (
        (() => {
          // Build slot-id to index map for state lookups
          const slotIndexMap = new Map(sortedSlots.map((s, i) => [s.id, i]))
          const grouped = groupSlotsByGroupId(sortedSlots)

          function renderExerciseSection(slot: SlotData) {
            const slotIndex = slotIndexMap.get(slot.id)!
            return (
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
                  <SectionHeading className="mt-0 mb-0 text-base leading-tight">
                    {slot.exercise_name}
                  </SectionHeading>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid={`as-planned-btn-${slotIndex}`}
                      onClick={() => resetToPlanned(slotIndex)}
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
                    <div
                      key={setIndex}
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
                        data-testid={`weight-input-${slotIndex}-${setIndex}`}
                        aria-label={`Actual weight for set ${setIndex + 1}`}
                        mode="decimal"
                        value={setData.weight}
                        onValueChange={(v) =>
                          updateSet(slotIndex, setIndex, 'weight', v)
                        }
                        className="min-h-[44px] w-full rounded-lg border border-input bg-background px-3 text-center text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />

                      <div>
                        <NumericInput
                          data-testid={`reps-input-${slotIndex}-${setIndex}`}
                          aria-label={`Actual reps for set ${setIndex + 1}`}
                          mode="integer"
                          value={setData.reps}
                          onValueChange={(v) =>
                            updateSet(slotIndex, setIndex, 'reps', v)
                          }
                          className="min-h-[44px] w-full rounded-lg border border-input bg-background px-3 text-center text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {(isRepsRange(slot.reps) || (parseRepsLowerBound(slot.reps) === null && slot.reps !== '')) && (
                          <span className="block text-center text-[10px] text-muted-foreground mt-0.5">
                            Target: {slot.reps}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label={`Remove set ${setIndex + 1}`}
                        disabled={sets[slotIndex].length <= 1}
                        onClick={() => removeSet(slotIndex, setIndex)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add set */}
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => addSet(slotIndex)}
                    className="w-full min-h-[44px] rounded-lg border border-dashed border-muted-foreground/30 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.98]"
                  >
                    + Add Set
                  </button>
                </div>

                {/* Per-exercise RPE selector */}
                <div className="border-t px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      RPE {slot.rpe !== null && <span className="text-[10px]">(plan: {slot.rpe})</span>}
                    </span>
                  </div>
                  <div
                    data-testid={`rpe-selector-${slotIndex}`}
                    className="flex flex-wrap gap-1.5"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => {
                      const isSelected = exerciseRpe[slotIndex] === value
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-label={`RPE ${value}`}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setExerciseRpe((prev) => {
                              const next = [...prev]
                              next[slotIndex] = isSelected ? null : value
                              return next
                            })
                          }}
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
            )
          }

          return grouped.map((item) => {
            if (item.type === 'group') {
              return (
                <div
                  key={`group-${item.groupId}`}
                  data-testid="superset-group"
                  className="rounded-xl border-l-4 border-l-primary border border-border pl-3 py-2 pr-2 space-y-2"
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-semibold text-primary">{getGroupLabel(item.slots.length)}</span>
                  </div>
                  <div className="space-y-3">
                    {item.slots.map((slot) => renderExerciseSection(slot))}
                  </div>
                  {item.groupRestSeconds > 0 && (
                    <div className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground">
                      <span>Group rest:</span>
                      <span className="font-semibold tabular-nums">{formatRestSeconds(item.groupRestSeconds)}</span>
                    </div>
                  )}
                </div>
              )
            }
            return renderExerciseSection(item.slot)
          })
        })()
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No exercises configured for this template yet.
          </p>
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
          <label htmlFor="workout-notes" className="text-sm font-medium">
            Workout Notes
          </label>
          <textarea
            id="workout-notes"
            placeholder="How did the workout feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div className="rounded-xl border border-primary bg-primary/10 p-4">
          <p className="text-sm font-medium text-primary">Workout saved!</p>
        </div>
      )}

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-4 safe-area-pb">
        <button
          type="button"
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
