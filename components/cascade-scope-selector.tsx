'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getCascadePreview, cascadeUpdateTemplates } from '@/lib/templates/cascade-actions'
import type { CascadeScope, CascadePreviewData, CascadeUpdates, CascadeSummary } from '@/lib/templates/cascade-types'

type Props = {
  templateId: number
  updates: CascadeUpdates
  onComplete: () => void
  onCancel: () => void
}

type Step = 'scope-select' | 'confirm' | 'summary'

const SCOPE_OPTIONS: { value: CascadeScope; label: string; description: string }[] = [
  {
    value: 'this-only',
    label: 'This only',
    description: 'Update this template in the current mesocycle',
  },
  {
    value: 'this-and-future',
    label: 'This + future',
    description: 'Update this and all future mesocycles',
  },
  {
    value: 'all-phases',
    label: 'All phases',
    description: 'Update every active/planned mesocycle',
  },
]

export function CascadeScopeSelector({ templateId, updates, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>('scope-select')
  const [selectedScope, setSelectedScope] = useState<CascadeScope | null>(null)
  const [preview, setPreview] = useState<CascadePreviewData | null>(null)
  const [summary, setSummary] = useState<CascadeSummary | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // Fetch preview for all-phases on mount to show target counts
  useEffect(() => {
    let cancelled = false
    getCascadePreview(templateId, 'all-phases').then((result) => {
      if (cancelled) return
      if (result.success) {
        setPreview(result.data)
      }
    })
    return () => { cancelled = true }
  }, [templateId])

  function handleScopeSelect(scope: CascadeScope) {
    setSelectedScope(scope)
    setError('')

    // Fetch preview for the selected scope
    startTransition(async () => {
      const result = await getCascadePreview(templateId, scope)
      if (result.success) {
        setPreview(result.data)
        setStep('confirm')
      } else {
        setError(result.error)
      }
    })
  }

  function handleConfirm() {
    if (!selectedScope) return

    startTransition(async () => {
      const result = await cascadeUpdateTemplates({
        templateId,
        scope: selectedScope,
        updates,
      })

      if (result.success) {
        setSummary(result.data)
        setStep('summary')
      } else {
        setError(result.error)
      }
    })
  }

  // Summary step
  if (step === 'summary' && summary) {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-sm font-semibold tracking-tight">Cascade complete</p>
        </div>

        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">
            {summary.updated} updated
          </span>
          {summary.skipped > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {summary.skipped} skipped
            </span>
          )}
        </div>

        <Button size="sm" variant="ghost" onClick={onComplete} aria-label="Done">
          Done
        </Button>
      </div>
    )
  }

  // Confirm step — show preview of affected templates
  if (step === 'confirm' && selectedScope && preview) {
    const scopeLabel = SCOPE_OPTIONS.find((o) => o.value === selectedScope)?.label
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-semibold tracking-tight">
          Apply to: {scopeLabel}
        </p>

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <div className="space-y-1">
          {preview.targets.map((target) => (
            <div
              key={target.id}
              className={cn(
                'flex items-center justify-between rounded px-2 py-1 text-xs',
                target.hasLoggedWorkouts
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground'
              )}
            >
              <span>{target.mesocycleName}</span>
              {target.hasLoggedWorkouts && (
                <span className="text-amber-600 dark:text-amber-400">has logs</span>
              )}
            </div>
          ))}
        </div>

        {preview.skippedCount > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {preview.skippedCount} template{preview.skippedCount !== 1 ? 's' : ''} with logged workouts will be skipped
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleConfirm} disabled={isPending} aria-label="Confirm">
            {isPending ? 'Applying...' : 'Confirm'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending} aria-label="Cancel">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Scope selection step
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-semibold tracking-tight">
        Apply changes to...
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="grid gap-2">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleScopeSelect(option.value)}
            disabled={isPending}
            className={cn(
              'group flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors',
              'hover:border-primary/50 hover:bg-accent',
              'disabled:opacity-50'
            )}
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending} aria-label="Cancel">
        Cancel
      </Button>
    </div>
  )
}
