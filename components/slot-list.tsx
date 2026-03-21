'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ExercisePicker } from '@/components/exercise-picker'
import { SlotCascadeScopeSelector } from '@/components/slot-cascade-scope-selector'
import { updateExerciseSlot, removeExerciseSlot, addExerciseSlot, reorderExerciseSlots } from '@/lib/templates/slot-actions'
import { createSuperset, breakSuperset, updateGroupRest } from '@/lib/templates/superset-actions'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'
import type { Exercise } from '@/lib/exercises/filters'

type SlotListProps = {
  slots: SlotWithExercise[]
  templateId: number
  exercises: Exercise[]
  isCompleted: boolean
}

function getGroupLabel(count: number): string {
  if (count === 2) return 'Superset'
  if (count === 3) return 'Tri-set'
  return 'Giant set'
}

function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

type GroupedItem =
  | { type: 'slot'; slot: SlotWithExercise }
  | { type: 'group'; groupId: number; slots: SlotWithExercise[]; groupRestSeconds: number }

// Groups contiguous slots by group_id, preserving order
function groupSlots(slots: SlotWithExercise[]): GroupedItem[] {
  const items: GroupedItem[] = []
  let i = 0
  while (i < slots.length) {
    const slot = slots[i]
    if (slot.group_id !== null) {
      const groupId = slot.group_id
      const groupSlots: SlotWithExercise[] = []
      while (i < slots.length && slots[i].group_id === groupId) {
        groupSlots.push(slots[i])
        i++
      }
      items.push({
        type: 'group',
        groupId,
        slots: groupSlots,
        groupRestSeconds: groupSlots[0].group_rest_seconds ?? 0,
      })
    } else {
      items.push({ type: 'slot', slot })
      i++
    }
  }
  return items
}

