'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RunningTemplateForm } from '@/components/running-template-form'
import { MmaBjjTemplateForm } from '@/components/mma-bjj-template-form'
import { SlotList } from '@/components/slot-list'
import { CascadeScopeSelector } from '@/components/cascade-scope-selector'
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
  const [formType, setFormType] = useState<'resistance' | 'running' | 'mma' | null>(null)
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
        <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
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
        <div className="rounded-lg border p-4">
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
        <div className="rounded-lg border p-4">
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
        <div className="rounded-lg border p-4">
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

function TemplateRow({ template, slots, exercises, isCompleted, onUpdated }: TemplateRowProps) {
  const [editing, setEditing] = useState(false)
  const [cascading, setCascading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState(template.name)
  const [canonicalName, setCanonicalName] = useState(template.canonical_name)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const canonicalChanged = canonicalName !== template.canonical_name

  function handleSave() {
    const nameChanged = name !== template.name
    if (!nameChanged && !canonicalChanged) {
      setEditing(false)
      return
    }

    // Build cascade updates from changed fields
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
    // Return to edit mode so user can modify or re-save
    setEditing(true)
  }

  function handleCancel() {
    setName(template.name)
    setCanonicalName(template.canonical_name)
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

  // Cascade scope selection step (shown after clicking Save in edit mode)
  if (cascading) {
    const nameChanged = name !== template.name
    const updates = {
      ...(nameChanged ? { name } : {}),
    }

    return (
      <CascadeScopeSelector
        templateId={template.id}
        updates={updates}
        onComplete={handleCascadeComplete}
        onCancel={handleCascadeCancel}
      />
    )
  }

  // Edit mode
  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
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
            <p className="text-xs text-amber-600">
              Changing canonical_name will break cross-phase linking for this template.
            </p>
          )}
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
      <div className="space-y-3 rounded-lg border border-destructive/50 p-4">
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
    <div className="rounded-lg border">
      <div
        className="flex cursor-pointer items-center justify-between px-4 py-3"
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
