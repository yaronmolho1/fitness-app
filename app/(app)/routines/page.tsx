import { getRoutineItems } from '@/lib/routines/queries'
import { RoutineItemList } from '@/components/routine-item-list'

export const dynamic = 'force-dynamic'

export default async function RoutinesPage() {
  const items = await getRoutineItems()

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Routines</h1>
      </div>

      <RoutineItemList items={items} />
    </div>
  )
}
