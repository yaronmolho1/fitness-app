'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cloneMesocycle } from '@/lib/mesocycles/clone-actions'
import { calculateEndDate } from '@/lib/mesocycles/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

type CloneSource = {
  id: number
  name: string
  work_weeks: number
  has_deload: boolean
}

function formatDuration(workWeeks: number, hasDeload: boolean): string {
  const totalWeeks = workWeeks + (hasDeload ? 1 : 0)
  const totalDays = totalWeeks * 7
  const parts = [`${workWeeks} work week${workWeeks !== 1 ? 's' : ''}`]
  if (hasDeload) parts.push('1 deload week')
  return `${parts.join(' + ')} = ${totalDays} days`
}

export function CloneMesocycleForm({ source }: { source: CloneSource }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [workWeeks, setWorkWeeks] = useState(String(source.work_weeks))
  const [hasDeload, setHasDeload] = useState(source.has_deload)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const workWeeksNum = Number(workWeeks)
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
    const wwRaw = Number(workWeeks)
    if (!workWeeks || !Number.isInteger(wwRaw) || wwRaw < 1) {
      clientErrors.work_weeks = Number.isFinite(wwRaw) && !Number.isInteger(wwRaw)
        ? 'Work weeks must be a whole number'
        : 'Work weeks must be at least 1'
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      const result = await cloneMesocycle({
        source_id: source.id,
        name,
        start_date: startDate,
        work_weeks: workWeeksNum,
        has_deload: hasDeload,
      })

      if (result.success) {
        router.push(`/mesocycles/${result.id}`)
      } else {
        setErrors({ server: result.error })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors.server && (
        <p className="text-sm text-destructive" role="alert">{errors.server}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="clone-name">Name</Label>
        <Input
          id="clone-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. ${source.name} (copy)`}
        />
        {errors.name && (
          <p className="text-sm text-destructive" role="alert">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="clone-start-date">Start Date</Label>
        <Input
          id="clone-start-date"
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
          <Label htmlFor="clone-work-weeks">Work Weeks</Label>
          <Input
            id="clone-work-weeks"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={workWeeks}
            onChange={(e) => setWorkWeeks(e.target.value)}
          />
          {errors.work_weeks && (
            <p className="text-sm text-destructive" role="alert">{errors.work_weeks}</p>
          )}
        </div>

        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              id="clone-has-deload"
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
            Fill in start date to preview
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Cloning...' : 'Clone Mesocycle'}
      </Button>
    </form>
  )
}
