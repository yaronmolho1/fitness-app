import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesocycleById } from '@/lib/mesocycles/queries'
import { getScheduleForMesocycle, getTemplatesForMesocycle } from '@/lib/schedule/queries'
import { getExercises } from '@/lib/exercises/queries'
import { getSlotsByTemplate } from '@/lib/templates/slot-queries'
import { ScheduleTabs } from '@/components/schedule-tabs'
import { StatusBadge } from '@/components/status-badge'
import { StatusTransitionButton } from '@/components/status-transition-button'
import { TemplateSection } from '@/components/template-section'
import { Button } from '@/components/ui/button'

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

  const [normalSchedule, deloadSchedule, templates, exercises] = await Promise.all([
    getScheduleForMesocycle(numericId, 'normal'),
    meso.has_deload ? getScheduleForMesocycle(numericId, 'deload') : Promise.resolve([]),
    getTemplatesForMesocycle(numericId),
    getExercises(),
  ])

  // Fetch slots for each template
  const slotsByTemplate: Record<number, Awaited<ReturnType<typeof getSlotsByTemplate>>> = {}
  for (const t of templates) {
    slotsByTemplate[t.id] = getSlotsByTemplate(t.id)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/mesocycles" className="text-sm text-muted-foreground hover:underline">
        Mesocycles
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{meso.name}</h1>
            <StatusBadge status={meso.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{meso.start_date}</span>
            <span>{meso.end_date}</span>
            <span>{meso.work_weeks} weeks</span>
            {meso.has_deload && <span>+ deload</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/mesocycles/${meso.id}/clone`}>Clone</Link>
          </Button>
          <StatusTransitionButton mesocycleId={meso.id} status={meso.status} />
        </div>
      </div>

      <TemplateSection
        mesocycleId={numericId}
        templates={templates}
        exercises={exercises}
        slotsByTemplate={slotsByTemplate}
        isCompleted={meso.status === 'completed'}
      />

      <ScheduleTabs
        mesocycleId={numericId}
        templates={templates}
        normalSchedule={normalSchedule}
        deloadSchedule={deloadSchedule}
        hasDeload={meso.has_deload}
        isCompleted={meso.status === 'completed'}
      />
    </div>
  )
}
