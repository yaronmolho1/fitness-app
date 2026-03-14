'use client'

import { useState } from 'react'
import { createMmaBjjTemplate } from '@/lib/templates/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  mesocycleId: number
  onSuccess?: () => void
}

export function MmaBjjTemplateForm({ mesocycleId, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    const durationNum = duration ? Number(duration) : null
    if (durationNum !== null && (!Number.isInteger(durationNum) || durationNum < 1)) {
      setError('Duration must be a positive whole number')
      return
    }

    setSubmitting(true)
    try {
      const result = await createMmaBjjTemplate({
        name,
        mesocycle_id: mesocycleId,
        planned_duration: durationNum,
      })

      if (result.success) {
        setName('')
        setDuration('')
        onSuccess?.()
      } else {
        setError(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="mma-name">Template Name</Label>
        <Input
          id="mma-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. BJJ Gi, MMA Sparring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mma-duration">Planned Duration (minutes)</Label>
        <Input
          id="mma-duration"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 90"
          className="h-12 md:h-10"
        />
        <p className="text-xs text-muted-foreground">Optional</p>
      </div>

      <Button type="submit" className="h-12 w-full md:h-10" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create MMA/BJJ Template'}
      </Button>
    </form>
  )
}
