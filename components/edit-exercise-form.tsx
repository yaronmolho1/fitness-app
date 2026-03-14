'use client'

import { useState } from 'react'
import { editExercise } from '@/lib/exercises/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Exercise } from '@/lib/exercises/filters'

type EditExerciseFormProps = {
  exercise: Exercise
  onCancel: () => void
  onSaved: () => void
}

export function EditExerciseForm({ exercise, onCancel, onSaved }: EditExerciseFormProps) {
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
        <Label htmlFor={`edit-modality-${exercise.id}`}>Modality</Label>
        <select
          id={`edit-modality-${exercise.id}`}
          value={modality}
          onChange={(e) => setModality(e.target.value as 'resistance' | 'running' | 'mma')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
        >
          <option value="resistance">Resistance</option>
          <option value="running">Running</option>
          <option value="mma">MMA</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-muscle-group-${exercise.id}`}>Muscle Group</Label>
        <Input
          id={`edit-muscle-group-${exercise.id}`}
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          placeholder="e.g. Chest"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`edit-equipment-${exercise.id}`}>Equipment</Label>
        <Input
          id={`edit-equipment-${exercise.id}`}
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="e.g. Barbell"
        />
      </div>

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
