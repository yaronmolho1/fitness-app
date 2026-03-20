'use client'

import { SectionHeading } from '@/components/layout/section-heading'
import { ScheduleGrid } from '@/components/schedule-grid'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ScheduleEntry, TemplateOption } from '@/lib/schedule/queries'

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
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <SectionHeading>Weekly Schedule</SectionHeading>
      </div>

      {hasDeload ? (
        <Tabs defaultValue="normal">
          <TabsList>
            <TabsTrigger value="normal" data-testid="tab-normal">
              Normal
            </TabsTrigger>
            <TabsTrigger value="deload" data-testid="tab-deload">
              Deload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="normal">
            <ScheduleGrid
              mesocycleId={mesocycleId}
              templates={templates}
              schedule={normalSchedule}
              isCompleted={isCompleted}
              variant="normal"
            />
          </TabsContent>

          <TabsContent value="deload">
            <ScheduleGrid
              mesocycleId={mesocycleId}
              templates={templates}
              schedule={deloadSchedule}
              isCompleted={isCompleted}
              variant="deload"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ScheduleGrid
          mesocycleId={mesocycleId}
          templates={templates}
          schedule={normalSchedule}
          isCompleted={isCompleted}
          variant="normal"
        />
      )}
    </div>
  )
}
