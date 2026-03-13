'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { filterExercises, type Exercise } from '@/lib/exercises/filters'

type ExercisePickerProps = {
  exercises: Exercise[]
  onSelect: (exercise: Exercise) => void
}

export function ExercisePicker({ exercises, onSelect }: ExercisePickerProps) {
  const [search, setSearch] = useState('')

  // Filter to resistance-only by default
  const filtered = filterExercises(exercises, search, 'resistance')

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search resistance exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {exercises.some((e) => e.modality === 'resistance') ? (
            <p>No matching resistance exercises</p>
          ) : (
            <div>
              <p className="font-medium">No resistance exercises</p>
              <p className="mt-1 text-sm">
                <a href="/exercises" className="text-primary underline">
                  Create exercises
                </a>{' '}
                to add them to templates.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
          {filtered.map((exercise) => (
            <Button
              key={exercise.id}
              variant="ghost"
              className="w-full justify-start rounded-none px-4 py-3"
              onClick={() => onSelect(exercise)}
            >
              <span className="font-medium">{exercise.name}</span>
              {exercise.muscle_group && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {exercise.muscle_group}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
