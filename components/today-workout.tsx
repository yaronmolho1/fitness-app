'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkoutLoggingForm } from '@/components/workout-logging-form'
import { RunningLoggingForm } from '@/components/running-logging-form'
import { MmaLoggingForm } from '@/components/mma-logging-form'
import { RoutineCheckOff } from '@/components/routine-check-off'
import { cn } from '@/lib/utils'
import type { SlotData, MesocycleInfo, TemplateInfo, RoutineItemInfo, RoutineLogInfo } from '@/lib/today/queries'

type WorkoutResponse = {
  type: 'workout'
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
  slots: SlotData[]
}

type RestDayResponse = {
  type: 'rest_day'
  date: string
  mesocycle: MesocycleInfo
  routines: {
    items: RoutineItemInfo[]
    logs: RoutineLogInfo[]
  }
}

type NoMesoResponse = {
  type: 'no_active_mesocycle'
  date: string
}

type LoggedWorkoutSummary = {
  id: number
  log_date: string
  logged_at: string
  canonical_name: string | null
  rating: number | null
  notes: string | null
  template_snapshot: { version: number; name?: string; [key: string]: unknown }
}

type AlreadyLoggedResponse = {
  type: 'already_logged'
  date: string
  mesocycle: MesocycleInfo
  loggedWorkout: LoggedWorkoutSummary
}

type TodayResponse = WorkoutResponse | RestDayResponse | NoMesoResponse | AlreadyLoggedResponse

function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function ExerciseSlot({ slot }: { slot: SlotData }) {
  return (
    <div
      data-testid="exercise-slot"
      className={cn(
        'rounded-lg border p-4 transition-colors',
        slot.is_main
          ? 'border-l-4 border-l-primary bg-card'
          : 'border-l-4 border-l-muted bg-card'
      )}
    >
      {/* Exercise header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-tight">
          {slot.exercise_name}
        </h3>
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

      {/* Targets grid — large, scannable numbers */}
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        <TargetCell label="Sets" value={String(slot.sets)} />
        <TargetCell label="Reps" value={slot.reps} />
        {slot.weight !== null && (
          <TargetCell label="Weight" value={`${slot.weight}kg`} />
        )}
        {slot.rpe !== null && (
          <TargetCell label="RPE" value={String(slot.rpe)} />
        )}
        {slot.rest_seconds !== null && (
          <TargetCell label="Rest" value={formatRest(slot.rest_seconds)} />
        )}
      </div>

      {/* Guidelines */}
      {slot.guidelines && (
        <p className="mt-3 text-sm italic text-muted-foreground">
          {slot.guidelines}
        </p>
      )}
    </div>
  )
}

function TargetCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}

