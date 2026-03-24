'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { RunningTemplateForm } from '@/components/running-template-form'
import { MmaBjjTemplateForm } from '@/components/mma-bjj-template-form'
import { MixedTemplateForm } from '@/components/mixed-template-form'
import { SlotList } from '@/components/slot-list'
import { CascadeScopeSelector } from '@/components/cascade-scope-selector'
import { SectionHeading } from '@/components/layout/section-heading'
import { TemplateAddPicker, type PickerSelection } from '@/components/template-add-picker'
import { TemplateBrowseDialog } from '@/components/template-browse-dialog'
import { createResistanceTemplate, deleteTemplate } from '@/lib/templates/actions'
import { copyTemplateToMesocycle } from '@/lib/templates/copy-actions'
import { updateSection } from '@/lib/templates/section-actions'
import type { TemplateOption } from '@/lib/schedule/queries'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'
import type { Exercise } from '@/lib/exercises/filters'
import type { BrowseTemplate } from '@/lib/templates/browse-queries'
import type { TemplateSectionRow } from '@/lib/templates/section-queries'

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  exercises: Exercise[]
  slotsByTemplate: Record<number, SlotWithExercise[]>
  isCompleted: boolean
  browseTemplates?: BrowseTemplate[]
  sectionsByTemplate?: Record<number, TemplateSectionRow[]>
  workWeeks: number
  hasDeload: boolean
}

