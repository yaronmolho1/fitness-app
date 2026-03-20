import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesocycleById } from '@/lib/mesocycles/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { CloneMesocycleForm } from '@/components/clone-mesocycle-form'

export const dynamic = 'force-dynamic'

export default async function CloneMesocyclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const numericId = Number(id)
  if (Number.isNaN(numericId)) notFound()

  const meso = await getMesocycleById(numericId)
  if (!meso) notFound()

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader
          title="Clone Mesocycle"
          className="mb-0"
          breadcrumb={
            <Link href={`/mesocycles/${meso.id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
              {meso.name}
            </Link>
          }
        />

        <CloneMesocycleForm
          source={{
            id: meso.id,
            name: meso.name,
            work_weeks: meso.work_weeks,
            has_deload: meso.has_deload,
          }}
        />
      </div>
    </PageContainer>
  )
}
