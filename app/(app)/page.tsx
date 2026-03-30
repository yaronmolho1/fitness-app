import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { TodayWorkout } from '@/components/today-workout'
import { formatDateLong } from '@/lib/date-format'

function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; action?: string }>
}) {
  const { date, action } = await searchParams
  const title = date && date !== todayDateString() ? formatDateLong(date) : 'Today'
  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader title={title} />
        <TodayWorkout key={date ?? 'today'} date={date} action={action} />
      </div>
    </PageContainer>
  )
}
