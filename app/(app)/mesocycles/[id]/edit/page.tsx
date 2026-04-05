import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesocycleById, getAllNonCompletedMesocycles } from '@/lib/mesocycles/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { MesocycleForm } from '@/components/mesocycle-form'

export const dynamic = 'force-dynamic'

export default async function EditMesocyclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numericId = Number(id)
  if (Number.isNaN(numericId)) notFound()

  const [meso, existing] = await Promise.all([
    getMesocycleById(numericId),
    getAllNonCompletedMesocycles(),
  ])
  if (!meso) notFound()

  if (meso.status === 'completed') {
    notFound()
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Edit Mesocycle"
          breadcrumb={
            <Link href={`/mesocycles/${meso.id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
              {meso.name}
            </Link>
          }
        />
        <MesocycleForm
          mode="edit"
          initialData={{
            id: meso.id,
            name: meso.name,
            start_date: meso.start_date,
            work_weeks: meso.work_weeks,
            has_deload: meso.has_deload,
          }}
          existingMesocycles={existing}
          currentStatus={meso.status}
        />
      </div>
    </PageContainer>
  )
}
