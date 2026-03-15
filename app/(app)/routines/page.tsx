import { getRoutineItems } from '@/lib/routines/queries'
import { getMesocycles } from '@/lib/mesocycles/queries'
import { RoutineItemList } from '@/components/routine-item-list'

export const dynamic = 'force-dynamic'

export default async function RoutinesPage() {
  const [items, allMesocycles] = await Promise.all([
    getRoutineItems(),
    getMesocycles(),
  ])

  const mesocycles = allMesocycles.map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Routines</h1>
      </div>

      <RoutineItemList items={items} mesocycles={mesocycles} />
    </div>
  )
}