function ResistanceDisplay({
  data,
  onStartLogging,
}: {
  data: WorkoutResponse
  onStartLogging: () => void
}) {
  return (
    <div data-testid="workout-display" className="space-y-4">
      <WorkoutHeader data={data} />

      {/* Exercise slots */}
      {data.slots.length > 0 ? (
        <div className="space-y-3">
          {data.slots.map((slot) => (
            <ExerciseSlot key={slot.id} slot={slot} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No exercises configured for this template yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Log workout action */}
      {data.template.modality === 'resistance' && (
        <button
          type="button"
          data-testid="start-logging-btn"
          onClick={onStartLogging}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
        >
          Log Workout
        </button>
      )}
    </div>
  )
}

const runTypeConfig: Record<string, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  tempo: { label: 'Tempo', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  interval: { label: 'Interval', color: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  long: { label: 'Long', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  race: { label: 'Race', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400' },
}

function WorkoutHeader({ data }: { data: WorkoutResponse }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {data.mesocycle.name}
          </span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              data.mesocycle.week_type === 'deload'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {data.mesocycle.week_type === 'deload' ? 'Deload' : 'Normal'}
          </span>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          {data.template.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{formatDate(data.date)}</p>
      </CardHeader>
      {data.template.notes && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {data.template.notes}
          </p>
        </CardContent>
      )}
    </Card>
  )
}

function RunningDisplay({
  data,
  onStartLogging,
}: {
  data: WorkoutResponse
  onStartLogging: () => void
}) {
  const { template } = data
  const config = template.run_type ? runTypeConfig[template.run_type] : null
  const isInterval = template.run_type === 'interval'

  return (
    <div data-testid="running-display" className="space-y-4">
      <WorkoutHeader data={data} />

      {/* Run details card */}
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="pt-6">
          {/* Run type badge */}
          {config && (
            <div className="mb-4">
              <span
                data-testid="run-type-badge"
                className={cn('rounded-full px-3 py-1 text-sm font-semibold', config.color)}
              >
                {config.label}
              </span>
            </div>
          )}

          {/* Targets grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {template.target_pace && (
              <TargetCell label="Pace" value={template.target_pace} />
            )}
            {template.hr_zone !== null && (
              <TargetCell label="HR Zone" value={`Zone ${template.hr_zone}`} />
            )}
            {isInterval && template.interval_count !== null && (
              <TargetCell label="Intervals" value={String(template.interval_count)} />
            )}
            {isInterval && template.interval_rest !== null && (
              <TargetCell label="Rest" value={formatRest(template.interval_rest)} />
            )}
          </div>

          {/* Coaching cues */}
          {template.coaching_cues && (
            <div className="mt-4 rounded-md bg-green-500/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Coaching Cues
              </p>
              <p className="mt-1 text-sm">{template.coaching_cues}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <button
        type="button"
        data-testid="start-running-logging-btn"
        onClick={onStartLogging}
        className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
      >
        Log Run
      </button>
    </div>
  )
}

function MmaDisplay({
  data,
  onStartLogging,
}: {
  data: WorkoutResponse
  onStartLogging: () => void
}) {
  const { template } = data

  return (
    <div data-testid="mma-display" className="space-y-4">
      <WorkoutHeader data={data} />

      {/* Session details card */}
      <Card className="border-l-4 border-l-rose-500">
        <CardContent className="pt-6">
          {template.planned_duration !== null && (
            <div className="mb-4">
              <TargetCell label="Duration" value={`${template.planned_duration} min`} />
            </div>
          )}
        </CardContent>
      </Card>

      <button
        type="button"
        data-testid="start-mma-logging-btn"
        onClick={onStartLogging}
        className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
      >
        Log Session
      </button>
    </div>
  )
}

export function TodayWorkout() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [error, setError] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [isLoggingRun, setIsLoggingRun] = useState(false)
  const [isLoggingMma, setIsLoggingMma] = useState(false)

  useEffect(() => {
    fetch('/api/today')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((json: TodayResponse) => setData(json))
      .catch(() => setError(true))
  }, [])

  // Loading
  if (!data && !error) {
    return (
      <div data-testid="today-loading" className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <Card data-testid="today-error">
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Something went wrong loading your workout.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check your connection and try refreshing.
          </p>
        </CardContent>
      </Card>
    )
  }

  // No active mesocycle
  if (data?.type === 'no_active_mesocycle') {
    return (
      <Card data-testid="no-active-mesocycle">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <span className="text-xl">&#x1f3cb;&#xfe0f;</span>
          </div>
          <p className="text-base font-semibold">No active training phase</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and activate a mesocycle to see your daily workout.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Rest day
  if (data?.type === 'rest_day') {
    return (
      <div data-testid="rest-day" className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <span className="text-xl">&#x1f4a4;</span>
            </div>
            <p className="text-base font-semibold">Rest Day</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Recovery is part of the plan. See you tomorrow.
            </p>
          </CardContent>
        </Card>

        {/* Daily routines */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Daily Routines</h2>
          <RoutineCheckOff
            items={data.routines.items}
            logs={data.routines.logs}
            logDate={data.date}
          />
        </div>
      </div>
    )
  }

  // Already logged
  if (data?.type === 'already_logged') {
    const { loggedWorkout, mesocycle } = data
    const workoutName = loggedWorkout.template_snapshot?.name ?? loggedWorkout.canonical_name ?? 'Workout'

    return (
      <Card data-testid="already-logged">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {mesocycle.name}
            </span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {workoutName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{formatDate(data.date)}</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-green-500/10 p-4 text-center">
            <p className="text-base font-semibold text-green-700 dark:text-green-400">
              Workout Logged
            </p>
            {loggedWorkout.rating !== null && (
              <p className="mt-1 text-sm text-muted-foreground">
                Rating: {loggedWorkout.rating}/5
              </p>
            )}
            {loggedWorkout.notes && (
              <p className="mt-1 text-sm text-muted-foreground">
                {loggedWorkout.notes}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Workout — route by modality
  if (data?.type === 'workout') {
    if (data.template.modality === 'running') {
      if (isLoggingRun) {
        return <RunningLoggingForm data={data} />
      }
      return (
        <RunningDisplay
          data={data}
          onStartLogging={() => setIsLoggingRun(true)}
        />
      )
    }
    if (data.template.modality === 'mma') {
      if (isLoggingMma) {
        return <MmaLoggingForm data={data} />
      }
      return (
        <MmaDisplay
          data={data}
          onStartLogging={() => setIsLoggingMma(true)}
        />
      )
    }
    if (isLogging && data.template.modality === 'resistance') {
      return <WorkoutLoggingForm data={data} />
    }
    return (
      <ResistanceDisplay data={data} onStartLogging={() => setIsLogging(true)} />
    )
  }

  return null
}
