import Link from 'next/link'
import { PageContainer } from '@/components/layout/page-container'
import { MesocycleForm } from '@/components/mesocycle-form'

export default function NewMesocyclePage() {
  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <div className="space-y-1">
          <Link href="/mesocycles" className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
            Mesocycles
          </Link>
          <h1 className="text-2xl font-bold">New Mesocycle</h1>
        </div>

        <MesocycleForm />
      </div>
    </PageContainer>
  )
}
