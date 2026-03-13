import { getExercises } from '@/lib/exercises/queries'
import { ExerciseForm } from '@/components/exercise-form'
import { ExerciseListWithFilters } from '@/components/exercise-list-with-filters'

export const dynamic = 'force-dynamic'

export default async function ExercisesPage() {
  const allExercises = await getExercises()

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Exercises</h1>
      </div>

      <ExerciseForm />

      <ExerciseListWithFilters exercises={allExercises} />
    </div>
  )
}
