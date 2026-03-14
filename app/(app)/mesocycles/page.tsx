import Link from 'next/link'
import { getMesocycles } from '@/lib/mesocycles/queries'

export const dynamic = 'force-dynamic'

export default async function MesocyclesPage() {
  const allMesocycles = await getMesocycles()

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mesocycles</h1>
        <Link
          href="/mesocycles/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Mesocycle
        </Link>
      </div>

      {allMesocycles.length === 0 ? (
        <p className="text-muted-foreground">No mesocycles yet</p>
      ) : (
        <ul className="space-y-4">
          {allMesocycles.map((meso) => (
            <li key={meso.id} className="rounded-lg border p-4">
              <Link
                href={`/mesocycles/${meso.id}`}
                className="text-lg font-semibold hover:underline"
              >
                {meso.name}
              </Link>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{meso.status}</span>
                <span>{meso.start_date}</span>
                <span>{meso.end_date}</span>
                <span>{meso.work_weeks} weeks</span>
                {meso.has_deload && <span>+ deload</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
