import { getRoutineItems } from '@/lib/routines/queries'
import { getMesocycles } from '@/lib/mesocycles/queries'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { RoutineItemList } from '@/components/routine-item-list'

export const dynamic = 'force-dynamic'

export default async function RoutinesPage() {
  const [items, allMesocycles] = await Promise.all([
    getRoutineItems(),
    getMesocycles(),
  ])

  const mesocycles = allMesocycles.map((m) => ({ id: m.id, name: m.name }))

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6">
        <PageHeader title="Routines" className="mb-0" />
        <RoutineItemList items={items} mesocycles={mesocycles} />
      </div>
    </PageContainer>
  )
}
