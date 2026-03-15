'use client'

import { useState } from 'react'
import { ScheduleGrid } from '@/components/schedule-grid'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'

type Variant = 'normal' | 'deload'

type Props = {
  mesocycleId: number
  templates: TemplateOption[]
  normalSchedule: ScheduleEntry[]
  deloadSchedule: ScheduleEntry[]
  hasDeload: boolean
  isCompleted: boolean
}

export function ScheduleTabs({
  mesocycleId,
  templates,
  normalSchedule,
  deloadSchedule,
  hasDeload,
  isCompleted,
}: Props) {
  const [activeTab, setActiveTab] = useState<Variant>('normal')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Weekly Schedule</h2>
      </div>

      {hasDeload && (
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Schedule variant">
          <button
            role="tab"
            aria-selected={activeTab === 'normal'}
            data-testid="tab-normal"
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'normal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('normal')}
          >
            Normal
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'deload'}
            data-testid="tab-deload"
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'deload'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('deload')}
          >
            Deload
          </button>
        </div>
      )}

      {activeTab === 'normal' && (
        <ScheduleGrid
          mesocycleId={mesocycleId}
          templates={templates}
          schedule={normalSchedule}
          isCompleted={isCompleted}
          variant="normal"
        />
      )}

      {activeTab === 'deload' && hasDeload && (
        <ScheduleGrid
          mesocycleId={mesocycleId}
          templates={templates}
          schedule={deloadSchedule}
          isCompleted={isCompleted}
          variant="deload"
        />
      )}
    </div>
  )
}
