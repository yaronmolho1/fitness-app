'use client'

import { useState } from 'react'
import { updateRoutineItem } from '@/lib/routines/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const INPUT_FIELD_OPTIONS = [
  { value: 'weight', label: 'Weight (kg)' },
  { value: 'length', label: 'Length (cm)' },
  { value: 'duration', label: 'Duration (min)' },
  { value: 'sets', label: 'Sets' },
  { value: 'reps', label: 'Reps' },
] as const

type InputField = (typeof INPUT_FIELD_OPTIONS)[number]['value']

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'per_mesocycle', label: 'Per Mesocycle' },
  { value: 'date_range', label: 'Date Range' },
  { value: 'skip_on_deload', label: 'Skip on Deload' },
] as const

type ScopeType = (typeof SCOPE_OPTIONS)[number]['value']

type RoutineItem = {
  id: number
  name: string
  category: string | null
  has_weight: boolean
  has_length: boolean
  has_duration: boolean
  has_sets: boolean
  has_reps: boolean
  frequency_target: number
  scope: string
  mesocycle_id: number | null
  start_date: string | null
  end_date: string | null
  skip_on_deload: boolean
}

type Mesocycle = { id: number; name: string }

function itemToInputFields(item: RoutineItem): InputField[] {
  const fields: InputField[] = []
  if (item.has_weight) fields.push('weight')
  if (item.has_length) fields.push('length')
  if (item.has_duration) fields.push('duration')
  if (item.has_sets) fields.push('sets')
  if (item.has_reps) fields.push('reps')
  return fields
}

function itemToScopeType(item: RoutineItem): ScopeType {
  if (item.skip_on_deload) return 'skip_on_deload'
  if (item.scope === 'mesocycle') return 'per_mesocycle'
  return item.scope as ScopeType
}

type EditRoutineItemFormProps = {
  item: RoutineItem
  mesocycles: Mesocycle[]
  onCancel: () => void
  onSaved: () => void
}

export function EditRoutineItemForm({
  item,
  mesocycles,
  onCancel,
  onSaved,
}: EditRoutineItemFormProps) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category ?? '')
  const [inputFields, setInputFields] = useState<InputField[]>(itemToInputFields(item))
  const [frequencyTarget, setFrequencyTarget] = useState(String(item.frequency_target))
  const [scopeType, setScopeType] = useState<ScopeType>(itemToScopeType(item))
  const [mesocycleId, setMesocycleId] = useState(item.mesocycle_id ? String(item.mesocycle_id) : '')
  const [startDate, setStartDate] = useState(item.start_date ?? '')
  const [endDate, setEndDate] = useState(item.end_date ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleField(field: InputField) {
    setInputFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (inputFields.length === 0) {
      setError('At least one input field is required')
      return
    }

    setSubmitting(true)
    try {
      const result = await updateRoutineItem({
        id: item.id,
        name,
        category: category || undefined,
        input_fields: inputFields,
        frequency_target: Number(frequencyTarget),
        scope_type: scopeType,
        mesocycle_id: scopeType === 'per_mesocycle' ? Number(mesocycleId) : undefined,
        start_date: scopeType === 'date_range' ? startDate : undefined,
        end_date: scopeType === 'date_range' ? endDate : undefined,
      })

      if (result.success) {
        onSaved()
      } else {
        setError(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/50 p-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`edit-name-${item.id}`}>Name</Label>
        <Input
          id={`edit-name-${item.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-category-${item.id}`}>Category</Label>
        <Input
          id={`edit-category-${item.id}`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. mobility, recovery"
        />
      </div>

      <div className="space-y-2">
        <Label>Input Fields</Label>
        <div className="flex flex-wrap gap-4">
          {INPUT_FIELD_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={inputFields.includes(value)}
                onCheckedChange={() => toggleField(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-freq-${item.id}`}>Frequency Target (per week)</Label>
        <Input
          id={`edit-freq-${item.id}`}
          type="number"
          min="1"
          value={frequencyTarget}
          onChange={(e) => setFrequencyTarget(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Scope</Label>
        <Select value={scopeType} onValueChange={(v) => setScopeType(v as ScopeType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scopeType === 'per_mesocycle' && (
        <div className="space-y-2">
          <Label>Mesocycle</Label>
          <Select value={mesocycleId} onValueChange={setMesocycleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select mesocycle" />
            </SelectTrigger>
            <SelectContent>
              {mesocycles.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {scopeType === 'date_range' && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`edit-start-${item.id}`}>Start Date</Label>
            <Input
              id={`edit-start-${item.id}`}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor={`edit-end-${item.id}`}>End Date</Label>
            <Input
              id={`edit-end-${item.id}`}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
