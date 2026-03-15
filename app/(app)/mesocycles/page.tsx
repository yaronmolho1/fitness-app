import Link from 'next/link'
import { getMesocycles } from '@/lib/mesocycles/queries'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { StatusTransitionButton } from '@/components/status-transition-button'

export const dynamic = 'force-dynamic'

export default async function MesocyclesPage() {
  const allMesocycles = await getMesocycles()

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mesocycles</h1>
        <Button asChild>
          <Link href="/mesocycles/new">New Mesocycle</Link>
        </Button>
      </div>

      {allMesocycles.length === 0 ? (
        <p className="text-muted-foreground">No mesocycles yet</p>
      ) : (
        <ul className="space-y-4">
          {allMesocycles.map((meso) => (
            <li key={meso.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/mesocycles/${meso.id}`}
                      className="text-lg font-semibold transition-colors hover:text-primary hover:underline"
                    >
                      {meso.name}
                    </Link>
                    <StatusBadge status={meso.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{meso.start_date}</span>
                    <span>{meso.end_date}</span>
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
  )
}
