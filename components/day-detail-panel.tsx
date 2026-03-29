'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, CalendarDays, Star, ChevronDown, ClipboardCheck, ArrowRightLeft, Undo2 } from 'lucide-react'
import type { DayDetailResult, SlotDetail, LoggedExerciseDetail, TemplateSnapshot, Period } from '@/lib/calendar/day-detail'
import { formatDateLong } from '@/lib/date-format'
import { getModalityBadgeClasses } from '@/lib/ui/modality-colors'
import { undoScheduleMove } from '@/lib/schedule/override-actions'
import { MoveWorkoutModal } from '@/components/move-workout-modal'
import type { OccupiedSlot } from '@/components/move-workout-modal'

interface DayDetailPanelProps {
  date: string | null
  onClose: () => void
  onMutate?: () => void
}

const periodLabel: Record<Period, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
}

const periodOrder: Record<Period, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
}

function ModalityBadge({ modality }: { modality: string }) {
  return (
    <Badge className={getModalityBadgeClasses(modality)} variant="secondary">
      {modality}
    </Badge>
  )
}

function RatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" data-testid="rating-display">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
        />
      ))}
    </div>
  )
}

function SlotRow({ slot }: { slot: SlotDetail }) {
  return (
    <div className="border-b border-border/50 py-2 last:border-0" data-testid="slot-row">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{slot.exercise_name}</span>
        {slot.is_main && (
          <Badge variant="outline" className="text-[0.6rem] px-1 py-0">main</Badge>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{slot.sets} sets</span>
        <span>{slot.reps} reps</span>
        {slot.weight != null && <span>{slot.weight} kg</span>}
        {slot.rpe != null && <span>RPE {slot.rpe}</span>}
        {slot.rest_seconds != null && <span>{slot.rest_seconds}s rest</span>}
      </div>
      {slot.guidelines && (
        <p className="mt-1 text-xs italic text-muted-foreground">{slot.guidelines}</p>
      )}
    </div>
  )
}

type SnapshotSlot = NonNullable<TemplateSnapshot['slots']>[number]

function CompletedExerciseRow({ exercise, planned }: {
  exercise: LoggedExerciseDetail
  planned?: SnapshotSlot
}) {
  return (
    <div className="border-b border-border/50 py-2 last:border-0" data-testid="completed-exercise-row">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{exercise.exercise_name}</span>
        {planned?.is_main && (
          <Badge variant="outline" className="text-[0.6rem] px-1 py-0">main</Badge>
        )}
      </div>
      {/* Planned targets from snapshot */}
      {planned && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Plan: {planned.sets}x{planned.reps}</span>
          {planned.weight != null && <span>{planned.weight} kg</span>}
          {planned.rpe != null && <span>RPE {planned.rpe}</span>}
        </div>
      )}
      {/* Actual sets */}
      <div className="mt-1.5 space-y-0.5">
        {exercise.sets.map((set) => (
          <div key={set.set_number} className="flex gap-x-4 text-xs" data-testid="actual-set">
            <span className="text-muted-foreground w-10">Set {set.set_number}</span>
            <span>{set.actual_reps ?? '-'} reps</span>
            <span>{set.actual_weight != null ? `${set.actual_weight} kg` : '-'}</span>
          </div>
        ))}
      </div>
      {exercise.actual_rpe != null && (
        <div className="mt-1 text-xs text-muted-foreground">RPE {exercise.actual_rpe}</div>
      )}
    </div>
  )
}

function RunningDetail({ template }: { template: { run_type?: string | null; target_pace?: string | null; hr_zone?: number | null; interval_count?: number | null; interval_rest?: number | null; coaching_cues?: string | null; target_elevation_gain?: number | null } }) {
  return (
    <div className="space-y-2" data-testid="running-detail">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {template.run_type && <span>Type: <strong>{template.run_type}</strong></span>}
        {template.target_pace && <span>Pace: <strong>{template.target_pace}</strong></span>}
        {template.hr_zone != null && <span>HR Zone: <strong>{template.hr_zone}</strong></span>}
        {template.target_elevation_gain != null && <span>Elevation: <strong>{template.target_elevation_gain}m ascent</strong></span>}
        {template.interval_count != null && <span>Intervals: <strong>{template.interval_count}</strong></span>}
        {template.interval_rest != null && <span>Interval rest: <strong>{template.interval_rest}s</strong></span>}
      </div>
      {template.coaching_cues && (
        <p className="text-sm italic text-muted-foreground">{template.coaching_cues}</p>
      )}
    </div>
  )
}

function MmaDetail({ template }: { template: { planned_duration?: number | null } }) {
  return (
    <div data-testid="mma-detail">
      {template.planned_duration != null && (
        <span className="text-sm">Duration: <strong>{template.planned_duration} min</strong></span>
      )}
    </div>
  )
}

// Card body for projected workouts
function ProjectedCardBody({ detail }: { detail: Extract<DayDetailResult, { type: 'projected' }> }) {
  return (
    <div className="space-y-4">
      {detail.template.notes && (
        <p className="text-sm text-muted-foreground">{detail.template.notes}</p>
      )}

      {detail.template.modality === 'resistance' && detail.slots.length > 0 && (
        <div data-testid="resistance-slots">
          {detail.slots.map((slot, i) => (
            <SlotRow key={i} slot={slot} />
          ))}
        </div>
      )}

      {detail.template.modality === 'running' && (
        <RunningDetail template={detail.template} />
      )}

      {detail.template.modality === 'mma' && (
        <MmaDetail template={detail.template} />
      )}
    </div>
  )
}

// Card body for completed workouts
function CompletedCardBody({ detail }: { detail: Extract<DayDetailResult, { type: 'completed' }> }) {
  return (
    <div className="space-y-4">
      {detail.snapshot.notes && (
        <p className="text-sm text-muted-foreground">{detail.snapshot.notes}</p>
      )}

      {detail.rating != null && (
        <div className="flex items-center gap-3">
          <RatingDisplay rating={detail.rating} />
          <span className="text-sm text-muted-foreground">({detail.rating}/5)</span>
        </div>
      )}
      {detail.notes && (
        <p className="text-sm bg-muted/50 rounded p-2">{detail.notes}</p>
      )}

      {detail.exercises.length > 0 && (
        <div data-testid="completed-exercises">
          {detail.exercises.map((ex, i) => {
            const planned = detail.snapshot.slots?.find(
              (s) => s.exercise_name === ex.exercise_name
            )
            return <CompletedExerciseRow key={i} exercise={ex} planned={planned} />
          })}
        </div>
      )}

      {detail.exercises.length === 0 && detail.snapshot.slots && detail.snapshot.slots.length > 0 && (
        <div data-testid="snapshot-slots">
          {detail.snapshot.slots.map((slot, i) => (
            <SlotRow key={i} slot={slot} />
          ))}
        </div>
      )}
    </div>
  )
}

// Get workout name and modality from a non-rest result
function getWorkoutMeta(detail: Exclude<DayDetailResult, { type: 'rest' }>) {
  if (detail.type === 'projected') {
    return { name: detail.template.name, modality: detail.template.modality }
  }
  return { name: detail.snapshot.name ?? 'Workout', modality: detail.snapshot.modality }
}

// Whether a date string (YYYY-MM-DD) is today or in the past
function isLoggable(dateStr: string): boolean {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dateStr <= todayStr
}

function WorkoutCard({
  detail,
  date,
  defaultOpen,
  onMoveWorkout,
  onUndoMove,
}: {
  detail: Exclude<DayDetailResult, { type: 'rest' }>
  date: string
  defaultOpen: boolean
  onMoveWorkout?: (detail: Extract<DayDetailResult, { type: 'projected' }>) => void
  onUndoMove?: (overrideGroup: string, mesocycleId: number) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const { name, modality } = getWorkoutMeta(detail)
  const showLogButton = detail.type === 'projected' && isLoggable(date)
  const isProjected = detail.type === 'projected'
  const canModifySchedule = isProjected && detail.mesocycle_status !== 'completed'
  const isOverride = isProjected && 'is_override' in detail && detail.is_override === true

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="workout-card">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <CollapsibleTrigger
          className="flex flex-1 items-center gap-2 text-left hover:bg-accent/50 -m-1 p-1 rounded transition-colors"
          data-testid="workout-card-trigger"
        >
          <span className="font-semibold text-sm flex-1">{name}</span>
          {modality && <ModalityBadge modality={modality} />}
          {detail.is_deload && <Badge variant="outline">Deload</Badge>}
          {isOverride && (
            <Badge variant="secondary" className="text-[0.65rem] px-1.5 py-0 font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Overridden
            </Badge>
          )}
          <Badge variant="outline" className="text-[0.65rem] px-1.5 py-0 font-medium">
            {periodLabel[detail.period]}
          </Badge>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        {detail.mesocycle_status !== 'completed' && (
          <Link
            href={`/mesocycles/${detail.mesocycle_id}`}
            data-testid="edit-template-link"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Edit template"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        )}
      </div>
      <CollapsibleContent className="px-3 pt-2 pb-1">
        {detail.type === 'projected' && <ProjectedCardBody detail={detail} />}
        {detail.type === 'completed' && <CompletedCardBody detail={detail} />}
      </CollapsibleContent>
      {showLogButton && (
        <div className="px-3 pt-2 pb-1">
          <Button asChild variant="default" size="sm" className="w-full" data-testid="log-workout-button">
            <Link href={`/?date=${date}`}>
              <ClipboardCheck className="h-4 w-4 mr-1.5" />
              Log Workout
            </Link>
          </Button>
        </div>
      )}
      {/* Move + Undo actions for projected workouts */}
      {canModifySchedule && (
        <div className="px-3 pt-1 pb-1 flex gap-2">
          {isOverride && detail.type === 'projected' && detail.override_group && onUndoMove && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              data-testid="undo-move-button"
              onClick={() => onUndoMove(detail.override_group!, detail.mesocycle_id)}
            >
              <Undo2 className="h-4 w-4 mr-1.5" />
              Undo Move
            </Button>
          )}
          {detail.type === 'projected' && onMoveWorkout && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              data-testid="move-workout-button"
              onClick={() => onMoveWorkout(detail)}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />
              Move Workout
            </Button>
          )}
        </div>
      )}
    </Collapsible>
  )
}

export function DayDetailPanel({ date, onClose, onMutate }: DayDetailPanelProps) {
  const [details, setDetails] = useState<DayDetailResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState<Extract<DayDetailResult, { type: 'projected' }> | null>(null)

  const fetchDetail = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/day?date=${d}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDetails(Array.isArray(data) ? data : [data])
    } catch {
      setError('Failed to load day detail')
      setDetails([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (date) {
      fetchDetail(date)
    } else {
      setDetails([])
    }
  }, [date, fetchDetail])

  const handleUndoMove = useCallback(async (overrideGroup: string, mesocycleId: number) => {
    const result = await undoScheduleMove(overrideGroup, mesocycleId)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (date) fetchDetail(date)
    onMutate?.()
  }, [date, fetchDetail, onMutate])

  const handleMoveWorkout = useCallback((detail: Extract<DayDetailResult, { type: 'projected' }>) => {
    setMoveTarget(detail)
  }, [])

  const handleMoveConfirm = useCallback(async (params: {
    targetDay: number
    targetTimeSlot: string
    targetDuration: number
    scope: 'this_week' | 'remaining_weeks'
    targetWeekOffset: number
  }) => {
    if (!moveTarget || !moveTarget.schedule_entry_id) return
    try {
      const { moveWorkout } = await import('@/lib/schedule/override-actions')
      const result = await moveWorkout({
        mesocycle_id: moveTarget.mesocycle_id,
        week_number: moveTarget.week_number,
        schedule_id: moveTarget.schedule_entry_id,
        target_day: params.targetDay,
        target_time_slot: params.targetTimeSlot,
        target_duration: params.targetDuration,
        scope: params.scope,
        target_week_offset: params.targetWeekOffset,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setMoveTarget(null)
      if (date) fetchDetail(date)
      onMutate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move workout')
    }
  }, [moveTarget, date, fetchDetail, onMutate])

  const open = date !== null

  // Separate rest entries from workouts
  const restEntry = details.find((d) => d.type === 'rest')
  const workouts = details
    .filter((d): d is Exclude<DayDetailResult, { type: 'rest' }> => d.type !== 'rest')
    .sort((a, b) => periodOrder[a.period] - periodOrder[b.period])

  const isRestDay = details.length > 0 && workouts.length === 0
  const isSingleWorkout = workouts.length === 1

  // Build occupied slots for MoveWorkoutModal
  const occupiedSlots: OccupiedSlot[] = workouts
    .filter((w): w is Extract<DayDetailResult, { type: 'projected' }> => w.type === 'projected' && 'day_of_week' in w)
    .map((w) => ({
      day: w.day_of_week,
      timeSlot: w.time_slot ?? '07:00',
      duration: w.duration ?? 60,
      templateName: w.template.name,
    }))

  // Sheet description text
  let description = ''
  if (isRestDay) description = 'Rest Day'
  else if (workouts.length === 1) {
    description = workouts[0].type === 'projected' ? 'Projected workout' : 'Completed workout'
  } else if (workouts.length > 1) {
    description = `${workouts.length} workouts`
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="overflow-y-auto" data-testid="day-detail-panel">
        <SheetHeader>
          <SheetTitle>{date ? formatDateLong(date) : ''}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Rest day */}
          {isRestDay && restEntry?.type === 'rest' && (
            <div data-testid="rest-day-message" className="py-8 text-center">
              <p className="text-lg font-medium text-muted-foreground">Rest Day</p>
              <p className="text-sm text-muted-foreground mt-1">No workout scheduled</p>
              {restEntry.mesocycle_id != null && restEntry.mesocycle_status !== 'completed' && (
                <Link
                  href={`/mesocycles/${restEntry.mesocycle_id}`}
                  data-testid="schedule-link"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CalendarDays className="h-4 w-4" />
                  View schedule
                </Link>
              )}
            </div>
          )}

          {/* Workout cards */}
          {workouts.length > 0 && (
            <div className="space-y-3">
              {workouts.map((w, i) => (
                <WorkoutCard
                  key={`${w.type}-${w.period}`}
                  detail={w}
                  date={date!}
                  defaultOpen={isSingleWorkout}
                  onMoveWorkout={handleMoveWorkout}
                  onUndoMove={handleUndoMove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Move Workout Modal */}
        {moveTarget && (
          <MoveWorkoutModal
            open={!!moveTarget}
            onOpenChange={(isOpen) => { if (!isOpen) setMoveTarget(null) }}
            mesocycleId={moveTarget.mesocycle_id}
            weekNumber={moveTarget.week_number}
            sourceDay={moveTarget.day_of_week}
            sourceTimeSlot={moveTarget.time_slot}
            sourceDuration={moveTarget.duration}
            sourceTemplateName={moveTarget.template.name}
            occupiedSlots={occupiedSlots}
            onConfirm={handleMoveConfirm}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