export function SlotList({ slots, templateId, exercises, isCompleted }: SlotListProps) {
  const router = useRouter()
  const [showPicker, setShowPicker] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [orderedSlots, setOrderedSlots] = useState(slots)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  // Cascade state for add-slot operation
  const [addCascadeSlotId, setAddCascadeSlotId] = useState<number | null>(null)

  // Selection mode for superset creation
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<number>>(new Set())
  const [showGroupRestPrompt, setShowGroupRestPrompt] = useState(false)
  const [groupRestInput, setGroupRestInput] = useState<number | ''>(60)
  const [supersetError, setSupersetError] = useState('')

  // Touch drag state
  const touchDragIndex = useRef<number | null>(null)
  const touchHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Sync props to local state when slots change from server
  useEffect(() => {
    setOrderedSlots(slots)
  }, [slots])

  const canDrag = !isCompleted && orderedSlots.length > 1 && !isReordering && !selectionMode

  // Count ungrouped slots for showing the Group button
  const ungroupedSlots = orderedSlots.filter(s => s.group_id === null)
  const showGroupButton = !isCompleted && ungroupedSlots.length >= 2 && !selectionMode

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
  function handleTouchStart(_e: React.TouchEvent, index: number) {
    if (!canDrag) return
    touchHoldTimer.current = setTimeout(() => {
      touchDragIndex.current = index
      setDragIndex(index)
    }, 300)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchDragIndex.current === null) {
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
        setAddCascadeSlotId(result.data.id)
      }
    })
  }

  function toggleSlotSelection(slotId: number) {
    setSelectedSlotIds(prev => {
      const next = new Set(prev)
      if (next.has(slotId)) {
        next.delete(slotId)
      } else {
        next.add(slotId)
      }
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedSlotIds(new Set())
    setShowGroupRestPrompt(false)
    setGroupRestInput(60)
    setSupersetError('')
  }

  function handleCreateSupersetClick() {
    setShowGroupRestPrompt(true)
    setSupersetError('')
  }

  function handleConfirmSuperset() {
    const restValue = groupRestInput === '' ? 0 : groupRestInput
    startTransition(async () => {
      const result = await createSuperset({
        slot_ids: Array.from(selectedSlotIds),
        group_rest_seconds: restValue,
      })
      if (result.success) {
        exitSelectionMode()
        router.refresh()
      } else {
        setSupersetError(result.error)
      }
    })
  }

  async function handleBreakSuperset(groupId: number) {
    startTransition(async () => {
      const result = await breakSuperset({
        group_id: groupId,
        template_id: templateId,
      })
      if (result.success) {
        router.refresh()
      }
    })
  }

  // Empty state (not shown during cascade)
  if (orderedSlots.length === 0 && !showPicker && addCascadeSlotId === null) {
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

  const grouped = groupSlots(orderedSlots)

  return (
    <div className="space-y-2" ref={listRef}>
      {/* Selection mode toolbar */}
      {selectionMode && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedSlotIds.size} selected
          </span>
          <div className="ml-auto flex gap-2">
            {selectedSlotIds.size >= 2 && !showGroupRestPrompt && (
              <Button size="sm" variant="default" onClick={handleCreateSupersetClick}>
                Create Superset
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={exitSelectionMode}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Group rest prompt */}
      {showGroupRestPrompt && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="group-rest-input">Group rest (seconds)</Label>
            <Input
              id="group-rest-input"
              type="number"
              min={0}
              value={groupRestInput}
              onChange={(e) => setGroupRestInput(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          {supersetError && (
            <p className="text-sm text-destructive" role="alert">{supersetError}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleConfirmSuperset} disabled={isPending}>
              {isPending ? 'Creating...' : 'Confirm'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowGroupRestPrompt(false)}>
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Slot list with grouping */}
      {grouped.map((item) => {
        if (item.type === 'group') {
          return (
            <SupersetGroup
              key={`group-${item.groupId}`}
              groupId={item.groupId}
              slots={item.slots}
              groupRestSeconds={item.groupRestSeconds}
              templateId={templateId}
              isCompleted={isCompleted}
              onUpdated={() => router.refresh()}
              onBreak={() => handleBreakSuperset(item.groupId)}
              canDrag={canDrag}
              dragIndex={dragIndex}
              dropIndex={dropIndex}
              allSlots={orderedSlots}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
          )
        }
        const slot = item.slot
        const flatIndex = orderedSlots.indexOf(slot)
        return (
          <div key={slot.id} className="flex items-start gap-2">
            {selectionMode && slot.group_id === null && (
              <div className="flex items-center pt-3.5">
                <Checkbox
                  checked={selectedSlotIds.has(slot.id)}
                  onCheckedChange={() => toggleSlotSelection(slot.id)}
                  aria-label={`Select ${slot.exercise_name}`}
                />
              </div>
            )}
            <div className="flex-1">
              <SlotRow
                slot={slot}
                templateId={templateId}
                isCompleted={isCompleted}
                onUpdated={() => router.refresh()}
                showDragHandle={canDrag}
                isDragging={dragIndex === flatIndex}
                isDropTarget={dropIndex === flatIndex}
                onDragStart={() => handleDragStart(flatIndex)}
                onDragOver={(e: React.DragEvent) => handleDragOver(e, flatIndex)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e: React.TouchEvent) => handleTouchStart(e, flatIndex)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            </div>
          </div>
        )
      })}

      {/* Action buttons */}
      {!isCompleted && !showPicker && !selectionMode && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowPicker(true)}
          >
            Add Exercise
          </Button>
          {showGroupButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
            >
              Group
            </Button>
          )}
        </div>
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

      {addCascadeSlotId !== null && (
        <SlotCascadeScopeSelector
          templateId={templateId}
          operation="add-slot"
          sourceSlotId={addCascadeSlotId}
          onComplete={() => { setAddCascadeSlotId(null); router.refresh() }}
          onCancel={() => { setAddCascadeSlotId(null); router.refresh() }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Superset group container
// ============================================================================

type SupersetGroupProps = {
  groupId: number
  slots: SlotWithExercise[]
  groupRestSeconds: number
  templateId: number
  isCompleted: boolean
  onUpdated: () => void
  onBreak: () => void
  canDrag: boolean
  dragIndex: number | null
  dropIndex: number | null
  allSlots: SlotWithExercise[]
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onTouchStart: (e: React.TouchEvent, index: number) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
}

function SupersetGroup({
  groupId, slots, groupRestSeconds, templateId, isCompleted,
  onUpdated, onBreak, canDrag, dragIndex, dropIndex, allSlots,
  onDragStart, onDragOver, onDragEnd, onTouchStart, onTouchMove, onTouchEnd,
}: SupersetGroupProps) {
  const [editingRest, setEditingRest] = useState(false)
  const [restInput, setRestInput] = useState(groupRestSeconds)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const label = getGroupLabel(slots.length)

  function handleSaveRest() {
    startTransition(async () => {
      const result = await updateGroupRest({
        group_id: groupId,
        template_id: templateId,
        group_rest_seconds: restInput,
      })
      if (result.success) {
        setEditingRest(false)
        router.refresh()
      }
    })
  }

  return (
    <div
      data-testid={`superset-group-${groupId}`}
      className="rounded-xl border-l-4 border-l-primary border border-border pl-3 py-2 pr-2 space-y-1"
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold text-primary">{label}</span>
        {!isCompleted && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => { setRestInput(groupRestSeconds); setEditingRest(true) }}
            >
              Edit rest
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onBreak}
            >
              Break
            </Button>
          </div>
        )}
      </div>

      {/* Edit group rest inline */}
      {editingRest && (
        <div className="rounded-lg border bg-muted/30 p-2 space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`group-rest-${groupId}`}>Group rest (seconds)</Label>
            <Input
              id={`group-rest-${groupId}`}
              type="number"
              min={0}
              value={restInput}
              onChange={(e) => setRestInput(Number(e.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveRest} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingRest(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Grouped slot rows */}
      {slots.map((slot) => {
        const flatIndex = allSlots.indexOf(slot)
        return (
          <SlotRow
            key={slot.id}
            slot={slot}
            templateId={templateId}
            isCompleted={isCompleted}
            onUpdated={onUpdated}
            showDragHandle={canDrag}
            isDragging={dragIndex === flatIndex}
            isDropTarget={dropIndex === flatIndex}
            onDragStart={() => onDragStart(flatIndex)}
            onDragOver={(e: React.DragEvent) => onDragOver(e, flatIndex)}
            onDragEnd={onDragEnd}
            onTouchStart={(e: React.TouchEvent) => onTouchStart(e, flatIndex)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        )
      })}

      {/* Group rest display */}
      {groupRestSeconds > 0 && !editingRest && (
        <div className="px-1 pt-1 text-xs text-muted-foreground">
          <span className="font-medium">Group rest:</span> {formatRest(groupRestSeconds)}
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
  templateId: number
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
  slot, templateId, isCompleted, onUpdated,
  showDragHandle, isDragging, isDropTarget,
  onDragStart, onDragOver, onDragEnd,
  onTouchStart, onTouchMove, onTouchEnd,
}: SlotRowProps) {
  const [mode, setMode] = useState<'display' | 'edit' | 'confirm-remove' | 'cascade-params' | 'cascade-remove'>('display')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [pendingParamUpdates, setPendingParamUpdates] = useState<Record<string, unknown>>({})

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
    const diff: Record<string, unknown> = {}
    if (sets !== slot.sets) diff.sets = sets
    if (reps !== Number(slot.reps)) diff.reps = reps
    const weightVal = weight === '' ? null : weight
    if (weightVal !== slot.weight) diff.weight = weightVal
    const rpeVal = rpe === '' ? null : rpe
    if (rpeVal !== slot.rpe) diff.rpe = rpeVal
    const restVal = restSeconds === '' ? null : restSeconds
    if (restVal !== slot.rest_seconds) diff.rest_seconds = restVal
    const guidelinesVal = guidelines || null
    if (guidelinesVal !== slot.guidelines) diff.guidelines = guidelinesVal

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
        if (Object.keys(diff).length > 0) {
          setPendingParamUpdates(diff)
          setMode('cascade-params')
        } else {
          setMode('display')
          onUpdated()
        }
      } else {
        setError(result.error)
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeExerciseSlot(slot.id)
      if (result.success) {
        setMode('cascade-remove')
      } else {
        setError(result.error)
        setMode('display')
      }
    })
  }

  // Cascade mode for param edits
  if (mode === 'cascade-params') {
    return (
      <div data-testid="slot-row">
        <SlotCascadeScopeSelector
          templateId={templateId}
          operation="update-params"
          slotId={slot.id}
          paramUpdates={pendingParamUpdates}
          onComplete={() => { setMode('display'); onUpdated() }}
          onCancel={() => { setMode('display'); onUpdated() }}
        />
      </div>
    )
  }

  // Cascade mode for slot removal
  if (mode === 'cascade-remove') {
    return (
      <div data-testid="slot-row">
        <SlotCascadeScopeSelector
          templateId={templateId}
          operation="remove-slot"
          sourceExerciseId={slot.exercise_id}
          sourceOrder={slot.order}
          onComplete={() => { setMode('display'); onUpdated() }}
          onCancel={() => { setMode('display'); onUpdated() }}
        />
      </div>
    )
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
