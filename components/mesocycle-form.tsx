'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMesocycle } from '@/lib/mesocycles/actions'
import { calculateEndDate } from '@/lib/mesocycles/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function formatDuration(workWeeks: number, hasDeload: boolean): string {
  const totalWeeks = workWeeks + (hasDeload ? 1 : 0)
  const totalDays = totalWeeks * 7
  const parts = [`${workWeeks} work week${workWeeks !== 1 ? 's' : ''}`]
  if (hasDeload) parts.push('1 deload week')
  return `${parts.join(' + ')} = ${totalDays} days`
}

export function MesocycleForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [workWeeks, setWorkWeeks] = useState('')
  const [hasDeload, setHasDeload] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Live end date preview
  const workWeeksNum = parseInt(workWeeks, 10)
  const canComputeEndDate =
    DATE_REGEX.test(startDate) && Number.isInteger(workWeeksNum) && workWeeksNum >= 1
  const endDate = canComputeEndDate
    ? calculateEndDate(startDate, workWeeksNum, hasDeload)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const clientErrors: Record<string, string> = {}
    if (!name.trim()) {
      clientErrors.name = 'Name is required'
    }
    if (!startDate || !DATE_REGEX.test(startDate)) {
      clientErrors.start_date = 'Start date is required'
    }
    const ww = parseInt(workWeeks, 10)
    if (!workWeeks || !Number.isInteger(ww) || ww < 1) {
      clientErrors.work_weeks = 'Work weeks must be at least 1'
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('start_date', startDate)
      fd.append('work_weeks', workWeeks)
      fd.append('has_deload', hasDeload ? 'true' : 'false')

      const result = await createMesocycle(fd)

      if (result.success) {
        router.push(`/mesocycles/${result.id}`)
      } else {
        setErrors(result.errors)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="meso-name">Name</Label>
        <Input
          id="meso-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hypertrophy Block"
        />
        {errors.name && (
          <p className="text-sm text-destructive" role="alert">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="meso-start-date">Start Date</Label>
        <Input
          id="meso-start-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        {errors.start_date && (
          <p className="text-sm text-destructive" role="alert">{errors.start_date}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meso-work-weeks">Work Weeks</Label>
          <Input
            id="meso-work-weeks"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={workWeeks}
            onChange={(e) => setWorkWeeks(e.target.value)}
            placeholder="e.g. 4"
          />
          {errors.work_weeks && (
            <p className="text-sm text-destructive" role="alert">{errors.work_weeks}</p>
          )}
        </div>

        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              id="meso-has-deload"
              type="checkbox"
              checked={hasDeload}
              onChange={(e) => setHasDeload(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm font-medium">Deload Week</span>
          </label>
        </div>
      </div>

      <div className="rounded-md border bg-muted/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          End Date
        </p>
        {endDate ? (
          <>
            <p className="mt-1 text-lg font-semibold tabular-nums">{endDate}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDuration(workWeeksNum, hasDeload)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Fill in start date and work weeks to preview
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create Mesocycle'}
      </Button>
    </form>
  )
}
