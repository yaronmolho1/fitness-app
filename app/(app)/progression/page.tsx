import { getExercises } from '@/lib/exercises/queries'
import { getActiveMesocycle } from '@/lib/mesocycles/queries'
import { getProjectedData } from '@/lib/progression/projected-queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ProgressionTabs } from '@/components/progression-tabs'

export const dynamic = 'force-dynamic'

export default async function ProgressionPage() {
  const exercises = await getExercises()
  const activeMesocycle = await getActiveMesocycle()

  const projectedData = activeMesocycle
    ? await getProjectedData(
        activeMesocycle.id,
        activeMesocycle.name,
        activeMesocycle.work_weeks,
        Boolean(activeMesocycle.has_deload)
      )
    : null

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader title="Progression" />
        <ProgressionTabs
          exercises={exercises}
          projectedData={projectedData}
          isCompleted={activeMesocycle?.status === 'completed'}
        />
      </div>
    </PageContainer>
  )
}
