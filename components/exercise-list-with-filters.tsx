'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EditExerciseForm } from '@/components/edit-exercise-form'
import { filterExercises, type Exercise, type Modality } from '@/lib/exercises/filters'

const MODALITIES: { value: Modality; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'resistance', label: 'Resistance' },
  { value: 'running', label: 'Running' },
  { value: 'mma', label: 'MMA' },
]

export function ExerciseListWithFilters({ exercises }: { exercises: Exercise[] }) {
  const [search, setSearch] = useState('')
  const [modality, setModality] = useState<Modality>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const router = useRouter()

  const filtered = filterExercises(exercises, search, modality)
  const hasFilters = search.trim() !== '' || modality !== 'all'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-1">
          {MODALITIES.map((m) => (
            <Button
              key={m.value}
              variant={modality === m.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModality(m.value)}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {hasFilters ? (
            <>
              <p className="text-lg font-medium">No matching exercises</p>
              <p className="mt-1">Try adjusting your search or filter.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No exercises yet</p>
              <p className="mt-1">Create your first exercise using the form above.</p>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {filtered.map((exercise) => (
            <div key={exercise.id} className="px-4 py-3">
              {editingId === exercise.id ? (
                <EditExerciseForm
                  exercise={exercise}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null)
                    router.refresh()
                  }}
                />
              ) : (
                <div className="flex items-center gap-4">
                  <span className="font-medium">{exercise.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {exercise.modality}
                  </span>
                  {exercise.muscle_group && (
                    <span className="text-sm text-muted-foreground">
                      {exercise.muscle_group}
                    </span>
                  )}
                  {exercise.equipment && (
                    <span className="text-sm text-muted-foreground">
                      {exercise.equipment}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setEditingId(exercise.id)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
