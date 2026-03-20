'use client'

import { useState } from 'react'
import { createRoutineItem } from '@/lib/routines/actions'
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
import { FrequencyModeSelector } from '@/components/frequency-mode-selector'
import type { FrequencyMode } from '@/components/frequency-mode-selector'
import { AutoSuggestCombobox } from '@/components/ui/auto-suggest-combobox'

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

type Mesocycle = { id: number; name: string }

export function CreateRoutineItemForm({
  mesocycles,
  categories,
  onCancel,
  onCreated,
}: {
  mesocycles: Mesocycle[]
  categories: string[]
  onCancel: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [inputFields, setInputFields] = useState<InputField[]>([])
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>('weekly_target')
  const [weeklyTarget, setWeeklyTarget] = useState(3)
  const [selectedDays, setSelectedDays] = useState<number[]>([1]) // Monday default
  const [scopeType, setScopeType] = useState<ScopeType>('global')
  const [mesocycleId, setMesocycleId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleField(field: InputField) {
    setInputFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    )
  }

  function handleModeChange(mode: FrequencyMode) {
    setFrequencyMode(mode)
    // Reset mode-specific data when switching
    if (mode === 'weekly_target') {
      setSelectedDays([1])
    } else if (mode === 'specific_days') {
      setWeeklyTarget(3)
    } else {
      // daily
      setSelectedDays([1])
      setWeeklyTarget(3)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (inputFields.length === 0) {
      setError('At least one input field is required')
      return
    }

    if (frequencyMode === 'specific_days' && selectedDays.length === 0) {
      setError('At least one day must be selected')
      return
    }

    setSubmitting(true)
    try {
      const frequencyTarget = frequencyMode === 'daily' ? 7 : weeklyTarget

      const result = await createRoutineItem({
        name,
        category: category || undefined,
        input_fields: inputFields,
        frequency_target: frequencyTarget,
        frequency_mode: frequencyMode,
        frequency_days: frequencyMode === 'specific_days' ? selectedDays : undefined,
        scope_type: scopeType,
        mesocycle_id: scopeType === 'per_mesocycle' ? Number(mesocycleId) : undefined,
        start_date: scopeType === 'date_range' ? startDate : undefined,
        end_date: scopeType === 'date_range' ? endDate : undefined,
      })

      if (result.success) {
        onCreated()
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
        <Label htmlFor="create-name">Name</Label>
        <Input
          id="create-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          placeholder="e.g. Morning Stretch"
        />
      </div>

      <AutoSuggestCombobox
        items={categories}
        value={category}
        onChange={setCategory}
        label="Category"
        placeholder="e.g. mobility, recovery"
      />

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

      <FrequencyModeSelector
        mode={frequencyMode}
        weeklyTarget={weeklyTarget}
        selectedDays={selectedDays}
        onModeChange={handleModeChange}
        onWeeklyTargetChange={setWeeklyTarget}
        onSelectedDaysChange={setSelectedDays}
      />

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
            <Label htmlFor="create-start">Start Date</Label>
            <Input
              id="create-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="create-end">End Date</Label>
            <Input
              id="create-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
