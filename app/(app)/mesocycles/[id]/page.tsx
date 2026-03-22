import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesocycleById, getMesocycleCascadeSummary } from '@/lib/mesocycles/queries'
import { getScheduleForMesocycle, getTemplatesForMesocycle } from '@/lib/schedule/queries'
import { getExercises } from '@/lib/exercises/queries'
import { getSlotsByTemplate } from '@/lib/templates/slot-queries'
import { getSectionsForTemplate } from '@/lib/templates/section-queries'
import { getBrowseTemplates } from '@/lib/templates/browse-queries'
import { DeleteMesocycleButton } from '@/components/delete-mesocycle-button'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ScheduleTabs } from '@/components/schedule-tabs'
import { StatusBadge } from '@/components/status-badge'
import { StatusTransitionButton } from '@/components/status-transition-button'
import { TemplateSection } from '@/components/template-section'
import { Button } from '@/components/ui/button'
import { formatDateDisplay } from '@/lib/date-format'

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

  const [normalSchedule, deloadSchedule, templates, exercises, cascadeSummary, browseTemplates] = await Promise.all([
    getScheduleForMesocycle(numericId, 'normal'),
    meso.has_deload ? getScheduleForMesocycle(numericId, 'deload') : Promise.resolve([]),
    getTemplatesForMesocycle(numericId),
    getExercises(),
    getMesocycleCascadeSummary(numericId),
    meso.status !== 'completed' ? getBrowseTemplates(numericId) : Promise.resolve([]),
  ])

  // Fetch slots and sections for each template
  const slotsByTemplate: Record<number, Awaited<ReturnType<typeof getSlotsByTemplate>>> = {}
  const sectionsByTemplate: Record<number, Awaited<ReturnType<typeof getSectionsForTemplate>>> = {}
  for (const t of templates) {
    slotsByTemplate[t.id] = getSlotsByTemplate(t.id)
    if (t.modality === 'mixed') {
      sectionsByTemplate[t.id] = getSectionsForTemplate(t.id)
    }
  }

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <div className="space-y-3">
          <PageHeader
            title={meso.name}
            breadcrumb={
              <Link href="/mesocycles" className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
                Mesocycles
              </Link>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {meso.status !== 'completed' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/mesocycles/${meso.id}/edit`}>Edit</Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/mesocycles/${meso.id}/clone`}>Clone</Link>
                </Button>
                <StatusTransitionButton mesocycleId={meso.id} status={meso.status} />
                <DeleteMesocycleButton
                  mesocycleId={meso.id}
                  mesocycleName={meso.name}
                  status={meso.status}
                  cascadeSummary={cascadeSummary}
                />
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={meso.status} />
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{formatDateDisplay(meso.start_date)}</span>
              <span>{formatDateDisplay(meso.end_date)}</span>
              <span>{meso.work_weeks} weeks</span>
              {meso.has_deload && <span>+ deload</span>}
            </span>
          </div>
        </div>

        <TemplateSection
          mesocycleId={numericId}
          templates={templates}
          exercises={exercises}
          slotsByTemplate={slotsByTemplate}
          sectionsByTemplate={sectionsByTemplate}
          isCompleted={meso.status === 'completed'}
          browseTemplates={browseTemplates}
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
    </PageContainer>
  )
}
