'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NumericInput } from '@/components/ui/numeric-input'
import { Badge } from '@/components/ui/badge'
import { Flame } from 'lucide-react'
import { markRoutineDone, markRoutineSkipped } from '@/lib/routines/actions'

type RoutineLogRow = {
  id: number
  routine_item_id: number
  log_date: string
  status: 'done' | 'skipped'
  value_weight: number | null
  value_length: number | null
  value_duration: number | null
  value_sets: number | null
  value_reps: number | null
}

type RoutineItemRow = {
  id: number
  name: string
  category: string | null
  has_weight: boolean
  has_length: boolean
  has_duration: boolean
  has_sets: boolean
  has_reps: boolean
  frequency_target: number
  weeklyCount: number
  streak: number
}

type FieldConfig = {
  key: 'weight' | 'length' | 'duration' | 'sets' | 'reps'
  label: string
  unit: string
  step: string
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'length', label: 'Length', unit: 'cm', step: '0.1' },
  { key: 'duration', label: 'Duration', unit: 'min', step: '0.1' },
  { key: 'sets', label: 'Sets', unit: '', step: '1' },
  { key: 'reps', label: 'Reps', unit: '', step: '1' },
]

const FLAG_MAP: Record<FieldConfig['key'], keyof RoutineItemRow> = {
  weight: 'has_weight',
  length: 'has_length',
  duration: 'has_duration',
  sets: 'has_sets',
  reps: 'has_reps',
}

const LOG_VALUE_MAP: Record<FieldConfig['key'], keyof RoutineLogRow> = {
  weight: 'value_weight',
  length: 'value_length',
  duration: 'value_duration',
  sets: 'value_sets',
  reps: 'value_reps',
}

function getActiveFields(item: RoutineItemRow): FieldConfig[] {
  return FIELD_CONFIGS.filter((f) => item[FLAG_MAP[f.key]])
}

function formatLoggedValues(log: RoutineLogRow, item: RoutineItemRow): string {
  const fields = getActiveFields(item)
  return fields
    .map((f) => {
      const val = log[LOG_VALUE_MAP[f.key]]
      if (val === null || val === undefined) return null
      return f.unit ? `${val} ${f.unit}` : `${val} ${f.label.toLowerCase()}`
    })
    .filter(Boolean)
    .join(', ')
}

// Single routine item card for check-off
function RoutineCheckOffCard({
  item,
  log,
  logDate,
}: {
  item: RoutineItemRow
  log: RoutineLogRow | null
  logDate: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  const activeFields = getActiveFields(item)

  function updateField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function handleDone() {
    const values: Record<string, number> = {}
    for (const field of activeFields) {
      const raw = fieldValues[field.key]
      if (raw !== undefined && raw !== '') {
        const num = Number(raw)
        if (isNaN(num)) {
          setError(`Invalid number for ${field.label}`)
          return
        }
        values[field.key] = num
      }
    }

    if (Object.keys(values).length === 0) {
      setError('Enter at least one value')
      return
    }

    startTransition(async () => {
      const result = await markRoutineDone({
        routine_item_id: item.id,
        log_date: logDate,
        values,
      })
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  async function handleSkip() {
    startTransition(async () => {
      const result = await markRoutineSkipped({
        routine_item_id: item.id,
        log_date: logDate,
      })
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  // Already logged — show result
  if (log) {
    const isDone = log.status === 'done'
    return (
      <div
        className={`rounded-xl border p-4 ${isDone ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : 'border-muted bg-muted/30'}`}
        data-testid={`routine-card-${item.id}`}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.name}</span>
              {item.category && (
                <Badge variant="secondary" className="text-xs">
                  {item.category}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {isDone ? formatLoggedValues(log, item) || 'Completed' : 'Skipped'}
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{item.weeklyCount} / {item.frequency_target} this week</span>
              {item.streak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400" data-testid={`streak-${item.id}`}>
                  <Flame className="h-3 w-3" />
                  {item.streak}-day streak
                </span>
              )}
            </div>
          </div>
          <Badge variant={isDone ? 'default' : 'outline'}>
            {isDone ? 'Done' : 'Skipped'}
          </Badge>
        </div>
      </div>
    )
  }

  // Pending — show input form
  return (
    <div
      className="rounded-xl border p-4"
      data-testid={`routine-card-${item.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">{item.name}</span>
        {item.category && (
          <Badge variant="secondary" className="text-xs">
            {item.category}
          </Badge>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{item.weeklyCount} / {item.frequency_target} this week</span>
        {item.streak > 0 && (
          <span className="inline-flex items-center gap-0.5 text-orange-600 dark:text-orange-400" data-testid={`streak-${item.id}`}>
            <Flame className="h-3 w-3" />
            {item.streak}-day streak
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeFields.map((field) => (
          <div key={field.key} className="flex items-center gap-1.5">
            <label
              htmlFor={`${item.id}-${field.key}`}
              className="text-sm text-muted-foreground"
            >
              {field.label}
            </label>
            <div className="flex items-center gap-1">
              <NumericInput
                id={`${item.id}-${field.key}`}
                mode={field.step === '1' ? 'integer' : 'decimal'}
                className="h-10 w-20"
                placeholder="0"
                value={fieldValues[field.key] ?? ''}
                onValueChange={(v) => updateField(field.key, v)}
                disabled={isPending}
              />
              {field.unit && (
                <span className="text-xs text-muted-foreground">{field.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          onClick={handleDone}
          disabled={isPending}
          className="flex-1"
          size="lg"
        >
          {isPending ? 'Saving...' : 'Done'}
        </Button>
        <Button
          onClick={handleSkip}
          disabled={isPending}
          variant="outline"
          size="lg"
        >
          Skip
        </Button>
      </div>
    </div>
  )
}

export function RoutineCheckOff({
  items,
  logs,
  logDate,
}: {
  items: RoutineItemRow[]
  logs: RoutineLogRow[]
  logDate: string
}) {
  // Build log lookup by routine_item_id
  const logByItem = new Map(logs.map((l) => [l.routine_item_id, l]))

  // Separate pending and logged items
  const pending = items.filter((i) => !logByItem.has(i.id))
  const logged = items.filter((i) => logByItem.has(i.id))

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">No routines for today</p>
        <p className="mt-1">All caught up!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pending.map((item) => (
        <RoutineCheckOffCard
          key={item.id}
          item={item}
          log={null}
          logDate={logDate}
        />
      ))}
      {logged.map((item) => (
        <RoutineCheckOffCard
          key={item.id}
          item={item}
          log={logByItem.get(item.id)!}
          logDate={logDate}
        />
      ))}
    </div>
  )
}
