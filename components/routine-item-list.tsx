'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { formatInputFields, formatScopeSummary } from '@/lib/routines/format'
import type { RoutineItemWithMesocycle } from '@/lib/routines/queries'
import { deleteRoutineItem } from '@/lib/routines/actions'
import { EditRoutineItemForm } from '@/components/edit-routine-item-form'

type Mesocycle = { id: number; name: string }

export function RoutineItemList({
  items,
  mesocycles,
}: {
  items: RoutineItemWithMesocycle[]
  mesocycles: Mesocycle[]
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const router = useRouter()

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"?`)) return
    const result = await deleteRoutineItem(id)
    if (result.success) {
      router.refresh()
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        message="No routine items yet"
        description="Create your first routine item to start tracking."
      />
    )
  }

  return (
    <div className="divide-y rounded-xl border">
      {items.map(({ routine_item: item, mesocycle_name }) => (
        <div key={item.id} className="px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
          {editingId === item.id ? (
            <EditRoutineItemForm
              item={item}
              mesocycles={mesocycles}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null)
                router.refresh()
              }}
            />
          ) : (
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.category && (
                    <Badge variant="secondary">{item.category}</Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{formatInputFields(item)}</span>
                  <span>{item.frequency_target}x/week</span>
                  <span>
                    {formatScopeSummary(
                      item.scope,
                      item.skip_on_deload,
                      mesocycle_name,
                      item.start_date,
                      item.end_date
                    )}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingId(item.id)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id, item.name)}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
