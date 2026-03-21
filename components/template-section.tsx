'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RunningTemplateForm } from '@/components/running-template-form'
import { MmaBjjTemplateForm } from '@/components/mma-bjj-template-form'
import { MixedTemplateForm } from '@/components/mixed-template-form'
import { SlotList } from '@/components/slot-list'
import { CascadeScopeSelector } from '@/components/cascade-scope-selector'
import { SectionHeading } from '@/components/layout/section-heading'
import { createResistanceTemplate, deleteTemplate } from '@/lib/templates/actions'
import type { TemplateOption } from '@/lib/schedule/queries'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'
import type { Exercise } from '@/lib/exercises/filters'

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  exercises: Exercise[]
  slotsByTemplate: Record<number, SlotWithExercise[]>
  isCompleted: boolean
}

export function TemplateSection({ mesocycleId, templates, exercises, slotsByTemplate, isCompleted }: Props) {
  const router = useRouter()
  const [formType, setFormType] = useState<'resistance' | 'running' | 'mma' | 'mixed' | null>(null)
  const [resistanceName, setResistanceName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleCreated() {
    setFormType(null)
    setResistanceName('')
    setError('')
    router.refresh()
  }

  function handleResistanceSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resistanceName.trim()) {
      setError('Name is required')
      return
    }
    startTransition(async () => {
      const result = await createResistanceTemplate({
        name: resistanceName,
        mesocycle_id: mesocycleId,
      })
      if (result.success) {
        handleCreated()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Templates</SectionHeading>
        {!isCompleted && formType === null && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFormType('resistance'); setError('') }}
            >
              + Resistance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFormType('running'); setError('') }}
            >
              + Running
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFormType('mma'); setError('') }}
            >
              + MMA/BJJ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFormType('mixed'); setError('') }}
            >
              + Mixed Workout
            </Button>
          </div>
        )}
      </div>

      {templates.length === 0 && formType === null && (
        <p className="text-sm text-muted-foreground">No templates yet.</p>
      )}

      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              slots={slotsByTemplate[t.id] ?? []}
              exercises={exercises}
              isCompleted={isCompleted}
              onUpdated={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {formType === 'resistance' && (
        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">New Resistance Template</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setFormType(null); setError('') }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
          )}
          <form onSubmit={handleResistanceSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resistance-name">Name</Label>
              <Input
                id="resistance-name"
                value={resistanceName}
                onChange={(e) => setResistanceName(e.target.value)}
                placeholder="e.g. Push A"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </form>
        </div>
      )}

      {formType === 'running' && (
        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">New Running Template</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setFormType(null); setError('') }}
            >
              Cancel
            </Button>
          </div>
          <RunningTemplateForm mesocycleId={mesocycleId} onSuccess={handleCreated} />
        </div>
      )}

      {formType === 'mma' && (
        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">New MMA/BJJ Template</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setFormType(null); setError('') }}
            >
              Cancel
            </Button>
          </div>
          <MmaBjjTemplateForm mesocycleId={mesocycleId} onSuccess={handleCreated} />
        </div>
      )}

      {formType === 'mixed' && (
        <div className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">New Mixed Template</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setFormType(null); setError('') }}
            >
              Cancel
            </Button>
          </div>
          <MixedTemplateForm
            mesocycleId={mesocycleId}
            onSuccess={handleCreated}
            onCancel={() => { setFormType(null); setError('') }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Individual template row with inline edit + delete
// ============================================================================

type TemplateRowProps = {
  template: TemplateOption
  slots: SlotWithExercise[]
  exercises: Exercise[]
  isCompleted: boolean
  onUpdated: () => void
}

const RUN_TYPES = [
  { value: 'easy', label: 'Easy' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'interval', label: 'Interval' },
  { value: 'long', label: 'Long Run' },
  { value: 'race', label: 'Race' },
] as const

const HR_ZONES = [1, 2, 3, 4, 5] as const

type RunType = 'easy' | 'tempo' | 'interval' | 'long' | 'race'

function TemplateRow({ template, slots, exercises, isCompleted, onUpdated }: TemplateRowProps) {
  const [editing, setEditing] = useState(false)
  const [cascading, setCascading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(template.name)
  const [canonicalName, setCanonicalName] = useState(template.canonical_name)
  const [notes, setNotes] = useState(template.notes ?? '')
  // Running fields
  const [runType, setRunType] = useState<RunType | ''>(template.run_type ?? '')
  const [targetPace, setTargetPace] = useState(template.target_pace ?? '')
  const [hrZone, setHrZone] = useState(template.hr_zone?.toString() ?? '')
  const [intervalCount, setIntervalCount] = useState(template.interval_count?.toString() ?? '')
  const [intervalRest, setIntervalRest] = useState(template.interval_rest?.toString() ?? '')
  const [targetDistance, setTargetDistance] = useState(template.target_distance?.toString() ?? '')
  const [targetDuration, setTargetDuration] = useState(template.target_duration?.toString() ?? '')
  const [coachingCues, setCoachingCues] = useState(template.coaching_cues ?? '')
  // MMA fields
  const [plannedDuration, setPlannedDuration] = useState(template.planned_duration?.toString() ?? '')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [pendingUpdates, setPendingUpdates] = useState<import('@/lib/templates/cascade-types').CascadeUpdates>({})

  const canonicalChanged = canonicalName !== template.canonical_name
  const isRunning = template.modality === 'running'
  const isMma = template.modality === 'mma'
  const isInterval = runType === 'interval'

  function buildUpdates(): import('@/lib/templates/cascade-types').CascadeUpdates {
    const updates: import('@/lib/templates/cascade-types').CascadeUpdates = {}

    if (name !== template.name) updates.name = name
    if (notes !== (template.notes ?? '')) updates.notes = notes

    if (isRunning) {
      if (runType && runType !== template.run_type) updates.run_type = runType as RunType
      const newPace = targetPace || null
      if (newPace !== template.target_pace) updates.target_pace = newPace
      const newHrZone = hrZone ? Number(hrZone) : null
      if (newHrZone !== template.hr_zone) updates.hr_zone = newHrZone
      const newIntervalCount = (runType === 'interval' && intervalCount) ? Number(intervalCount) : null
      if (newIntervalCount !== template.interval_count) updates.interval_count = newIntervalCount
      const newIntervalRest = (runType === 'interval' && intervalRest) ? Number(intervalRest) : null
      if (newIntervalRest !== template.interval_rest) updates.interval_rest = newIntervalRest
      const newCues = coachingCues || null
      if (newCues !== template.coaching_cues) updates.coaching_cues = newCues
      const newDistance = targetDistance ? Number(targetDistance) : null
      if (newDistance !== (template.target_distance ?? null)) updates.target_distance = newDistance
      const newDuration = targetDuration ? Number(targetDuration) : null
      if (newDuration !== (template.target_duration ?? null)) updates.target_duration = newDuration
    }

    if (isMma) {
      const newDuration = plannedDuration ? Number(plannedDuration) : null
      if (newDuration !== template.planned_duration) updates.planned_duration = newDuration
    }

    return updates
  }

  function handleSave() {
    if (isRunning) {
      const distanceNum = targetDistance ? Number(targetDistance) : null
      if (distanceNum !== null && distanceNum <= 0) {
        setError('Distance must be positive')
        return
      }
      const durationNum = targetDuration ? Number(targetDuration) : null
      if (durationNum !== null && durationNum <= 0) {
        setError('Duration must be positive')
        return
      }
    }

    setError('')
    const updates = buildUpdates()
    if (Object.keys(updates).length === 0 && !canonicalChanged) {
      setEditing(false)
      return
    }

    setPendingUpdates(updates)
    setEditing(false)
    setCascading(true)
  }

  function handleCascadeComplete() {
    setCascading(false)
    setError('')
    onUpdated()
  }

  function handleCascadeCancel() {
    setCascading(false)
    setEditing(true)
  }

  function handleCancel() {
    setName(template.name)
    setCanonicalName(template.canonical_name)
    setNotes(template.notes ?? '')
    setRunType(template.run_type ?? '')
    setTargetPace(template.target_pace ?? '')
    setHrZone(template.hr_zone?.toString() ?? '')
    setIntervalCount(template.interval_count?.toString() ?? '')
    setIntervalRest(template.interval_rest?.toString() ?? '')
    setTargetDistance(template.target_distance?.toString() ?? '')
    setTargetDuration(template.target_duration?.toString() ?? '')
    setCoachingCues(template.coaching_cues ?? '')
    setPlannedDuration(template.planned_duration?.toString() ?? '')
    setError('')
    setEditing(false)
    setCascading(false)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTemplate(template.id)
      if (result.success) {
        setConfirming(false)
        onUpdated()
      } else {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  // Cascade scope selection step
  if (cascading) {
    return (
      <CascadeScopeSelector
        templateId={template.id}
        updates={pendingUpdates}
        onComplete={handleCascadeComplete}
        onCancel={handleCascadeCancel}
      />
    )
  }

  // Edit mode
  if (editing) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <div className="space-y-2">
          <Label htmlFor={`name-${template.id}`}>Name</Label>
          <Input
            id={`name-${template.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`canonical-${template.id}`}>Canonical Name</Label>
          <Input
            id={`canonical-${template.id}`}
            value={canonicalName}
            onChange={(e) => setCanonicalName(e.target.value)}
          />
          {canonicalChanged && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Changing canonical_name will break cross-phase linking for this template.
            </p>
          )}
        </div>

        {isRunning && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`run-type-${template.id}`}>Run Type</Label>
              <select
                id={`run-type-${template.id}`}
                value={runType}
                onChange={(e) => setRunType(e.target.value as RunType | '')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select run type</option>
                {RUN_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`pace-${template.id}`}>Target Pace</Label>
                <Input
                  id={`pace-${template.id}`}
                  value={targetPace}
                  onChange={(e) => setTargetPace(e.target.value)}
                  placeholder="5:30/km"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`hr-zone-${template.id}`}>HR Zone</Label>
                <select
                  id={`hr-zone-${template.id}`}
                  value={hrZone}
                  onChange={(e) => setHrZone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">—</option>
                  {HR_ZONES.map((z) => (
                    <option key={z} value={z}>Zone {z}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`distance-${template.id}`}>
                  {isInterval ? 'Target Distance (km, per rep)' : 'Target Distance (km)'}
                </Label>
                <Input
                  id={`distance-${template.id}`}
                  type="text"
                  inputMode="decimal"
                  value={targetDistance}
                  onChange={(e) => setTargetDistance(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`duration-edit-${template.id}`}>
                  {isInterval ? 'Target Duration (min, per rep)' : 'Target Duration (min)'}
                </Label>
                <Input
                  id={`duration-edit-${template.id}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
            </div>
            {isInterval && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`intervals-${template.id}`}>Intervals</Label>
                  <Input
                    id={`intervals-${template.id}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={intervalCount}
                    onChange={(e) => setIntervalCount(e.target.value)}
                    placeholder="e.g. 6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rest-${template.id}`}>Rest (seconds)</Label>
                  <Input
                    id={`rest-${template.id}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={intervalRest}
                    onChange={(e) => setIntervalRest(e.target.value)}
                    placeholder="e.g. 90"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`cues-${template.id}`}>Coaching Cues</Label>
              <textarea
                id={`cues-${template.id}`}
                value={coachingCues}
                onChange={(e) => setCoachingCues(e.target.value)}
                placeholder="Notes visible to athlete..."
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </>
        )}

        {isMma && (
          <div className="space-y-2">
            <Label htmlFor={`duration-${template.id}`}>Planned Duration (minutes)</Label>
            <Input
              id={`duration-${template.id}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={plannedDuration}
              onChange={(e) => setPlannedDuration(e.target.value)}
              placeholder="e.g. 90"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`notes-${template.id}`}>Notes</Label>
          <textarea
            id={`notes-${template.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Template notes..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

  // Delete confirmation
  if (confirming) {
    return (
      <div className="space-y-3 rounded-xl border border-destructive/50 p-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}
        <p className="text-sm">
          Delete <strong>{template.name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setConfirming(false); setError('') }} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Default display
  const isResistance = template.modality === 'resistance'

  return (
    <div className="rounded-xl border">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors duration-150 hover:bg-muted/50"
        onClick={() => isResistance && setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{template.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">{template.canonical_name}</span>
          {isResistance && (
            <span className="ml-2 text-xs text-muted-foreground">
              {slots.length} exercise{slots.length !== 1 ? 's' : ''}
            </span>
          )}
          {isRunning && template.run_type && (
            <span className="ml-2 text-xs text-muted-foreground">
              {template.run_type}
              {template.target_distance && ` · ${template.target_distance}km`}
              {template.target_duration && ` · ${template.target_duration}min`}
              {template.target_pace && ` · ${template.target_pace}`}
              {template.hr_zone && ` · Z${template.hr_zone}`}
            </span>
          )}
          {isMma && template.planned_duration && (
            <span className="ml-2 text-xs text-muted-foreground">
              {template.planned_duration} min
            </span>
          )}
          {template.notes && (
            <span className="ml-2 text-xs text-muted-foreground italic">
              {template.notes}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {template.modality}
          </span>
          {!isCompleted && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => { e.stopPropagation(); setEditing(true) }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {isResistance && expanded && (
        <div className="border-t px-4 py-3">
          <SlotList
            slots={slots}
            templateId={template.id}
            exercises={exercises}
            isCompleted={isCompleted}
          />
        </div>
      )}
    </div>
  )
}
