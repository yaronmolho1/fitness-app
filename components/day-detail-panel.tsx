'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Pencil, CalendarDays, Star } from 'lucide-react'
import type { DayDetailResult, SlotDetail, LoggedExerciseDetail, TemplateSnapshot } from '@/lib/calendar/day-detail'
import { formatDateLong } from '@/lib/date-format'
import { getModalityBadgeClasses } from '@/lib/ui/modality-colors'

interface DayDetailPanelProps {
  date: string | null
  onClose: () => void
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

function RunningDetail({ template }: { template: { run_type?: string | null; target_pace?: string | null; hr_zone?: number | null; interval_count?: number | null; interval_rest?: number | null; coaching_cues?: string | null } }) {
  return (
    <div className="space-y-2" data-testid="running-detail">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {template.run_type && <span>Type: <strong>{template.run_type}</strong></span>}
        {template.target_pace && <span>Pace: <strong>{template.target_pace}</strong></span>}
        {template.hr_zone != null && <span>HR Zone: <strong>{template.hr_zone}</strong></span>}
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

export function DayDetailPanel({ date, onClose }: DayDetailPanelProps) {
  const [detail, setDetail] = useState<DayDetailResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/day?date=${d}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDetail(data)
    } catch {
      setError('Failed to load day detail')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (date) {
      fetchDetail(date)
    } else {
      setDetail(null)
    }
  }, [date, fetchDetail])

  const open = date !== null

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="overflow-y-auto" data-testid="day-detail-panel">
        <SheetHeader>
          <SheetTitle>{date ? formatDateLong(date) : ''}</SheetTitle>
          <SheetDescription>
            {detail?.type === 'rest' && 'Rest Day'}
            {detail?.type === 'projected' && 'Projected workout'}
            {detail?.type === 'completed' && 'Completed workout'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Rest day */}
          {detail?.type === 'rest' && (
            <div data-testid="rest-day-message" className="py-8 text-center">
              <p className="text-lg font-medium text-muted-foreground">Rest Day</p>
              <p className="text-sm text-muted-foreground mt-1">No workout scheduled</p>
              {detail.mesocycle_id != null && detail.mesocycle_status !== 'completed' && (
                <Link
                  href={`/mesocycles/${detail.mesocycle_id}`}
                  data-testid="schedule-link"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CalendarDays className="h-4 w-4" />
                  View schedule
                </Link>
              )}
            </div>
          )}

          {/* Projected day */}
          {detail?.type === 'projected' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{detail.template.name}</h3>
                <ModalityBadge modality={detail.template.modality} />
                {detail.is_deload && <Badge variant="outline">Deload</Badge>}
                {detail.mesocycle_status !== 'completed' && (
                  <Link
                    href={`/mesocycles/${detail.mesocycle_id}`}
                    data-testid="edit-template-link"
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit template"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {detail.template.notes && (
                <p className="text-sm text-muted-foreground">{detail.template.notes}</p>
              )}

              {/* Resistance: show slots */}
              {detail.template.modality === 'resistance' && detail.slots.length > 0 && (
                <div data-testid="resistance-slots">
                  {detail.slots.map((slot, i) => (
                    <SlotRow key={i} slot={slot} />
                  ))}
                </div>
              )}

              {/* Running */}
              {detail.template.modality === 'running' && (
                <RunningDetail template={detail.template} />
              )}

              {/* MMA */}
              {detail.template.modality === 'mma' && (
                <MmaDetail template={detail.template} />
              )}
            </div>
          )}

          {/* Completed day */}
          {detail?.type === 'completed' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{detail.snapshot.name ?? 'Workout'}</h3>
                {detail.snapshot.modality && <ModalityBadge modality={detail.snapshot.modality} />}
                {detail.is_deload && <Badge variant="outline">Deload</Badge>}
                {detail.mesocycle_status !== 'completed' && (
                  <Link
                    href={`/mesocycles/${detail.mesocycle_id}`}
                    data-testid="edit-template-link"
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit template"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {detail.snapshot.notes && (
                <p className="text-sm text-muted-foreground">{detail.snapshot.notes}</p>
              )}

              {/* Rating + notes */}
              {detail.rating != null && (
                <div className="flex items-center gap-3">
                  <RatingDisplay rating={detail.rating} />
                  <span className="text-sm text-muted-foreground">({detail.rating}/5)</span>
                </div>
              )}
              {detail.notes && (
                <p className="text-sm bg-muted/50 rounded p-2">{detail.notes}</p>
              )}

              {/* Exercises with actuals */}
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

              {/* If snapshot has slots but no logged exercises (running/mma) */}
              {detail.exercises.length === 0 && detail.snapshot.slots && detail.snapshot.slots.length > 0 && (
                <div data-testid="snapshot-slots">
                  {detail.snapshot.slots.map((slot, i) => (
                    <SlotRow key={i} slot={slot} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
