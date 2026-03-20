'use client'

import { useState } from 'react'
import { editExercise } from '@/lib/exercises/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AutoSuggestCombobox } from '@/components/ui/auto-suggest-combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Exercise } from '@/lib/exercises/filters'

type EditExerciseFormProps = {
  exercise: Exercise
  equipmentOptions: string[]
  muscleGroupOptions: string[]
  onCancel: () => void
  onSaved: () => void
}

export function EditExerciseForm({ exercise, equipmentOptions, muscleGroupOptions, onCancel, onSaved }: EditExerciseFormProps) {
  const [name, setName] = useState(exercise.name)
  const [modality, setModality] = useState(exercise.modality)
  const [muscleGroup, setMuscleGroup] = useState(exercise.muscle_group ?? '')
  const [equipment, setEquipment] = useState(exercise.equipment ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!modality) {
      setError('Modality is required')
      return
    }

    setSubmitting(true)
    try {
      const result = await editExercise({
        id: exercise.id,
        name,
        modality,
        muscle_group: muscleGroup,
        equipment,
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
        <Label htmlFor={`edit-name-${exercise.id}`}>Name</Label>
        <Input
          id={`edit-name-${exercise.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bench Press"
        />
      </div>

      <div className="space-y-2">
        <Label>Modality</Label>
        <Select value={modality} onValueChange={(v) => setModality(v as typeof modality)}>
          <SelectTrigger>
            <SelectValue placeholder="Select modality" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="resistance">Resistance</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="mma">MMA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AutoSuggestCombobox
        items={muscleGroupOptions}
        value={muscleGroup}
        onChange={setMuscleGroup}
        label="Muscle Group"
        placeholder="e.g. Chest"
      />

      <AutoSuggestCombobox
        items={equipmentOptions}
        value={equipment}
        onChange={setEquipment}
        label="Equipment"
        placeholder="e.g. Barbell"
      />

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
