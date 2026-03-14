'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RunningTemplateForm } from '@/components/running-template-form'
import { MmaBjjTemplateForm } from '@/components/mma-bjj-template-form'
import { createResistanceTemplate } from '@/lib/templates/actions'
import type { TemplateOption } from '@/lib/schedule/queries'

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  isCompleted: boolean
}

export function TemplateSection({ mesocycleId, templates, isCompleted }: Props) {
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
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="text-sm font-medium">{t.name}</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t.modality}
              </span>
            </div>
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
