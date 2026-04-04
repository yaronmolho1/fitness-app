import { getExercises } from '@/lib/exercises/queries'
import { getNonCompletedMesocycles } from '@/lib/mesocycles/queries'
import { getProjectedData } from '@/lib/progression/projected-queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ProgressionTabs } from '@/components/progression-tabs'

export const dynamic = 'force-dynamic'

export default async function ProgressionPage() {
  const exercises = await getExercises()
  const mesocycles = await getNonCompletedMesocycles()

  const projectedData = mesocycles.length > 0
    ? await getProjectedData(mesocycles)
    : null

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader title="Progression" />
        <ProgressionTabs
          exercises={exercises}
          projectedData={projectedData}
        />
      </div>
    </PageContainer>
  )
}
