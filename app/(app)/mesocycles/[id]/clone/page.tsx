import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMesocycleById } from '@/lib/mesocycles/queries'
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
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div className="space-y-1">
        <Link href={`/mesocycles/${meso.id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
          {meso.name}
        </Link>
        <h1 className="text-2xl font-bold">Clone Mesocycle</h1>
      </div>

      <CloneMesocycleForm
        source={{
          id: meso.id,
          name: meso.name,
          work_weeks: meso.work_weeks,
          has_deload: meso.has_deload,
        }}
      />
    </div>
  )
}
