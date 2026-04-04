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
  upsertTemplateWeekOverrideAction,
  deleteTemplateWeekOverrideAction,
  getTemplateWeekOverridesAction,
} from '@/lib/progression/template-week-actions'
import {
  computeRunningDeloadDefaults,
  computeMmaDeloadDefaults,
} from '@/lib/progression/week-overrides'

type RunningBase = {
  distance: number | null
  duration: number | null
  pace: string | null
  run_type?: string | null
  interval_count?: number | null
  interval_rest?: number | null
}

type MmaBase = {
  planned_duration: number | null
}

type TemplateWeekGridProps = {
  templateId: number
  sectionId: number | null
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  activeWeeks?: number[]
} & (
  | { modality: 'running'; runningBase: RunningBase; mmaBase?: never }
  | { modality: 'mma'; mmaBase: MmaBase; runningBase?: never }
)

type RunningValues = { distance: string; duration: string; pace: string; interval_count: string; interval_rest: string }
type MmaValues = { planned_duration: string }

type WeekState = {
  weekNumber: number
  isDeload: boolean
  running: RunningValues
  mma: MmaValues
  hasOverride: boolean
}

function buildRunningValues(base?: RunningBase | null): RunningValues {
  return {
    distance: base?.distance != null ? String(base.distance) : '',
    duration: base?.duration != null ? String(base.duration) : '',
    pace: base?.pace ?? '',
    interval_count: base?.interval_count != null ? String(base.interval_count) : '',
    interval_rest: base?.interval_rest != null ? String(base.interval_rest) : '',
  }
}

function buildMmaValues(base?: MmaBase | null): MmaValues {
  return {
    planned_duration: base?.planned_duration != null ? String(base.planned_duration) : '',
  }
}

function initWeeks(
  workWeeks: number,
  hasDeload: boolean,
  modality: 'running' | 'mma',
  runningBase?: RunningBase,
  mmaBase?: MmaBase,
  activeWeeks?: number[]
): WeekState[] {
  const weeks: WeekState[] = []

  const weekNumbers = activeWeeks
    ? activeWeeks.filter((w) => w >= 1 && w <= workWeeks)
    : Array.from({ length: workWeeks }, (_, i) => i + 1)

  for (const w of weekNumbers) {
    weeks.push({
      weekNumber: w,
      isDeload: false,
      running: buildRunningValues(runningBase),
      mma: buildMmaValues(mmaBase),
      hasOverride: false,
    })
  }

  if (hasDeload) {
    const deloadRunning = runningBase
      ? computeRunningDeloadDefaults(runningBase)
      : { distance: null, duration: null, pace: null }
    const deloadMma = mmaBase
      ? computeMmaDeloadDefaults(mmaBase)
      : { planned_duration: null }

    weeks.push({
      weekNumber: workWeeks + 1,
      isDeload: true,
      running: buildRunningValues(modality === 'running' ? deloadRunning : undefined),
      mma: buildMmaValues(modality === 'mma' ? deloadMma : undefined),
      hasOverride: false,
    })
  }

  return weeks
}

type OverrideRow = Awaited<ReturnType<typeof getTemplateWeekOverridesAction>>[number]

function applyOverrides(
  weeks: WeekState[],
  overrides: OverrideRow[],
  modality: 'running' | 'mma'
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
          interval_count: ov.interval_count != null ? String(ov.interval_count) : w.running.interval_count,
          interval_rest: ov.interval_rest != null ? String(ov.interval_rest) : w.running.interval_rest,
        },
      }
    }

    return {
      ...w,
      hasOverride: true,
      mma: {
        planned_duration: ov.planned_duration != null ? String(ov.planned_duration) : w.mma.planned_duration,
      },
    }
  })
}

function runningDiffers(values: RunningValues, base: RunningValues): boolean {
  return (
    values.distance !== base.distance ||
    values.duration !== base.duration ||
    values.pace !== base.pace ||
    values.interval_count !== base.interval_count ||
    values.interval_rest !== base.interval_rest
  )
}

