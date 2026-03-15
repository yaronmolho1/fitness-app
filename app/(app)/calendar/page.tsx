import { CalendarGrid } from '@/components/calendar-grid'

export const dynamic = 'force-dynamic'

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      <CalendarGrid />
    </div>
  )
}
