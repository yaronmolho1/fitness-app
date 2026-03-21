import Link from 'next/link'
import { Layers } from 'lucide-react'
import { getMesocycles } from '@/lib/mesocycles/queries'
import { formatDateDisplay } from '@/lib/date-format'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { StatusTransitionButton } from '@/components/status-transition-button'

export const dynamic = 'force-dynamic'

export default async function MesocyclesPage() {
  const allMesocycles = await getMesocycles()

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader
          title="Mesocycles"
          actions={
            <Button asChild>
              <Link href="/mesocycles/new">New Mesocycle</Link>
            </Button>
          }
        />

        {allMesocycles.length === 0 ? (
          <EmptyState
            icon={Layers}
            message="No mesocycles yet"
            description="Create your first training block to get started."
            action={{ label: 'New Mesocycle', href: '/mesocycles/new' }}
          />
        ) : (
          <ul className="space-y-4">
            {allMesocycles.map((meso) => (
              <li key={meso.id} className="rounded-xl border bg-card p-4 shadow-sm transition-colors duration-150 hover:bg-muted/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/mesocycles/${meso.id}`}
                        className="text-lg font-semibold transition-colors duration-150 hover:text-primary hover:underline"
                      >
                        {meso.name}
                      </Link>
                      <StatusBadge status={meso.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatDateDisplay(meso.start_date)}</span>
                      <span>{formatDateDisplay(meso.end_date)}</span>
                      <span>{meso.work_weeks} weeks</span>
                      {meso.has_deload && <span>+ deload</span>}
                    </div>
                  </div>
                  <StatusTransitionButton mesocycleId={meso.id} status={meso.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  )
}
