import Link from 'next/link'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { MesocycleForm } from '@/components/mesocycle-form'
import { getAllNonCompletedMesocycles } from '@/lib/mesocycles/queries'

export const dynamic = 'force-dynamic'

export default async function NewMesocyclePage() {
  const existing = await getAllNonCompletedMesocycles()

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader
          title="New Mesocycle"
          breadcrumb={
            <Link href="/mesocycles" className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
              Mesocycles
            </Link>
          }
        />

        <MesocycleForm existingMesocycles={existing} />
      </div>
    </PageContainer>
  )
}