export function TemplateSection({ mesocycleId, templates, exercises, slotsByTemplate, isCompleted, browseTemplates = [], sectionsByTemplate = {}, workWeeks, hasDeload }: Props) {
  const router = useRouter()
  const [formType, setFormType] = useState<'resistance' | 'running' | 'mma' | 'mixed' | null>(null)
  const [resistanceName, setResistanceName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [browseOpen, setBrowseOpen] = useState(false)
  const [copyPending, setCopyPending] = useState(false)

  function handleCreated() {
    setFormType(null)
    setResistanceName('')
    setError('')
    router.refresh()
  }

  function handlePickerSelect(selection: PickerSelection) {
    setError('')
    if (selection === 'from-existing') {
      setBrowseOpen(true)
    } else {
      setFormType(selection)
    }
  }

  function handleCopy(sourceTemplateId: number) {
    setCopyPending(true)
    startTransition(async () => {
      const result = await copyTemplateToMesocycle(sourceTemplateId, mesocycleId)
      setCopyPending(false)
      if (result.success) {
        setBrowseOpen(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
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
          <TemplateAddPicker onSelect={handlePickerSelect} />
        )}
      </div>

      <TemplateBrowseDialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        onCopy={handleCopy}
        templates={browseTemplates}
        isPending={copyPending}
        error={browseOpen ? error : ''}
      />

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
              sections={sectionsByTemplate[t.id] ?? []}
              workWeeks={workWeeks}
              hasDeload={hasDeload}
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
  sections: TemplateSectionRow[]
  workWeeks: number
  hasDeload: boolean
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

function TemplateRow({ template, slots, exercises, isCompleted, onUpdated, sections, workWeeks, hasDeload }: TemplateRowProps) {
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
      setExpanded(false)
      return
    }

    setPendingUpdates(updates)
    setEditing(false)
    setExpanded(false)
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

  function resetFields() {
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
  }

  function handleCancel() {
    resetFields()
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
                <NumericInput
                  id={`distance-${template.id}`}
                  mode="decimal"
                  value={targetDistance}
                  onValueChange={setTargetDistance}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`duration-edit-${template.id}`}>
                  {isInterval ? 'Target Duration (min, per rep)' : 'Target Duration (min)'}
                </Label>
                <NumericInput
                  id={`duration-edit-${template.id}`}
                  mode="integer"
                  value={targetDuration}
                  onValueChange={setTargetDuration}
                  placeholder="e.g. 30"
                />
              </div>
            </div>
            {isInterval && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`intervals-${template.id}`}>Intervals</Label>
                  <NumericInput
                    id={`intervals-${template.id}`}
                    mode="integer"
                    value={intervalCount}
                    onValueChange={setIntervalCount}
                    placeholder="e.g. 6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rest-${template.id}`}>Rest (seconds)</Label>
                  <NumericInput
                    id={`rest-${template.id}`}
                    mode="integer"
                    value={intervalRest}
                    onValueChange={setIntervalRest}
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
            <NumericInput
              id={`duration-${template.id}`}
              mode="integer"
              value={plannedDuration}
              onValueChange={setPlannedDuration}
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
  const isMixed = template.modality === 'mixed'

  return (
    <div className="rounded-xl border">
      <div
        className="flex cursor-pointer items-start justify-between px-4 py-3 transition-colors duration-150 hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
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
            workWeeks={workWeeks}
            hasDeload={hasDeload}
          />
        </div>
      )}

      {isRunning && expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`run-type-exp-${template.id}`}>Run Type</Label>
            <select
              id={`run-type-exp-${template.id}`}
              value={runType}
              onChange={(e) => setRunType(e.target.value as RunType | '')}
              disabled={isCompleted}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <option value="">Select run type</option>
              {RUN_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`pace-exp-${template.id}`}>Target Pace</Label>
              <Input
                id={`pace-exp-${template.id}`}
                value={targetPace}
                onChange={(e) => setTargetPace(e.target.value)}
                placeholder="5:30/km"
                disabled={isCompleted}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`hr-zone-exp-${template.id}`}>HR Zone</Label>
              <select
                id={`hr-zone-exp-${template.id}`}
                value={hrZone}
                onChange={(e) => setHrZone(e.target.value)}
                disabled={isCompleted}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
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
              <Label htmlFor={`distance-exp-${template.id}`}>
                {isInterval ? 'Target Distance (km, per rep)' : 'Target Distance (km)'}
              </Label>
              <NumericInput
                id={`distance-exp-${template.id}`}
                mode="decimal"
                value={targetDistance}
                onValueChange={setTargetDistance}
                placeholder="e.g. 5"
                disabled={isCompleted}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`duration-exp-${template.id}`}>
                {isInterval ? 'Target Duration (min, per rep)' : 'Target Duration (min)'}
              </Label>
              <NumericInput
                id={`duration-exp-${template.id}`}
                mode="integer"
                value={targetDuration}
                onValueChange={setTargetDuration}
                placeholder="e.g. 30"
                disabled={isCompleted}
              />
            </div>
          </div>
          {isInterval && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`intervals-exp-${template.id}`}>Intervals</Label>
                <NumericInput
                  id={`intervals-exp-${template.id}`}
                  mode="integer"
                  value={intervalCount}
                  onValueChange={setIntervalCount}
                  placeholder="e.g. 6"
                  disabled={isCompleted}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`rest-exp-${template.id}`}>Rest (seconds)</Label>
                <NumericInput
                  id={`rest-exp-${template.id}`}
                  mode="integer"
                  value={intervalRest}
                  onValueChange={setIntervalRest}
                  placeholder="e.g. 90"
                  disabled={isCompleted}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`cues-exp-${template.id}`}>Coaching Cues</Label>
            <textarea
              id={`cues-exp-${template.id}`}
              value={coachingCues}
              onChange={(e) => setCoachingCues(e.target.value)}
              placeholder="Notes visible to athlete..."
              rows={2}
              disabled={isCompleted}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>
          {!isCompleted && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { resetFields(); setExpanded(false) }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {isMma && expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`duration-exp-${template.id}`}>Planned Duration (minutes)</Label>
            <NumericInput
              id={`duration-exp-${template.id}`}
              mode="integer"
              value={plannedDuration}
              onValueChange={setPlannedDuration}
              placeholder="e.g. 90"
              disabled={isCompleted}
            />
          </div>
          {!isCompleted && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { resetFields(); setExpanded(false) }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {isMixed && expanded && sections.length > 0 && (
        <div className="border-t px-4 py-3 space-y-1">
          {sections.map((sec) => (
            <MixedSectionRow
              key={sec.id}
              section={sec}
              slots={slots.filter((s) => s.section_id === sec.id)}
              exercises={exercises}
              templateId={template.id}
              isCompleted={isCompleted}
              onUpdated={onUpdated}
              workWeeks={workWeeks}
              hasDeload={hasDeload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Mixed template section row with expandable editing
// ============================================================================

type MixedSectionRowProps = {
  section: TemplateSectionRow
  slots: SlotWithExercise[]
  exercises: Exercise[]
  templateId: number
  isCompleted: boolean
  onUpdated: () => void
  workWeeks: number
  hasDeload: boolean
}

function MixedSectionRow({ section, slots, exercises, templateId, isCompleted, onUpdated, workWeeks, hasDeload }: MixedSectionRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  // Running fields
  const [runType, setRunType] = useState<RunType | ''>(section.run_type as RunType ?? '')
  const [targetPace, setTargetPace] = useState(section.target_pace ?? '')
  const [hrZone, setHrZone] = useState(section.hr_zone?.toString() ?? '')
  const [targetDistance, setTargetDistance] = useState(section.target_distance?.toString() ?? '')
  const [targetDuration, setTargetDuration] = useState(section.target_duration?.toString() ?? '')
  const [intervalCount, setIntervalCount] = useState(section.interval_count?.toString() ?? '')
  const [intervalRest, setIntervalRest] = useState(section.interval_rest?.toString() ?? '')
  const [coachingCues, setCoachingCues] = useState(section.coaching_cues ?? '')
  // MMA fields
  const [plannedDuration, setPlannedDuration] = useState(section.planned_duration?.toString() ?? '')

  const isInterval = runType === 'interval'
  const sectionSlotCount = slots.length

  function resetSectionFields() {
    setRunType(section.run_type as RunType ?? '')
    setTargetPace(section.target_pace ?? '')
    setHrZone(section.hr_zone?.toString() ?? '')
    setTargetDistance(section.target_distance?.toString() ?? '')
    setTargetDuration(section.target_duration?.toString() ?? '')
    setIntervalCount(section.interval_count?.toString() ?? '')
    setIntervalRest(section.interval_rest?.toString() ?? '')
    setCoachingCues(section.coaching_cues ?? '')
    setPlannedDuration(section.planned_duration?.toString() ?? '')
    setError('')
  }

  function handleSectionSave() {
    if (section.modality === 'running') {
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
    if (section.modality === 'mma') {
      const durationNum = plannedDuration ? Number(plannedDuration) : null
      if (durationNum !== null && durationNum <= 0) {
        setError('Duration must be positive')
        return
      }
    }

    setError('')
    const updates: Record<string, unknown> = {}

    if (section.modality === 'running') {
      if (runType && runType !== section.run_type) updates.run_type = runType
      const newPace = targetPace || null
      if (newPace !== section.target_pace) updates.target_pace = newPace
      const newHrZone = hrZone ? Number(hrZone) : null
      if (newHrZone !== section.hr_zone) updates.hr_zone = newHrZone
      const newDistance = targetDistance ? Number(targetDistance) : null
      if (newDistance !== (section.target_distance ?? null)) updates.target_distance = newDistance
      const newDuration = targetDuration ? Number(targetDuration) : null
      if (newDuration !== (section.target_duration ?? null)) updates.target_duration = newDuration
      const newIntervalCount = (runType === 'interval' && intervalCount) ? Number(intervalCount) : null
      if (newIntervalCount !== (section.interval_count ?? null)) updates.interval_count = newIntervalCount
      const newIntervalRest = (runType === 'interval' && intervalRest) ? Number(intervalRest) : null
      if (newIntervalRest !== (section.interval_rest ?? null)) updates.interval_rest = newIntervalRest
      const newCues = coachingCues || null
      if (newCues !== section.coaching_cues) updates.coaching_cues = newCues
    }

    if (section.modality === 'mma') {
      const newDuration = plannedDuration ? Number(plannedDuration) : null
      if (newDuration !== section.planned_duration) updates.planned_duration = newDuration
    }

    if (Object.keys(updates).length === 0) {
      setExpanded(false)
      return
    }

    startTransition(async () => {
      const result = await updateSection(section.id, updates)
      if (result.success) {
        setExpanded(false)
        onUpdated()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="rounded-lg border">
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {section.modality}
        </span>
        <span className="font-medium">{section.section_name}</span>
        {section.modality === 'resistance' && (
          <span className="text-xs text-muted-foreground">
            {sectionSlotCount} exercise{sectionSlotCount !== 1 ? 's' : ''}
          </span>
        )}
        {section.modality === 'running' && section.run_type && (
          <span className="text-xs text-muted-foreground">
            {section.run_type}
            {section.target_distance && ` · ${section.target_distance}km`}
            {section.target_duration && ` · ${section.target_duration}min`}
          </span>
        )}
        {section.modality === 'mma' && section.planned_duration && (
          <span className="text-xs text-muted-foreground">
            {section.planned_duration} min
          </span>
        )}
      </div>

      {expanded && section.modality === 'resistance' && (
        <div className="border-t px-3 py-2">
          <SlotList
            slots={slots}
            templateId={templateId}
            exercises={exercises}
            isCompleted={isCompleted}
            sectionId={section.id}
            modality={section.modality}
            workWeeks={workWeeks}
            hasDeload={hasDeload}
          />
        </div>
      )}

      {expanded && section.modality === 'running' && (
        <div className="border-t px-3 py-2 space-y-3">
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`sec-run-type-${section.id}`}>Run Type</Label>
            <select
              id={`sec-run-type-${section.id}`}
              value={runType}
              onChange={(e) => setRunType(e.target.value as RunType | '')}
              disabled={isCompleted}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <option value="">Select run type</option>
              {RUN_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`sec-pace-${section.id}`}>Target Pace</Label>
              <Input
                id={`sec-pace-${section.id}`}
                value={targetPace}
                onChange={(e) => setTargetPace(e.target.value)}
                placeholder="5:30/km"
                disabled={isCompleted}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`sec-hr-zone-${section.id}`}>HR Zone</Label>
              <select
                id={`sec-hr-zone-${section.id}`}
                value={hrZone}
                onChange={(e) => setHrZone(e.target.value)}
                disabled={isCompleted}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
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
              <Label htmlFor={`sec-distance-${section.id}`}>
                {isInterval ? 'Target Distance (km, per rep)' : 'Target Distance (km)'}
              </Label>
              <NumericInput
                id={`sec-distance-${section.id}`}
                mode="decimal"
                value={targetDistance}
                onValueChange={setTargetDistance}
                placeholder="e.g. 5"
                disabled={isCompleted}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`sec-duration-${section.id}`}>
                {isInterval ? 'Target Duration (min, per rep)' : 'Target Duration (min)'}
              </Label>
              <NumericInput
                id={`sec-duration-${section.id}`}
                mode="integer"
                value={targetDuration}
                onValueChange={setTargetDuration}
                placeholder="e.g. 30"
                disabled={isCompleted}
              />
            </div>
          </div>
          {isInterval && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`sec-intervals-${section.id}`}>Intervals</Label>
                <NumericInput
                  id={`sec-intervals-${section.id}`}
                  mode="integer"
                  value={intervalCount}
                  onValueChange={setIntervalCount}
                  placeholder="e.g. 6"
                  disabled={isCompleted}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`sec-rest-${section.id}`}>Rest (seconds)</Label>
                <NumericInput
                  id={`sec-rest-${section.id}`}
                  mode="integer"
                  value={intervalRest}
                  onValueChange={setIntervalRest}
                  placeholder="e.g. 90"
                  disabled={isCompleted}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor={`sec-cues-${section.id}`}>Coaching Cues</Label>
            <textarea
              id={`sec-cues-${section.id}`}
              value={coachingCues}
              onChange={(e) => setCoachingCues(e.target.value)}
              placeholder="Notes visible to athlete..."
              rows={2}
              disabled={isCompleted}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>
          {!isCompleted && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSectionSave} disabled={isPending}>
                {isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { resetSectionFields(); setExpanded(false) }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {expanded && section.modality === 'mma' && (
        <div className="border-t px-3 py-2 space-y-3">
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`sec-duration-${section.id}`}>Planned Duration (minutes)</Label>
            <NumericInput
              id={`sec-duration-${section.id}`}
              mode="integer"
              value={plannedDuration}
              onValueChange={setPlannedDuration}
              placeholder="e.g. 90"
              disabled={isCompleted}
            />
          </div>
          {!isCompleted && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSectionSave} disabled={isPending}>
                {isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { resetSectionFields(); setExpanded(false) }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
