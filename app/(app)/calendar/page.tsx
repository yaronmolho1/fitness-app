import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { CalendarGrid } from '@/components/calendar-grid'

export const dynamic = 'force-dynamic'

export default function CalendarPage() {
  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader title="Calendar" />
        <CalendarGrid />
      </div>
    </PageContainer>
  )
}
