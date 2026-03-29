'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'
import { DAY_LABELS, internalToDisplay, displayToInternal } from '@/lib/day-mapping'

type Scope = 'this_week' | 'remaining_weeks'

export interface OccupiedSlot {
  day: number // internal convention (0=Mon)
  timeSlot: string // "HH:MM"
  duration: number // minutes
  templateName: string
}

export interface MoveWorkoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mesocycleId: number
  weekNumber: number
  sourceDay: number // internal convention (0=Mon)
  sourceTimeSlot: string | null
  sourceDuration: number | null
  sourceTemplateName: string
  occupiedSlots: OccupiedSlot[]
  onConfirm: (params: {
    targetDay: number // internal convention (0=Mon)
    targetTimeSlot: string
    targetDuration: number
    scope: Scope
    targetWeekOffset: number
  }) => void
}

// Convert "HH:MM" to total minutes from midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Check if two time ranges overlap
function rangesOverlap(
  startA: number, durationA: number,
  startB: number, durationB: number
): boolean {
  const endA = startA + durationA
  const endB = startB + durationB
  return startA < endB && startB < endA
}

export function MoveWorkoutModal(props: MoveWorkoutModalProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && <MoveWorkoutModalContent {...props} />}
    </Dialog>
  )
}

function MoveWorkoutModalContent({
  sourceDay,
  sourceTimeSlot,
  sourceDuration,
  sourceTemplateName,
  occupiedSlots,
  onConfirm,
  onOpenChange,
}: MoveWorkoutModalProps) {
  const [targetDay, setTargetDay] = useState<number | null>(null)
  const [timeSlot, setTimeSlot] = useState(sourceTimeSlot ?? '07:00')
  const [duration, setDuration] = useState(sourceDuration ?? 60)
  const [scope, setScope] = useState<Scope>('this_week')
  const [weekOffset, setWeekOffset] = useState(0)

  // Find overlapping workouts on the target day
  const overlappingWorkouts = useMemo(() => {
    if (targetDay === null || !timeSlot || weekOffset !== 0) return []
    const targetStart = timeToMinutes(timeSlot)
    return occupiedSlots.filter(
      (s) => s.day === targetDay && rangesOverlap(targetStart, duration, timeToMinutes(s.timeSlot), s.duration)
    )
  }, [targetDay, timeSlot, duration, occupiedSlots, weekOffset])

  const canConfirm = targetDay !== null && !!timeSlot && duration > 0

  function handleConfirm() {
    if (targetDay === null || !timeSlot) return
    onConfirm({
      targetDay,
      targetTimeSlot: timeSlot,
      targetDuration: duration,
      scope,
      targetWeekOffset: weekOffset,
    })
  }

  return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {sourceTemplateName}</DialogTitle>
          <DialogDescription>
            Choose a new day and time for this workout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Week offset toggle */}
          <div className="space-y-2">
            <Label>Target week</Label>
            <div className="flex gap-1">
              {([
                { offset: -1, label: '← Prev week' },
                { offset: 0, label: 'This week' },
                { offset: 1, label: 'Next week →' },
              ] as const).map(({ offset, label }) => (
                <Button
                  key={offset}
                  variant={weekOffset === offset ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setWeekOffset(offset); setTargetDay(null) }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Day picker */}
          <div className="space-y-2">
            <Label>Target day</Label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, displayIdx) => {
                const internalDay = displayToInternal(displayIdx)
                const isSource = weekOffset === 0 && internalDay === sourceDay
                const isSelected = targetDay === internalDay
                return (
                  <Button
                    key={label}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={isSource}
                    onClick={() => setTargetDay(internalDay)}
                    className="flex-1 px-0"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Time + duration + scope shown after day selection */}
          {targetDay !== null && (
            <>
              {/* Time slot input */}
              <div className="space-y-2">
                <Label htmlFor="move-time-slot">Time</Label>
                <Input
                  id="move-time-slot"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  placeholder="e.g. 07:00"
                />
              </div>

              {/* Duration input */}
              <div className="space-y-2">
                <Label htmlFor="move-duration">Duration (min)</Label>
                <Input
                  id="move-duration"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                />
              </div>

              {/* Overlap warning (non-blocking) */}
              {overlappingWorkouts.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Time overlap with {overlappingWorkouts.map((w) => w.templateName).join(', ')}. Both will appear on this day.
                </div>
              )}

              {/* Scope radio */}
              <fieldset className="space-y-2">
                <Label asChild><legend>Apply to</legend></Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      role="radio"
                      aria-label="This week only"
                      value="this_week"
                      checked={scope === 'this_week'}
                      onChange={() => setScope('this_week')}
                      className="accent-primary"
                    />
                    <span className="text-sm">This week only</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      role="radio"
                      aria-label="This week + remaining"
                      value="remaining_weeks"
                      checked={scope === 'remaining_weeks'}
                      onChange={() => setScope('remaining_weeks')}
                      className="accent-primary"
                    />
                    <span className="text-sm">This week + remaining</span>
                  </label>
                </div>
              </fieldset>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canConfirm} onClick={handleConfirm}>
            Move workout
          </Button>
        </DialogFooter>
      </DialogContent>
  )
}
