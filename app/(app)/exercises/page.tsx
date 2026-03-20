import { getExercises, getDistinctExerciseValues } from '@/lib/exercises/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ExerciseForm } from '@/components/exercise-form'
import { ExerciseListWithFilters } from '@/components/exercise-list-with-filters'

export const dynamic = 'force-dynamic'

export default async function ExercisesPage() {
  const [allExercises, distinctValues] = await Promise.all([
    getExercises(),
    getDistinctExerciseValues(),
  ])

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader title="Exercises" className="mb-0" />
        <ExerciseForm
          equipmentOptions={distinctValues.equipment}
          muscleGroupOptions={distinctValues.muscle_groups}
        />
        <ExerciseListWithFilters
          exercises={allExercises}
          equipmentOptions={distinctValues.equipment}
          muscleGroupOptions={distinctValues.muscle_groups}
        />
      </div>
    </PageContainer>
  )
}
