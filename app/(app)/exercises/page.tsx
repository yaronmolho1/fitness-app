import { getExercises } from '@/lib/exercises/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ExerciseForm } from '@/components/exercise-form'
import { ExerciseListWithFilters } from '@/components/exercise-list-with-filters'

export const dynamic = 'force-dynamic'

export default async function ExercisesPage() {
  const allExercises = await getExercises()

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader title="Exercises" className="mb-0" />
        <ExerciseForm />
        <ExerciseListWithFilters exercises={allExercises} />
      </div>
    </PageContainer>
  )
}
