import { getExercises } from '@/lib/exercises/queries'
import { ExerciseForm } from '@/components/exercise-form'

export const dynamic = 'force-dynamic'

export default async function ExercisesPage() {
  const allExercises = await getExercises()

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Exercises</h1>
      </div>

      <ExerciseForm />

      {allExercises.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No exercises yet</p>
          <p className="mt-1">Create your first exercise using the form above.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {allExercises.map((exercise) => (
            <div
              key={exercise.id}
              className="flex items-center gap-4 px-4 py-3"
            >
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
