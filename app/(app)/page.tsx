import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { TodayWorkout } from '@/components/today-workout'

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader title="Today" />
        <TodayWorkout key={date ?? 'today'} date={date} />
      </div>
    </PageContainer>
  )
}
