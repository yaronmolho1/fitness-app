'use client'

import { useState } from 'react'
import { createExercise } from '@/lib/exercises/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ExerciseForm() {
  const [name, setName] = useState('')
  const [modality, setModality] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState('')
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
      const result = await createExercise({
        name,
        modality,
        muscle_group: muscleGroup,
        equipment,
      })

      if (result.success) {
        setName('')
        setModality('')
        setMuscleGroup('')
        setEquipment('')
      } else {
        setError(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="exercise-name">Name</Label>
        <Input
          id="exercise-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bench Press"
        />
      </div>

      <div className="space-y-2">
        <Label>Modality</Label>
        <Select value={modality} onValueChange={setModality}>
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

      <div className="space-y-2">
        <Label htmlFor="exercise-muscle-group">Muscle Group</Label>
        <Input
          id="exercise-muscle-group"
          value={muscleGroup}
          onChange={(e) => setMuscleGroup(e.target.value)}
          placeholder="e.g. Chest"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="exercise-equipment">Equipment</Label>
        <Input
          id="exercise-equipment"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="e.g. Barbell"
        />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create Exercise'}
      </Button>
    </form>
  )
}
