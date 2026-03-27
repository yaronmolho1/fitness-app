'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

type Period = 'morning' | 'afternoon' | 'evening'
type Scope = 'this_week' | 'remaining_weeks'

export interface OccupiedSlot {
  day: number
  period: Period
  templateName: string
}

export interface MoveWorkoutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mesocycleId: number
  weekNumber: number
  sourceDay: number
  sourcePeriod: Period
  sourceTimeSlot: string | null
  sourceTemplateName: string
  occupiedSlots: OccupiedSlot[]
  onConfirm: (params: {
    targetDay: number
    targetPeriod: Period
    targetTimeSlot: string | null
    scope: Scope
  }) => void
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function MoveWorkoutModal({
  open,
  onOpenChange,
  sourceDay,
  sourceTimeSlot,
  sourceTemplateName,
  occupiedSlots,
  onConfirm,
}: MoveWorkoutModalProps) {
  const [targetDay, setTargetDay] = useState<number | null>(null)
  const [targetPeriod, setTargetPeriod] = useState<Period>('morning')
  const [timeSlot, setTimeSlot] = useState(sourceTimeSlot ?? '')
  const [scope, setScope] = useState<Scope>('this_week')

  useEffect(() => {
    if (open) {
      setTargetDay(null)
      setTargetPeriod('morning')
      setTimeSlot(sourceTimeSlot ?? '')
      setScope('this_week')
    }
  }, [open, sourceTimeSlot])

  // Days where all 3 periods are occupied
  const fullyOccupiedDays = useMemo(() => {
    const counts = new Map<number, number>()
    for (const slot of occupiedSlots) {
      counts.set(slot.day, (counts.get(slot.day) ?? 0) + 1)
    }
    const result = new Set<number>()
    for (const [day, count] of counts) {
      if (count >= 3) result.add(day)
    }
    return result
  }, [occupiedSlots])

  // Check if current target selection has existing workout
  const targetOccupied = useMemo(() => {
    if (targetDay === null) return null
    return occupiedSlots.find(
      (s) => s.day === targetDay && s.period === targetPeriod
    ) ?? null
  }, [targetDay, targetPeriod, occupiedSlots])

  const canConfirm = targetDay !== null

  function handleConfirm() {
    if (targetDay === null) return
    onConfirm({
      targetDay,
      targetPeriod,
      targetTimeSlot: timeSlot || null,
      scope,
    })
  }

  function getOccupiedTemplate(day: number, period: Period): string | null {
    const slot = occupiedSlots.find((s) => s.day === day && s.period === period)
    return slot?.templateName ?? null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {sourceTemplateName}</DialogTitle>
          <DialogDescription>
            Choose a new day, period, and time for this workout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Day picker */}
          <div className="space-y-2">
            <Label>Target day</Label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => {
                const isSource = i === sourceDay
                const isFullyOccupied = fullyOccupiedDays.has(i)
                const isSelected = targetDay === i
                return (
                  <Button
                    key={label}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={isSource || isFullyOccupied}
                    onClick={() => setTargetDay(i)}
                    className="flex-1 px-0"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Period + time + scope only shown after day selection */}
          {targetDay !== null && (
            <>
              {/* Period selector */}
              <fieldset className="space-y-2">
                <Label asChild><legend>Period</legend></Label>
                <div className="flex flex-col gap-2">
                  {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                    const occupied = getOccupiedTemplate(targetDay, period)
                    return (
                      <label
                        key={period}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                          targetPeriod === period && 'border-primary bg-primary/5'
                        )}
                      >
                        <input
                          type="radio"
                          name="period"
                          role="radio"
                          aria-label={period}
                          value={period}
                          checked={targetPeriod === period}
                          onChange={() => setTargetPeriod(period)}
                          className="accent-primary"
                        />
                        <span className="capitalize text-sm font-medium">{period}</span>
                        {occupied && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            occupied — {occupied}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {/* Warning for occupied target */}
              {targetOccupied && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  This period already has a workout ({targetOccupied.templateName}). Both will appear on this day.
                </div>
              )}

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
    </Dialog>
  )
}
