'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProgressionChart } from '@/components/progression-chart'
import { ProjectedTable } from '@/components/projected-table'
import { TrendingUp, CalendarDays } from 'lucide-react'
import type { ProjectedData } from '@/lib/progression/projected-queries'

type Exercise = {
  id: number
  name: string
  modality: string
  muscle_group: string | null
  equipment: string | null
  created_at: Date | null
}

type Props = {
  exercises: Exercise[]
  projectedData: ProjectedData | null
  isCompleted: boolean
}

export function ProgressionTabs({ exercises, projectedData, isCompleted }: Props) {
  return (
    <Tabs defaultValue="projected">
      <TabsList>
        <TabsTrigger value="projected" className="gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Projected
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="projected" className="mt-6">
        {projectedData ? (
          <ProjectedTable data={projectedData} isCompleted={isCompleted} />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-muted-foreground shadow-sm">
            <CalendarDays className="h-10 w-10 opacity-30" />
            <p>No active mesocycle</p>
            <p className="text-sm">Activate a mesocycle to see projected progressions</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-6">
        <ProgressionChart exercises={exercises} />
      </TabsContent>
    </Tabs>
  )
}
