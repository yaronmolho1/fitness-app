'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  upsertWeekOverrideAction,
  deleteWeekOverrideAction,
  getWeekOverridesAction,
} from '@/lib/progression/actions'
import { computeDeloadDefaults } from '@/lib/progression/week-overrides'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

type OverrideRow = Awaited<ReturnType<typeof getWeekOverridesAction>>[number]

type RunningBase = {
  distance: number | null
  duration: number | null
  pace: string | null
}

type WeekProgressionGridProps = {
  slot: SlotWithExercise
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  modality?: 'resistance' | 'running'
  runningBase?: RunningBase
}

type ResistanceValues = {
  weight: string
  reps: string
  sets: string
  rpe: string
  duration: string
}

type RunningValues = {
  distance: string
  duration: string
  pace: string
}

type WeekState = {
  weekNumber: number
  isDeload: boolean
  resistance: ResistanceValues
  running: RunningValues
  hasOverride: boolean
}

function buildResistanceBase(slot: SlotWithExercise): ResistanceValues {
  return {
    weight: slot.weight != null ? String(slot.weight) : '',
    reps: String(slot.reps),
    sets: String(slot.sets),
    rpe: slot.rpe != null ? String(slot.rpe) : '',
    duration: slot.duration != null ? String(slot.duration) : '',
  }
}

function buildRunningBase(base?: RunningBase): RunningValues {
  return {
    distance: base?.distance != null ? String(base.distance) : '',
    duration: base?.duration != null ? String(base.duration) : '',
    pace: base?.pace ?? '',
  }
}

function buildDeloadResistance(slot: SlotWithExercise): ResistanceValues {
  const defaults = computeDeloadDefaults({
    weight: slot.weight,
    sets: slot.sets,
    rpe: slot.rpe,
  })
  return {
    weight: defaults.weight != null ? String(defaults.weight) : '',
    reps: String(slot.reps), // 100% preserved
    sets: String(defaults.sets),
    rpe: defaults.rpe != null ? String(defaults.rpe) : '',
    duration: slot.duration != null ? String(slot.duration) : '', // 100% preserved on deload
  }
}

function initWeeks(
  workWeeks: number,
  hasDeload: boolean,
  slot: SlotWithExercise,
  runningBase?: RunningBase
): WeekState[] {
  const weeks: WeekState[] = []

  for (let w = 1; w <= workWeeks; w++) {
    weeks.push({
      weekNumber: w,
      isDeload: false,
      resistance: buildResistanceBase(slot),
      running: buildRunningBase(runningBase),
      hasOverride: false,
    })
  }

  if (hasDeload) {
    weeks.push({
      weekNumber: workWeeks + 1,
      isDeload: true,
      resistance: buildDeloadResistance(slot),
      running: buildRunningBase(runningBase),
      hasOverride: false,
    })
  }

  return weeks
}

function applyOverrides(
  weeks: WeekState[],
  overrides: OverrideRow[],
  modality: 'resistance' | 'running'
): WeekState[] {
  const overrideMap = new Map(overrides.map((o) => [o.week_number, o]))
  return weeks.map((w) => {
    const ov = overrideMap.get(w.weekNumber)
    if (!ov) return w

    if (modality === 'running') {
      return {
        ...w,
        hasOverride: true,
        running: {
          distance: ov.distance != null ? String(ov.distance) : w.running.distance,
          duration: ov.duration != null ? String(ov.duration) : w.running.duration,
          pace: ov.pace != null ? ov.pace : w.running.pace,
        },
      }
    }

    return {
      ...w,
      hasOverride: true,
      resistance: {
        weight: ov.weight != null ? String(ov.weight) : w.resistance.weight,
        reps: ov.reps != null ? String(ov.reps) : w.resistance.reps,
        sets: ov.sets != null ? String(ov.sets) : w.resistance.sets,
        rpe: ov.rpe != null ? String(ov.rpe) : w.resistance.rpe,
        duration: ov.duration != null ? String(ov.duration) : w.resistance.duration,
      },
    }
  })
}

