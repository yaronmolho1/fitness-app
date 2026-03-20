'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { createExercise } from '@/lib/exercises/actions'
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

type ExerciseFormProps = {
  equipmentOptions: string[]
  muscleGroupOptions: string[]
}

export function ExerciseForm({ equipmentOptions, muscleGroupOptions }: ExerciseFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [modality, setModality] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  function resetForm() {
    setName('')
    setModality('')
    setMuscleGroup('')
    setEquipment('')
    setError('')
  }

  function handleCollapse() {
    setOpen(false)
    resetForm()
  }

  // Animate height on open/close
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    if (open) {
      el.style.height = '0px'
      // Force reflow before setting target height
      requestAnimationFrame(() => {
        el.style.height = `${el.scrollHeight}px`
      })
    } else {
      // Collapse from current height to 0
      el.style.height = `${el.scrollHeight}px`
      requestAnimationFrame(() => {
        el.style.height = '0px'
      })
    }
  }, [open])

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
        handleCollapse()
      } else {
        setError(result.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          variant="outline"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Exercise
        </Button>
      )}

      <div
        ref={contentRef}
        className="overflow-hidden transition-[height] duration-300 ease-in-out"
        style={{ height: open ? undefined : '0px' }}
      >
        {open && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/50 p-4">
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
              <Label id="modality-label">Modality</Label>
              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger aria-labelledby="modality-label">
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
                {submitting ? 'Creating...' : 'Create Exercise'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCollapse} disabled={submitting}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
