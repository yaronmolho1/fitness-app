'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export type SlotData = {
  id: number
  exercise_name: string
  sets: number
  reps: string
  weight: number | null
  rpe: number | null
  rest_seconds: number | null
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
  return slots.map((slot) =>
    Array.from({ length: slot.sets }, () => ({
      weight: slot.weight !== null ? String(slot.weight) : '',
      reps: slot.reps,
    }))
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function WorkoutLoggingForm({ data }: { data: WorkoutData }) {
  const sortedSlots = [...data.slots].sort((a, b) => a.order - b.order)
  const [sets, setSets] = useState<SetFormData[][]>(() =>
    buildInitialSets(sortedSlots)
  )

  function updateSet(
    slotIndex: number,
    setIndex: number,
    field: keyof SetFormData,
    value: string
  ) {
    setSets((prev) => {
      const next = prev.map((s) => s.map((r) => ({ ...r })))
      next[slotIndex][setIndex][field] = value
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
            {formatDate(data.date)}
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          {data.template.name}
        </h1>
      </div>

      {/* Exercise sections */}
      {sortedSlots.length > 0 ? (
        sortedSlots.map((slot, slotIndex) => (
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
              <h2 className="text-base font-semibold leading-tight">
                {slot.exercise_name}
              </h2>
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

            {/* Column headers */}
            <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 px-4 pb-1">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                Set
              </div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                Weight
              </div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">
                Reps
              </div>
            </div>

            {/* Set rows */}
            <div className="space-y-1.5 px-4 pb-4">
              {sets[slotIndex]?.map((setData, setIndex) => (
                <div
                  key={setIndex}
                  data-testid="set-row"
                  className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 items-center"
                >
                  {/* Set number */}
                  <div className="flex h-10 items-center justify-center rounded-lg bg-muted/60 text-sm font-bold tabular-nums text-muted-foreground">
                    {setIndex + 1}
                  </div>

                  {/* Weight input */}
                  <input
                    data-testid={`weight-input-${slotIndex}-${setIndex}`}
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={setData.weight}
                    onChange={(e) =>
                      updateSet(slotIndex, setIndex, 'weight', e.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-center text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />

                  {/* Reps input */}
                  <input
                    data-testid={`reps-input-${slotIndex}-${setIndex}`}
                    type="text"
                    inputMode="numeric"
                    placeholder="—"
                    value={setData.reps}
                    onChange={(e) =>
                      updateSet(slotIndex, setIndex, 'reps', e.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-center text-base font-medium tabular-nums placeholder:text-muted-foreground/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No exercises configured for this template yet.
          </p>
        </div>
      )}

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm p-4 safe-area-pb">
        <button
          type="button"
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-all hover:bg-primary/90"
        >
          Save Workout
        </button>
      </div>
    </div>
  )
}
