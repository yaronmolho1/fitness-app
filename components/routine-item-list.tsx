'use client'

import { Badge } from '@/components/ui/badge'
import {
  formatInputFields,
  formatScopeSummary,
  type RoutineItemWithMesocycle,
} from '@/lib/routines/queries'

export function RoutineItemList({
  items,
}: {
  items: RoutineItemWithMesocycle[]
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">No routine items yet</p>
        <p className="mt-1">Create your first routine item to start tracking.</p>
      </div>
    )
  }

  return (
    <div className="divide-y rounded-lg border">
      {items.map(({ routine_item: item, mesocycle_name }) => (
        <div key={item.id} className="flex items-center gap-4 px-4 py-3">
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
        </div>
      ))}
    </div>
  )
}