// Check if resistance values differ from base
function resistanceDiffersFromBase(
  values: ResistanceValues,
  base: ResistanceValues
): boolean {
  return (
    values.weight !== base.weight ||
    values.reps !== base.reps ||
    values.sets !== base.sets ||
    values.rpe !== base.rpe ||
    values.duration !== base.duration
  )
}

// Check if running values differ from base
function runningDiffersFromBase(
  values: RunningValues,
  base: RunningValues
): boolean {
  return (
    values.distance !== base.distance ||
    values.duration !== base.duration ||
    values.pace !== base.pace
  )
}

export function WeekProgressionGrid({
  slot,
  workWeeks,
  hasDeload,
  isCompleted,
  open,
  onOpenChange,
  modality = 'resistance',
  runningBase,
}: WeekProgressionGridProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState('')
  const [weeks, setWeeks] = useState<WeekState[]>(() =>
    initWeeks(workWeeks, hasDeload, slot, runningBase)
  )
  const isDurationBased = slot.duration != null
  const resistanceBase = buildResistanceBase(slot)
  const deloadResistanceBase = buildDeloadResistance(slot)
  const runBase = buildRunningBase(runningBase)

  // Load existing overrides on mount
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      const overrides = await getWeekOverridesAction(slot.id)
      if (cancelled) return
      setWeeks((prev) => applyOverrides(prev, overrides, modality))
    }
    load()

    return () => {
      cancelled = true
    }
  }, [open, slot.id, modality])

  const updateWeekField = useCallback(
    (weekNumber: number, field: string, value: string) => {
      setWeeks((prev) =>
        prev.map((w) => {
          if (w.weekNumber !== weekNumber) return w
          if (field in w.resistance) {
            return {
              ...w,
              resistance: { ...w.resistance, [field]: value },
            }
          }
          if (field in w.running) {
            return {
              ...w,
              running: { ...w.running, [field]: value },
            }
          }
          return w
        })
      )
    },
    []
  )

  function handleSave() {
    startTransition(async () => {
      setSaveError('')

      const ops = weeks.map((week) => {
        const baseR = week.isDeload ? deloadResistanceBase : resistanceBase

        if (modality === 'resistance') {
          const differs = resistanceDiffersFromBase(week.resistance, baseR)

          if (!differs && week.weekNumber !== 1) {
            return deleteWeekOverrideAction(slot.id, week.weekNumber)
          } else if (differs) {
            return upsertWeekOverrideAction(slot.id, week.weekNumber, {
              weight: week.resistance.weight === '' ? null : Number(week.resistance.weight),
              reps: week.resistance.reps === '' ? null : week.resistance.reps,
              sets: week.resistance.sets === '' ? null : Number(week.resistance.sets),
              rpe: week.resistance.rpe === '' ? null : Number(week.resistance.rpe),
              duration: week.resistance.duration === '' ? null : Number(week.resistance.duration),
              is_deload: week.isDeload,
            })
          }
        } else {
          const differs = runningDiffersFromBase(week.running, runBase)

          if (!differs && week.weekNumber !== 1) {
            return deleteWeekOverrideAction(slot.id, week.weekNumber)
          } else if (differs) {
            return upsertWeekOverrideAction(slot.id, week.weekNumber, {
              distance: week.running.distance === '' ? null : Number(week.running.distance),
              duration: week.running.duration === '' ? null : Number(week.running.duration),
              pace: week.running.pace === '' ? null : week.running.pace,
              is_deload: week.isDeload,
            })
          }
        }
        return null
      })

      const results = await Promise.all(ops.filter(Boolean))
      const failed = results.find(
        (r) => r && 'success' in r && !r.success
      )

      if (failed && 'error' in failed) {
        setSaveError(failed.error)
        return
      }

      router.refresh()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan Weeks — {slot.exercise_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {/* Column headers */}
          {modality === 'resistance' ? (
            <div data-testid="column-headers" className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 px-2 text-xs font-medium text-muted-foreground">
              <span>Week</span>
              <span>Weight</span>
              <span>{isDurationBased ? 'Duration (sec)' : 'Reps'}</span>
              <span>Sets</span>
              <span>RPE</span>
            </div>
          ) : (
            <div data-testid="column-headers" className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 px-2 text-xs font-medium text-muted-foreground">
              <span>Week</span>
              <span>Distance</span>
              <span>Duration</span>
              <span>Pace</span>
            </div>
          )}

          {/* Week rows */}
          {weeks.map((week) => (
            <div
              key={week.isDeload ? 'deload' : week.weekNumber}
              data-testid={week.isDeload ? 'week-row-deload' : `week-row-${week.weekNumber}`}
              className={cn(
                'grid gap-2 rounded-lg px-2 py-1.5 items-center',
                modality === 'resistance'
                  ? 'grid-cols-[80px_1fr_1fr_1fr_1fr]'
                  : 'grid-cols-[80px_1fr_1fr_1fr]',
                week.isDeload && 'bg-muted/50 border border-dashed deload'
              )}
            >
              <span className={cn('text-sm font-medium', week.isDeload && 'text-muted-foreground')}>
                {week.isDeload ? 'Deload' : `Week ${week.weekNumber}`}
              </span>

              {modality === 'resistance' ? (
                <>
                  <div>
                    <Label htmlFor={`weight-w${week.weekNumber}`} className="sr-only">
                      Weight
                    </Label>
                    <NumericInput
                      id={`weight-w${week.weekNumber}`}
                      aria-label={`Weight week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="decimal"
                      value={week.resistance.weight}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'weight', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                  {isDurationBased ? (
                    <div>
                      <Label htmlFor={`duration-w${week.weekNumber}`} className="sr-only">
                        Duration (sec)
                      </Label>
                      <NumericInput
                        id={`duration-w${week.weekNumber}`}
                        aria-label={`Duration week ${week.isDeload ? 'deload' : week.weekNumber}`}
                        mode="integer"
                        value={week.resistance.duration}
                        onValueChange={(v) => updateWeekField(week.weekNumber, 'duration', v)}
                        readOnly={isCompleted}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor={`reps-w${week.weekNumber}`} className="sr-only">
                        Reps
                      </Label>
                      <NumericInput
                        id={`reps-w${week.weekNumber}`}
                        aria-label={`Reps week ${week.isDeload ? 'deload' : week.weekNumber}`}
                        mode="integer"
                        value={week.resistance.reps}
                        onValueChange={(v) => updateWeekField(week.weekNumber, 'reps', v)}
                        readOnly={isCompleted}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor={`sets-w${week.weekNumber}`} className="sr-only">
                      Sets
                    </Label>
                    <NumericInput
                      id={`sets-w${week.weekNumber}`}
                      aria-label={`Sets week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="integer"
                      value={week.resistance.sets}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'sets', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`rpe-w${week.weekNumber}`} className="sr-only">
                      RPE
                    </Label>
                    <NumericInput
                      id={`rpe-w${week.weekNumber}`}
                      aria-label={`RPE week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="decimal"
                      value={week.resistance.rpe}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'rpe', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor={`distance-w${week.weekNumber}`} className="sr-only">
                      Distance
                    </Label>
                    <NumericInput
                      id={`distance-w${week.weekNumber}`}
                      aria-label={`Distance week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="decimal"
                      value={week.running.distance}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'distance', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`duration-w${week.weekNumber}`} className="sr-only">
                      Duration
                    </Label>
                    <NumericInput
                      id={`duration-w${week.weekNumber}`}
                      aria-label={`Duration week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="integer"
                      value={week.running.duration}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'duration', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`pace-w${week.weekNumber}`} className="sr-only">
                      Pace
                    </Label>
                    <Input
                      id={`pace-w${week.weekNumber}`}
                      aria-label={`Pace week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      value={week.running.pace}
                      onChange={(e) => updateWeekField(week.weekNumber, 'pace', e.target.value)}
                      readOnly={isCompleted}
                      placeholder="mm:ss"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {saveError && (
          <p className="text-sm text-destructive" role="alert">{saveError}</p>
        )}

        {!isCompleted && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
