import { getExercises } from '@/lib/exercises/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ProgressionChart } from '@/components/progression-chart'

export const dynamic = 'force-dynamic'

export default async function ProgressionPage() {
  const exercises = await getExercises()

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader title="Progression" className="mb-0" />
        <ProgressionChart exercises={exercises} />
      </div>
    </PageContainer>
  )
}