function mmaDiffers(values: MmaValues, base: MmaValues): boolean {
  return values.planned_duration !== base.planned_duration
}

export function TemplateWeekGrid(props: TemplateWeekGridProps) {
  const {
    templateId,
    sectionId,
    workWeeks,
    hasDeload,
    isCompleted,
    open,
    onOpenChange,
    modality,
    title,
    activeWeeks,
  } = props

  const runningBase = modality === 'running' ? props.runningBase : undefined
  const mmaBase = modality === 'mma' ? props.mmaBase : undefined
  const isInterval = runningBase?.run_type === 'interval'

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState('')
  const [weeks, setWeeks] = useState<WeekState[]>(() =>
    initWeeks(workWeeks, hasDeload, modality, runningBase, mmaBase, activeWeeks)
  )

  const runBase = buildRunningValues(runningBase)
  const mmaBaseValues = buildMmaValues(mmaBase)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      const overrides = await getTemplateWeekOverridesAction(templateId, sectionId)
      if (cancelled) return
      setWeeks((prev) => applyOverrides(prev, overrides, modality))
    }
    load()

    return () => { cancelled = true }
  }, [open, templateId, sectionId, modality])

  const updateWeekField = useCallback(
    (weekNumber: number, field: string, value: string) => {
      setWeeks((prev) =>
        prev.map((w) => {
          if (w.weekNumber !== weekNumber) return w
          if (field in w.running) {
            return { ...w, running: { ...w.running, [field]: value } }
          }
          if (field in w.mma) {
            return { ...w, mma: { ...w.mma, [field]: value } }
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

      const deloadRunning = runningBase
        ? buildRunningValues(computeRunningDeloadDefaults(runningBase))
        : runBase
      const deloadMmaVals = mmaBase
        ? buildMmaValues(computeMmaDeloadDefaults(mmaBase))
        : mmaBaseValues

      const ops = weeks.map((week) => {
        if (modality === 'running') {
          const base = week.isDeload ? deloadRunning : runBase
          const differs = runningDiffers(week.running, base)

          if (!differs && week.weekNumber !== 1) {
            return deleteTemplateWeekOverrideAction(templateId, sectionId, week.weekNumber)
          } else if (differs) {
            return upsertTemplateWeekOverrideAction(templateId, sectionId, week.weekNumber, {
              distance: week.running.distance === '' ? null : Number(week.running.distance),
              duration: week.running.duration === '' ? null : Number(week.running.duration),
              pace: week.running.pace === '' ? null : week.running.pace,
              interval_count: week.running.interval_count === '' ? null : Number(week.running.interval_count),
              interval_rest: week.running.interval_rest === '' ? null : Number(week.running.interval_rest),
              is_deload: week.isDeload,
            })
          }
        } else {
          const base = week.isDeload ? deloadMmaVals : mmaBaseValues
          const differs = mmaDiffers(week.mma, base)

          if (!differs && week.weekNumber !== 1) {
            return deleteTemplateWeekOverrideAction(templateId, sectionId, week.weekNumber)
          } else if (differs) {
            return upsertTemplateWeekOverrideAction(templateId, sectionId, week.weekNumber, {
              planned_duration: week.mma.planned_duration === '' ? null : Number(week.mma.planned_duration),
              is_deload: week.isDeload,
            })
          }
        }
        return null
      })

      const results = await Promise.all(ops.filter(Boolean))
      const failed = results.find((r) => r && 'success' in r && !r.success)

      if (failed && 'error' in failed) {
        setSaveError(failed.error as string)
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
          <DialogTitle>Plan Weeks — {title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {modality === 'running' ? (
            <div className={cn(
              'grid gap-2 px-2 text-xs font-medium text-muted-foreground',
              isInterval ? 'grid-cols-[80px_1fr_1fr_1fr_1fr_1fr]' : 'grid-cols-[80px_1fr_1fr_1fr]'
            )}>
              <span>Week</span>
              <span>Distance (km)</span>
              <span>Duration (min)</span>
              <span>Pace</span>
              {isInterval && <span>Intervals</span>}
              {isInterval && <span>Rest (sec)</span>}
            </div>
          ) : (
            <div className="grid grid-cols-[80px_1fr] gap-2 px-2 text-xs font-medium text-muted-foreground">
              <span>Week</span>
              <span>Duration (min)</span>
            </div>
          )}

          {weeks.map((week) => (
            <div
              key={week.isDeload ? 'deload' : week.weekNumber}
              data-testid={week.isDeload ? 'week-row-deload' : `week-row-${week.weekNumber}`}
              className={cn(
                'grid gap-2 rounded-lg px-2 py-1.5 items-center',
                modality === 'running'
                  ? (isInterval ? 'grid-cols-[80px_1fr_1fr_1fr_1fr_1fr]' : 'grid-cols-[80px_1fr_1fr_1fr]')
                  : 'grid-cols-[80px_1fr]',
                week.isDeload && 'bg-muted/50 border border-dashed'
              )}
            >
              <span className={cn('text-sm font-medium', week.isDeload && 'text-muted-foreground')}>
                {week.isDeload ? 'Deload' : `Week ${week.weekNumber}`}
              </span>

              {modality === 'running' ? (
                <>
                  <div>
                    <Label htmlFor={`t-distance-w${week.weekNumber}`} className="sr-only">Distance</Label>
                    <NumericInput
                      id={`t-distance-w${week.weekNumber}`}
                      aria-label={`Distance week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="decimal"
                      value={week.running.distance}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'distance', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`t-duration-w${week.weekNumber}`} className="sr-only">Duration</Label>
                    <NumericInput
                      id={`t-duration-w${week.weekNumber}`}
                      aria-label={`Duration week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      mode="integer"
                      value={week.running.duration}
                      onValueChange={(v) => updateWeekField(week.weekNumber, 'duration', v)}
                      readOnly={isCompleted}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`t-pace-w${week.weekNumber}`} className="sr-only">Pace</Label>
                    <Input
                      id={`t-pace-w${week.weekNumber}`}
                      aria-label={`Pace week ${week.isDeload ? 'deload' : week.weekNumber}`}
                      value={week.running.pace}
                      onChange={(e) => updateWeekField(week.weekNumber, 'pace', e.target.value)}
                      readOnly={isCompleted}
                      placeholder="mm:ss"
                    />
                  </div>
                  {isInterval && (
                    <div>
                      <Label htmlFor={`t-intcount-w${week.weekNumber}`} className="sr-only">Intervals</Label>
                      <NumericInput
                        id={`t-intcount-w${week.weekNumber}`}
                        aria-label={`Intervals week ${week.isDeload ? 'deload' : week.weekNumber}`}
                        mode="integer"
                        value={week.running.interval_count}
                        onValueChange={(v) => updateWeekField(week.weekNumber, 'interval_count', v)}
                        readOnly={isCompleted}
                      />
                    </div>
                  )}
                  {isInterval && (
                    <div>
                      <Label htmlFor={`t-intrest-w${week.weekNumber}`} className="sr-only">Interval Rest</Label>
                      <NumericInput
                        id={`t-intrest-w${week.weekNumber}`}
                        aria-label={`Interval rest week ${week.isDeload ? 'deload' : week.weekNumber}`}
                        mode="integer"
                        value={week.running.interval_rest}
                        onValueChange={(v) => updateWeekField(week.weekNumber, 'interval_rest', v)}
                        readOnly={isCompleted}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <Label htmlFor={`t-pdur-w${week.weekNumber}`} className="sr-only">Duration</Label>
                  <NumericInput
                    id={`t-pdur-w${week.weekNumber}`}
                    aria-label={`Duration week ${week.isDeload ? 'deload' : week.weekNumber}`}
                    mode="integer"
                    value={week.mma.planned_duration}
                    onValueChange={(v) => updateWeekField(week.weekNumber, 'planned_duration', v)}
                    readOnly={isCompleted}
                  />
                </div>
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
