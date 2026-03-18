import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { TodayWorkout } from '@/components/today-workout'

export default function TodayPage() {
  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader title="Today" className="mb-0" />
        <TodayWorkout />
      </div>
    </PageContainer>
  )
}
