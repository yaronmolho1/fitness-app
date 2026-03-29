'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { handlePostSaveRedirect } from '@/lib/post-save-redirect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkoutLoggingForm } from '@/components/workout-logging-form'
import { RunningLoggingForm } from '@/components/running-logging-form'
import { MmaLoggingForm } from '@/components/mma-logging-form'
import { MixedLoggingForm } from '@/components/mixed-logging-form'
import { RoutineCheckOff } from '@/components/routine-check-off'
import { cn } from '@/lib/utils'
import { formatDateLong } from '@/lib/date-format'
import { getModalityAccentClass } from '@/lib/ui/modality-colors'
import type { SlotData, SectionData, MesocycleInfo, TemplateInfo, RoutineItemInfo, RoutineLogInfo, LoggedExerciseData, Period } from '@/lib/today/queries'
import { groupSlotsByGroupId, getGroupLabel } from '@/lib/ui/superset-grouping'
import { getModalityBadgeClasses } from '@/lib/ui/modality-colors'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { SectionHeading } from '@/components/layout/section-heading'
import { RetroactiveDateBanner } from '@/components/retroactive-date-banner'

type WorkoutResponse = {
  type: 'workout'
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
  slots: SlotData[]
  sections?: SectionData[]
  period: Period
  time_slot: string | null
  duration: number | null
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

type AlreadyLoggedResponse = {
  type: 'already_logged'
  date: string
  mesocycle: MesocycleInfo
  loggedWorkout: {
    id: number
    log_date: string
    logged_at: string
    canonical_name: string | null
    rating: number | null
    notes: string | null
    template_snapshot: { version: number; name?: string; modality?: string; [key: string]: unknown }
    exercises: LoggedExerciseData[]
  }
  period: Period
  time_slot: string | null
  duration: number | null
}

type TodayResponse = WorkoutResponse | RestDayResponse | NoMesoResponse | AlreadyLoggedResponse

const PERIOD_LABELS: Record<Period, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

function formatPeriodLabel(period: Period, timeSlot: string | null, duration: number | null): string {
  if (timeSlot && duration) return `${timeSlot} — ${duration} min`
  if (timeSlot) return timeSlot
  return PERIOD_LABELS[period]
}

function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

function ExerciseSlot({ slot }: { slot: SlotData }) {
  return (
    <div
      data-testid="exercise-slot"
      className={cn(
        'rounded-xl border p-4 shadow-sm transition-colors duration-150',
        slot.is_main
          ? 'border-l-4 border-l-primary bg-card'
          : 'border-l-4 border-l-muted bg-card'
      )}
    >
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

      {slot.guidelines && (
        <p className="mt-3 text-sm italic text-muted-foreground">
          {slot.guidelines}
        </p>
      )}
    </div>
  )
}

function SupersetGroupDisplay({ slots, groupRestSeconds }: { slots: SlotData[]; groupRestSeconds: number }) {
  const label = getGroupLabel(slots.length)
  return (
    <div data-testid="superset-group" className="rounded-xl border-l-4 border-l-primary border border-border pl-3 py-2 pr-2 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold text-primary">{label}</span>
      </div>
      <div className="space-y-3">
        {slots.map((slot) => (
          <ExerciseSlot key={slot.id} slot={slot} />
        ))}
      </div>
      {groupRestSeconds > 0 && (
        <div className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground">
          <span>Group rest:</span>
          <span className="font-semibold tabular-nums">{formatRest(groupRestSeconds)}</span>
        </div>
      )}
    </div>
  )
}

function RenderGroupedSlots({ slots }: { slots: SlotData[] }) {
  const grouped = groupSlotsByGroupId(slots)
  return (
    <div className="space-y-3">
      {grouped.map((item) => {
        if (item.type === 'group') {
          return (
            <SupersetGroupDisplay
              key={`group-${item.groupId}`}
              slots={item.slots}
              groupRestSeconds={item.groupRestSeconds}
            />
          )
        }
        return <ExerciseSlot key={item.slot.id} slot={item.slot} />
      })}
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

      {data.slots.length > 0 ? (
        <RenderGroupedSlots slots={data.slots} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No exercises configured for this template yet.
            </p>
          </CardContent>
        </Card>
      )}

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
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {data.template.name}
          </CardTitle>
          {data.mesocycle.status !== 'completed' && (
            <Link
              href={`/mesocycles/${data.mesocycle.id}`}
              data-testid="edit-template-link"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Edit template"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{formatDateLong(data.date)}</p>
        {data.time_slot && (
          <p data-testid="time-info" className="text-sm font-medium text-muted-foreground">
            {data.time_slot}{data.duration ? ` — ${data.duration} min` : ''}
          </p>
        )}
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

      <Card className={cn('border-l-4', getModalityAccentClass('running'))}>
        <CardContent className="pt-6">
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {template.target_distance !== null && (
              <TargetCell label="Distance" value={`${template.target_distance}km`} />
            )}
            {template.target_duration !== null && (
              <TargetCell label="Duration" value={`${template.target_duration}min`} />
            )}
            {template.target_elevation_gain !== null && template.target_elevation_gain !== undefined && (
              <TargetCell label="Elevation" value={`${template.target_elevation_gain}m ascent`} />
            )}
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

      <Card className={cn('border-l-4', getModalityAccentClass('mma'))}>
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

const MODALITY_LABELS: Record<string, string> = {
  resistance: 'Resistance',
  running: 'Running',
  mma: 'MMA',
}

function SectionRunningContent({ section }: { section: SectionData }) {
  const config = section.run_type ? runTypeConfig[section.run_type] : null
  const isInterval = section.run_type === 'interval'

  return (
    <Card className={cn('border-l-4', getModalityAccentClass('running'))}>
      <CardContent className="pt-6">
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {section.target_distance !== null && (
            <TargetCell label="Distance" value={`${section.target_distance}km`} />
          )}
          {section.target_duration !== null && (
            <TargetCell label="Duration" value={`${section.target_duration}min`} />
          )}
          {section.target_elevation_gain !== null && section.target_elevation_gain !== undefined && (
            <TargetCell label="Elevation" value={`${section.target_elevation_gain}m ascent`} />
          )}
          {section.target_pace && (
            <TargetCell label="Pace" value={section.target_pace} />
          )}
          {section.hr_zone !== null && (
            <TargetCell label="HR Zone" value={`Zone ${section.hr_zone}`} />
          )}
          {isInterval && section.interval_count !== null && (
            <TargetCell label="Intervals" value={String(section.interval_count)} />
          )}
          {isInterval && section.interval_rest !== null && (
            <TargetCell label="Rest" value={formatRest(section.interval_rest)} />
          )}
        </div>

        {section.coaching_cues && (
          <div className="mt-4 rounded-md bg-green-500/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Coaching Cues
            </p>
            <p className="mt-1 text-sm">{section.coaching_cues}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SectionMmaContent({ section }: { section: SectionData }) {
  return (
    <Card className={cn('border-l-4', getModalityAccentClass('mma'))}>
      <CardContent className="pt-6">
        {section.planned_duration !== null && (
          <TargetCell label="Duration" value={`${section.planned_duration} min`} />
        )}
      </CardContent>
    </Card>
  )
}

function SectionResistanceContent({ section }: { section: SectionData }) {
  const slots = section.slots ?? []
  if (slots.length === 0) return null

  return <RenderGroupedSlots slots={slots} />
}

function MixedDisplay({
  data,
  onStartLogging,
}: {
  data: WorkoutResponse
  onStartLogging: () => void
}) {
  const sections = data.sections ?? []

  return (
    <div data-testid="mixed-display" className="space-y-4">
      <WorkoutHeader data={data} />

      {sections.map((section, i) => (
        <div key={section.id}>
          {i > 0 && (
            <div data-testid="section-separator" className="my-6 border-t border-border" />
          )}

          <div data-testid="section-header" className="mb-3 flex items-center gap-2">
            <h3 className="text-lg font-semibold">{section.section_name}</h3>
            <span
              data-testid="modality-badge"
              className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', getModalityBadgeClasses(section.modality))}
            >
              {MODALITY_LABELS[section.modality] ?? section.modality}
            </span>
          </div>

          {section.modality === 'resistance' && (
            <SectionResistanceContent section={section} />
          )}
          {section.modality === 'running' && (
            <SectionRunningContent section={section} />
          )}
          {section.modality === 'mma' && (
            <SectionMmaContent section={section} />
          )}
        </div>
      ))}

      <button
        type="button"
        data-testid="start-mixed-logging-btn"
        onClick={onStartLogging}
        className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
      >
        Log Workout
      </button>
    </div>
  )
}

function formatLoggedAt(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function ResistanceSummary({ exercises }: { exercises: LoggedExerciseData[] }) {
  if (exercises.length === 0) return null
  return (
    <div className="space-y-3">
      {exercises.map((ex) => (
        <div
          key={ex.id}
          data-testid="logged-exercise"
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <h4 className="text-sm font-semibold">{ex.exercise_name}</h4>
          {ex.actual_rpe !== null && (
            <span className="text-xs text-muted-foreground">RPE {ex.actual_rpe}</span>
          )}
          <div className="mt-2 space-y-1">
            {ex.sets.map((set) => (
              <div
                key={set.set_number}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <span className="w-8 text-xs font-medium">#{set.set_number}</span>
                {set.actual_reps !== null && (
                  <span>{set.actual_reps} reps</span>
                )}
                {set.actual_weight !== null && (
                  <span>{set.actual_weight}kg</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RunningSummary({ snapshot }: { snapshot: Record<string, unknown> }) {
  const distance = snapshot.actual_distance as number | null | undefined
  const pace = snapshot.actual_avg_pace as string | null | undefined
  const hr = snapshot.actual_avg_hr as number | null | undefined

  return (
    <div className="grid grid-cols-3 gap-3">
      {distance != null && <TargetCell label="Distance" value={String(distance)} />}
      {pace != null && <TargetCell label="Avg Pace" value={pace} />}
      {hr != null && <TargetCell label="Avg HR" value={String(hr)} />}
    </div>
  )
}

function MmaSummary({ snapshot }: { snapshot: Record<string, unknown> }) {
  const duration = snapshot.actual_duration_minutes as number | null | undefined

  return (
    <div>
      {duration != null && <TargetCell label="Duration" value={`${duration} min`} />}
    </div>
  )
}

function AlreadyLoggedSummary({ data }: { data: AlreadyLoggedResponse }) {
  const { loggedWorkout, mesocycle } = data
  const snapshot = loggedWorkout.template_snapshot
  const modality = (snapshot.modality as string) || 'resistance'
  const workoutName = (snapshot.name as string) || 'Workout'

  return (
    <div data-testid="already-logged-summary" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {mesocycle.name}
            </span>
            <Badge variant="secondary" className="bg-green-500/15 text-green-700 dark:text-green-400">
              Workout Logged
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {workoutName}
          </CardTitle>
          <p data-testid="logged-at-time" className="text-sm text-muted-foreground">
            Logged at {formatLoggedAt(loggedWorkout.logged_at)}
          </p>
        </CardHeader>
      </Card>

      {modality === 'resistance' && (
        <ResistanceSummary exercises={loggedWorkout.exercises} />
      )}
      {modality === 'running' && (
        <RunningSummary snapshot={snapshot} />
      )}
      {modality === 'mma' && (
        <MmaSummary snapshot={snapshot} />
      )}

      {loggedWorkout.rating !== null && (
        <div data-testid="workout-rating" className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Rating:</span>
          <span className="text-lg font-bold">{loggedWorkout.rating}/5</span>
        </div>
      )}

      {loggedWorkout.notes && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Notes
            </p>
            <p className="text-sm">{loggedWorkout.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Renders a single session within the multi-session layout
function SessionSection({
  session,
  showPeriodLabel,
  loggingState,
  onStartLogging,
  onSaveSuccess,
}: {
  session: TodayResponse
  showPeriodLabel: boolean
  loggingState: Record<string, boolean>
  onStartLogging: (key: string) => void
  onSaveSuccess?: () => void
}) {
  if (session.type === 'already_logged') {
    return (
      <div data-testid="session-group">
        {showPeriodLabel && (
          <SectionHeading data-testid="period-label" className="mt-0 mb-3 text-sm uppercase tracking-wider text-muted-foreground">
            {formatPeriodLabel(session.period, session.time_slot, session.duration ?? null)}
          </SectionHeading>
        )}
        <AlreadyLoggedSummary data={session} />
      </div>
    )
  }

  if (session.type === 'workout') {
    const key = `${session.period}-${session.template.id}`
    const isLogging = loggingState[key] ?? false

    if (isLogging) {
      if (session.template.modality === 'mixed') {
        return <MixedLoggingForm data={{ ...session, sections: session.sections ?? [] }} onSaveSuccess={onSaveSuccess} />
      }
      if (session.template.modality === 'running') {
        return <RunningLoggingForm data={session} onSaveSuccess={onSaveSuccess} />
      }
      if (session.template.modality === 'mma') {
        return <MmaLoggingForm data={session} onSaveSuccess={onSaveSuccess} />
      }
      return <WorkoutLoggingForm data={session} onSaveSuccess={onSaveSuccess} />
    }

    return (
      <div data-testid="session-group">
        {showPeriodLabel && (
          <SectionHeading data-testid="period-label" className="mt-0 mb-3 text-sm uppercase tracking-wider text-muted-foreground">
            {formatPeriodLabel(session.period, session.time_slot, session.duration ?? null)}
          </SectionHeading>
        )}
        {session.template.modality === 'mixed' ? (
          <MixedDisplay data={session} onStartLogging={() => onStartLogging(key)} />
        ) : session.template.modality === 'running' ? (
          <RunningDisplay data={session} onStartLogging={() => onStartLogging(key)} />
        ) : session.template.modality === 'mma' ? (
          <MmaDisplay data={session} onStartLogging={() => onStartLogging(key)} />
        ) : (
          <ResistanceDisplay data={session} onStartLogging={() => onStartLogging(key)} />
        )}
      </div>
    )
  }

  return null
}

function getToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TodayWorkout({ date }: { date?: string }) {
  const [sessions, setSessions] = useState<TodayResponse[] | null>(null)
  const [error, setError] = useState(false)
  const [loggingState, setLoggingState] = useState<Record<string, boolean>>({})
  const today = getToday()
  const router = useRouter()

  const onSaveSuccess = useCallback(() => {
    handlePostSaveRedirect({ date, today, push: router.push })
  }, [date, today, router.push])

  useEffect(() => {
    let stale = false
    const url = date ? `/api/today?date=${encodeURIComponent(date)}` : '/api/today'
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((json: TodayResponse[]) => {
        if (!stale) setSessions(json)
      })
      .catch(() => {
        if (!stale) setError(true)
      })
    return () => { stale = true }
  }, [date])

  function startLogging(key: string) {
    setLoggingState((prev) => ({ ...prev, [key]: true }))
  }

  const banner = <RetroactiveDateBanner date={date} today={today} />

  // Loading
  if (!sessions && !error) {
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

  if (!sessions || sessions.length === 0) return null

  // Single-item responses for non-session types
  const first = sessions[0]

  if (first.type === 'no_active_mesocycle') {
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
          <Link
            href="/mesocycles"
            data-testid="create-mesocycle-link"
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to Mesocycles
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (first.type === 'rest_day') {
    return (
      <div data-testid="rest-day" className="space-y-6">
        {banner}
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

        <div>
          <SectionHeading className="mt-0 mb-3">Daily Routines</SectionHeading>
          <RoutineCheckOff
            items={first.routines.items}
            logs={first.routines.logs}
            logDate={first.date}
          />
        </div>
      </div>
    )
  }

  // Multi-session: workout and/or already_logged items
  const showPeriodLabels = sessions.length > 1

  // Single session — no period label, backward-compatible rendering
  if (sessions.length === 1) {
    const session = sessions[0]

    if (session.type === 'already_logged') {
      return (
        <>
          {banner}
          <AlreadyLoggedSummary data={session} />
        </>
      )
    }

    if (session.type === 'workout') {
      const key = `${session.period}-${session.template.id}`
      const isLogging = loggingState[key] ?? false

      if (isLogging) {
        if (session.template.modality === 'mixed') {
          return <>{banner}<MixedLoggingForm data={{ ...session, sections: session.sections ?? [] }} onSaveSuccess={onSaveSuccess} /></>
        }
        if (session.template.modality === 'running') {
          return <>{banner}<RunningLoggingForm data={session} onSaveSuccess={onSaveSuccess} /></>
        }
        if (session.template.modality === 'mma') {
          return <>{banner}<MmaLoggingForm data={session} onSaveSuccess={onSaveSuccess} /></>
        }
        return <>{banner}<WorkoutLoggingForm data={session} onSaveSuccess={onSaveSuccess} /></>
      }

      if (session.template.modality === 'mixed') {
        return <>{banner}<MixedDisplay data={session} onStartLogging={() => startLogging(key)} /></>
      }
      if (session.template.modality === 'running') {
        return (
          <>{banner}<RunningDisplay data={session} onStartLogging={() => startLogging(key)} /></>
        )
      }
      if (session.template.modality === 'mma') {
        return (
          <>{banner}<MmaDisplay data={session} onStartLogging={() => startLogging(key)} /></>
        )
      }
      return (
        <>{banner}<ResistanceDisplay data={session} onStartLogging={() => startLogging(key)} /></>
      )
    }
  }

  // Multiple sessions — render grouped by period
  return (
    <div data-testid="multi-session-view" className="space-y-8">
      {banner}
      {sessions.map((session, i) => (
        <SessionSection
          key={i}
          session={session}
          showPeriodLabel={showPeriodLabels}
          loggingState={loggingState}
          onStartLogging={startLogging}
          onSaveSuccess={onSaveSuccess}
        />
      ))}
    </div>
  )
}
