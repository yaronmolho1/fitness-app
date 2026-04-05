'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMesocycle, updateMesocycle } from '@/lib/mesocycles/actions'
import { calculateEndDate, checkDateOverlap, type MesocycleDateRange } from '@/lib/mesocycles/utils'
import { formatDateDisplay } from '@/lib/date-format'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
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

type MesocycleFormProps = {
  mode?: 'create' | 'edit'
  initialData?: {
    id: number
    name: string
    start_date: string
    work_weeks: number
    has_deload: boolean
  }
  existingMesocycles?: MesocycleDateRange[]
  currentStatus?: string
}

export function MesocycleForm({ mode = 'create', initialData, existingMesocycles = [], currentStatus }: MesocycleFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? '')
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [workWeeks, setWorkWeeks] = useState(initialData ? String(initialData.work_weeks) : '')
  const [hasDeload, setHasDeload] = useState(initialData?.has_deload ?? false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Live end date preview
  const workWeeksNum = Number(workWeeks)
  const canComputeEndDate =
    DATE_REGEX.test(startDate) && Number.isInteger(workWeeksNum) && workWeeksNum >= 1
  const endDate = canComputeEndDate
    ? calculateEndDate(startDate, workWeeksNum, hasDeload)
    : null

  const overlap = endDate
    ? checkDateOverlap(startDate, endDate, existingMesocycles, initialData?.id)
    : null
  const isBlockingOverlap = overlap?.overlapping && (currentStatus === 'planned' || currentStatus === 'active')

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
      const fd = new FormData()
      fd.append('name', name)
      fd.append('start_date', startDate)
      fd.append('work_weeks', workWeeks)
      fd.append('has_deload', hasDeload ? 'true' : 'false')

      const result = mode === 'edit'
        ? await updateMesocycle(initialData!.id, fd)
        : await createMesocycle(fd)

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
        <Label>Start Date</Label>
        <DatePicker value={startDate} onChange={setStartDate} />
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
          <div className="flex cursor-pointer items-center gap-2">
            <Checkbox
              id="meso-has-deload"
              checked={hasDeload}
              onCheckedChange={(checked) => setHasDeload(checked === true)}
            />
            <Label htmlFor="meso-has-deload" className="cursor-pointer font-medium">
              Deload Week
            </Label>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-muted/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          End Date
        </p>
        {endDate ? (
          <>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatDateDisplay(endDate)}</p>
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

      {overlap?.overlapping && (
        <div className={`rounded-md border p-3 text-sm ${isBlockingOverlap ? 'border-destructive bg-destructive/10 text-destructive' : 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'}`}>
          Date range conflicts with &ldquo;{overlap.conflictName}&rdquo;
          {isBlockingOverlap
            ? ' — resolve the conflict before saving'
            : ' — you can resolve this before marking as planned'}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting || !!isBlockingOverlap}>
        {submitting
          ? (mode === 'edit' ? 'Saving...' : 'Creating...')
          : (mode === 'edit' ? 'Save Changes' : 'Create Mesocycle')}
      </Button>
    </form>
  )
}
