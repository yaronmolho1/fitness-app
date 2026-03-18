'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ExercisePicker } from '@/components/exercise-picker'
import { updateExerciseSlot, removeExerciseSlot, addExerciseSlot, reorderExerciseSlots } from '@/lib/templates/slot-actions'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'
import type { Exercise } from '@/lib/exercises/filters'

type SlotListProps = {
  slots: SlotWithExercise[]
  templateId: number
  exercises: Exercise[]
  isCompleted: boolean
}

export function SlotList({ slots, templateId, exercises, isCompleted }: SlotListProps) {
  const router = useRouter()
  const [showPicker, setShowPicker] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [orderedSlots, setOrderedSlots] = useState(slots)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  // Touch drag state
  const touchDragIndex = useRef<number | null>(null)
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sync props to local state when slots change from server
  useEffect(() => {
    setOrderedSlots(slots)
  }, [slots])

  const canDrag = !isCompleted && orderedSlots.length > 1 && !isReordering

  const persistReorder = useCallback((newSlots: SlotWithExercise[]) => {
    const newIds = newSlots.map(s => s.id)
    const oldIds = slots.map(s => s.id)
    const unchanged = newIds.every((id, i) => id === oldIds[i])
    if (unchanged) return

    setIsReordering(true)
    startTransition(async () => {
      const result = await reorderExerciseSlots({
        template_id: templateId,
        slot_ids: newIds,
      })
      setIsReordering(false)
      if (result.success) {
        router.refresh()
      }
    })
  }, [slots, templateId, router, startTransition])

  // Desktop drag handlers
  function handleDragStart(index: number) {
    if (!canDrag) return
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    setDropIndex(index)
  }

  function handleDragEnd() {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newSlots = [...orderedSlots]
      const [moved] = newSlots.splice(dragIndex, 1)
      newSlots.splice(dropIndex, 0, moved)
      setOrderedSlots(newSlots)
      persistReorder(newSlots)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  // Touch drag handlers
  function handleTouchStart(e: React.TouchEvent, index: number) {
    if (!canDrag) return
    // Deliberate hold before initiating drag
    touchHoldTimer.current = setTimeout(() => {
      touchDragIndex.current = index
      setDragIndex(index)
    }, 300)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchDragIndex.current === null) {
      // Cancel hold if moved before timer
      if (touchHoldTimer.current) {
        clearTimeout(touchHoldTimer.current)
        touchHoldTimer.current = null
      }
      return
    }

    e.preventDefault()
    const touch = e.touches[0]
    if (!listRef.current) return

    const rows = listRef.current.querySelectorAll('[data-testid="slot-row"]')
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setDropIndex(i)
        break
      }
    }
  }

  function handleTouchEnd() {
    if (touchHoldTimer.current) {
      clearTimeout(touchHoldTimer.current)
      touchHoldTimer.current = null
    }

    if (touchDragIndex.current !== null && dropIndex !== null && touchDragIndex.current !== dropIndex) {
      const newSlots = [...orderedSlots]
      const [moved] = newSlots.splice(touchDragIndex.current, 1)
      newSlots.splice(dropIndex, 0, moved)
      setOrderedSlots(newSlots)
      persistReorder(newSlots)
    }

    touchDragIndex.current = null
    setDragIndex(null)
    setDropIndex(null)
  }

  function handleExerciseSelected(exercise: Exercise) {
    startTransition(async () => {
      const result = await addExerciseSlot({
        template_id: templateId,
        exercise_id: exercise.id,
        sets: 3,
        reps: 10,
      })
      if (result.success) {
        setShowPicker(false)
        router.refresh()
      }
    })
  }

  // Empty state
  if (orderedSlots.length === 0 && !showPicker) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">No exercises added</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first exercise to define the workout structure.
        </p>
        {!isCompleted && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setShowPicker(true)}
          >
            Add Exercise
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2" ref={listRef}>
      {orderedSlots.map((slot, index) => (
        <SlotRow
          key={slot.id}
          slot={slot}
          isCompleted={isCompleted}
          onUpdated={() => router.refresh()}
          showDragHandle={canDrag}
          isDragging={dragIndex === index}
          isDropTarget={dropIndex === index}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e: React.DragEvent) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          onTouchStart={(e: React.TouchEvent) => handleTouchStart(e, index)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      ))}

      {!isCompleted && !showPicker && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowPicker(true)}
        >
          Add Exercise
        </Button>
      )}

      {showPicker && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Select Exercise</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowPicker(false)}
            >
              Cancel
            </Button>
          </div>
          <ExercisePicker
            exercises={exercises}
            onSelect={handleExerciseSelected}
          />
          {isPending && <p className="text-xs text-muted-foreground">Adding...</p>}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Individual slot row with inline edit + remove confirmation
