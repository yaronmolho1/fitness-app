'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
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
        hasFilters ? (
          <EmptyState
            message="No matching exercises"
            description="Try adjusting your search or filter."
          />
        ) : (
          <EmptyState
            icon={Dumbbell}
            message="No exercises yet"
            description="Create your first exercise using the form above."
          />
        )
      ) : (
        <div className="divide-y rounded-xl border">
          {filtered.map((exercise) => (
            <div key={exercise.id} className="px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
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
