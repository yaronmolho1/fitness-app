import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesocycleById } from '@/lib/mesocycles/queries'
import { getScheduleForMesocycle, getTemplatesForMesocycle } from '@/lib/schedule/queries'
import { ScheduleGrid } from '@/components/schedule-grid'

export const dynamic = 'force-dynamic'

export default async function MesocycleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numericId = Number(id)
  if (Number.isNaN(numericId)) notFound()

  const meso = await getMesocycleById(numericId)

  if (!meso) {
    notFound()
  }

  const [schedule, templates] = await Promise.all([
    getScheduleForMesocycle(numericId),
    getTemplatesForMesocycle(numericId),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/mesocycles" className="text-sm text-muted-foreground hover:underline">
        Mesocycles
      </Link>

      <h1 className="text-2xl font-bold">{meso.name}</h1>

      <div className="space-y-2 text-sm">
        <p>{meso.status}</p>
        <p>{meso.start_date}</p>
        <p>{meso.end_date}</p>
        <p>{meso.work_weeks} weeks</p>
        {meso.has_deload && <p>+ deload</p>}
      </div>

      <ScheduleGrid
        mesocycleId={numericId}
        templates={templates}
        schedule={schedule}
        isCompleted={meso.status === 'completed'}
      />
    </div>
  )
}