// ============================================================================

type SlotRowProps = {
  slot: SlotWithExercise
  isCompleted: boolean
  onUpdated: () => void
  showDragHandle?: boolean
  isDragging?: boolean
  isDropTarget?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchMove?: (e: React.TouchEvent) => void
  onTouchEnd?: () => void
}

function SlotRow({
  slot, isCompleted, onUpdated,
  showDragHandle, isDragging, isDropTarget,
  onDragStart, onDragOver, onDragEnd,
  onTouchStart, onTouchMove, onTouchEnd,
}: SlotRowProps) {
  const [mode, setMode] = useState<'display' | 'edit' | 'confirm-remove'>('display')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Edit form state
  const [sets, setSets] = useState(slot.sets)
  const [reps, setReps] = useState(Number(slot.reps))
  const [weight, setWeight] = useState<number | ''>(slot.weight ?? '')
  const [rpe, setRpe] = useState<number | ''>(slot.rpe ?? '')
  const [restSeconds, setRestSeconds] = useState<number | ''>(slot.rest_seconds ?? '')
  const [guidelines, setGuidelines] = useState(slot.guidelines ?? '')

  function resetForm() {
    setSets(slot.sets)
    setReps(Number(slot.reps))
    setWeight(slot.weight ?? '')
    setRpe(slot.rpe ?? '')
    setRestSeconds(slot.rest_seconds ?? '')
    setGuidelines(slot.guidelines ?? '')
    setError('')
  }

  function handleEdit() {
    resetForm()
    setMode('edit')
  }

  function handleCancel() {
    resetForm()
    setMode('display')
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateExerciseSlot({
        id: slot.id,
        sets,
        reps,
        weight: weight === '' ? null : weight,
        rpe: rpe === '' ? null : rpe,
        rest_seconds: restSeconds === '' ? null : restSeconds,
        guidelines: guidelines || null,
      })
      if (result.success) {
        setError('')
        setMode('display')
        onUpdated()
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeExerciseSlot(slot.id)
      if (result.success) {
        onUpdated()
      } else {
        setError(result.error)
        setMode('display')
      }
    })
  }

  function formatRest(seconds: number): string {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
    }
    return `${seconds}s`
  }

  // Edit mode
  if (mode === 'edit') {
    return (
      <div data-testid="slot-row" className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{slot.exercise_name}</span>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`sets-${slot.id}`}>Sets</Label>
            <Input
              id={`sets-${slot.id}`}
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`reps-${slot.id}`}>Reps</Label>
            <Input
              id={`reps-${slot.id}`}
              type="number"
              min={1}
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`weight-${slot.id}`}>Weight (kg)</Label>
            <Input
              id={`weight-${slot.id}`}
              type="number"
              min={0}
              step={0.5}
              value={weight}
              onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rpe-${slot.id}`}>RPE</Label>
            <Input
              id={`rpe-${slot.id}`}
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={rpe}
              onChange={(e) => setRpe(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`rest-${slot.id}`}>Rest (sec)</Label>
            <Input
              id={`rest-${slot.id}`}
              type="number"
              min={0}
              value={restSeconds}
              onChange={(e) => setRestSeconds(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`guidelines-${slot.id}`}>Guidelines</Label>
          <Input
            id={`guidelines-${slot.id}`}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="e.g. Slow eccentric, pause at bottom"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Remove confirmation
  if (mode === 'confirm-remove') {
    return (
      <div data-testid="slot-row" className="rounded-xl border border-destructive/50 p-4 space-y-3">
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <p className="text-sm">
          Remove <strong>{slot.exercise_name}</strong> from this template? This is permanent.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={handleRemove} disabled={isPending}>
            {isPending ? 'Removing...' : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setMode('display'); setError('') }} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Display mode
  return (
    <div
      data-testid="slot-row"
      className={cn(
        'flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-150',
        isDragging && 'opacity-50',
        isDropTarget && 'ring-2 ring-primary'
      )}
      draggable={showDragHandle}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showDragHandle && (
        <div
          data-testid="drag-handle"
          className="mr-3 flex cursor-grab touch-none select-none items-center text-muted-foreground"
          aria-label="Drag to reorder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium">{slot.exercise_name}</span>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{slot.sets}&times;{slot.reps}</span>
          {slot.weight !== null && <span>{slot.weight}kg</span>}
          {slot.rpe !== null && <span>RPE {slot.rpe}</span>}
          {slot.rest_seconds !== null && <span>{formatRest(slot.rest_seconds)}</span>}
        </div>
        {slot.guidelines && (
          <p className="mt-1 text-xs text-muted-foreground italic">{slot.guidelines}</p>
        )}
      </div>
      {!isCompleted && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => setMode('confirm-remove')}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}
