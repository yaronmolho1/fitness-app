'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { WeekProgressionGrid } from '@/components/week-progression-grid'
import { TemplateWeekGrid } from '@/components/template-week-grid'
import { Dumbbell, Footprints, Swords } from 'lucide-react'
import type {
  ProjectedData,
  MesocycleProjection,
  ResistanceGroup,
  RunningGroup,
  MmaGroup,
  MergedResistanceWeek,
  MergedRunningWeek,
  MergedMmaWeek,
} from '@/lib/progression/projected-queries'
import type { SlotWithExercise } from '@/lib/templates/slot-queries'

type Props = {
  data: ProjectedData
}

// Compute week start date from mesocycle start_date + week number
function weekDate(startDate: string, weekNumber: number): string {
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + (weekNumber - 1) * 7)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function formatResistanceCell(week: MergedResistanceWeek): string {
  const parts: string[] = []
  if (week.weight !== null) parts.push(`${week.weight}kg`)
  parts.push(`${week.sets}×${week.reps}`)
  if (week.rpe !== null) parts.push(`@${week.rpe}`)
  return parts.join(' ')
}

function formatRunningCell(week: MergedRunningWeek): string {
  const parts: string[] = []
  if (week.distance !== null) parts.push(`${week.distance}km`)
  if (week.pace) parts.push(week.pace)
  if (week.duration !== null) parts.push(`${week.duration}min`)
  if (week.interval_count !== null) parts.push(`${week.interval_count}×`)
  if (week.interval_rest !== null) parts.push(`${week.interval_rest}s rest`)
  if (week.elevation_gain !== null) parts.push(`${week.elevation_gain}m↑`)
  return parts.join(' · ') || '—'
}

function formatMmaCell(week: MergedMmaWeek): string {
  if (week.planned_duration !== null) return `${week.planned_duration} min`
  return '—'
}

function DateHeaders({ startDate, workWeeks, hasDeload }: { startDate: string; workWeeks: number; hasDeload: boolean }) {
  return (
    <>
      {Array.from({ length: workWeeks }, (_, i) => (
        <th key={i + 1} className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-muted-foreground">
          {weekDate(startDate, i + 1)}
        </th>
      ))}
      {hasDeload && (
        <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-orange-500">
          {weekDate(startDate, workWeeks + 1)}
        </th>
      )}
    </>
  )
}

function ResistanceSection({
  groups,
  startDate,
  workWeeks,
  hasDeload,
  isCompleted,
  onSlotClick,
}: {
  groups: ResistanceGroup[]
  startDate: string
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  onSlotClick: (slot: SlotWithExercise, workWeeks: number, hasDeload: boolean, isCompleted: boolean) => void
}) {
  if (groups.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Resistance</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Exercise</th>
              <DateHeaders startDate={startDate} workWeeks={workWeeks} hasDeload={hasDeload} />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <>
                <tr key={`header-${group.template.id}`} className="bg-muted/30">
                  <td colSpan={workWeeks + (hasDeload ? 2 : 1)} className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {group.template.name}
                  </td>
                </tr>
                {group.slots.map(({ slot, weeks }) => (
                  <tr
                    key={slot.id}
                    className={cn(
                      'border-b transition-colors',
                      !isCompleted && 'cursor-pointer hover:bg-muted/40'
                    )}
                    onClick={() => !isCompleted && onSlotClick(slot, workWeeks, hasDeload, isCompleted)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {slot.exercise_name}
                      {slot.is_main ? '' : <span className="ml-1 text-xs text-muted-foreground">(acc)</span>}
                    </td>
                    {weeks.map((week) => (
                      <td
                        key={week.weekNumber}
                        className={cn(
                          'whitespace-nowrap px-3 py-2 text-center text-xs',
                          week.isDeload && 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400'
                        )}
                      >
                        {formatResistanceCell(week)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RunningSection({
  groups,
  startDate,
  workWeeks,
  hasDeload,
  isCompleted,
  onRunningClick,
}: {
  groups: RunningGroup[]
  startDate: string
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  onRunningClick: (group: RunningGroup, workWeeks: number, hasDeload: boolean, isCompleted: boolean) => void
}) {
  if (groups.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Footprints className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Running</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Template</th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
              <DateHeaders startDate={startDate} workWeeks={workWeeks} hasDeload={hasDeload} />
            </tr>
          </thead>
          <tbody>
            {groups.map((group, idx) => (
              <tr
                key={`${group.template.id}-${group.section.id}-${idx}`}
                className={cn(
                  'border-b transition-colors',
                  !isCompleted && 'cursor-pointer hover:bg-muted/40'
                )}
                onClick={() => !isCompleted && onRunningClick(group, workWeeks, hasDeload, isCompleted)}
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {group.section.id === 0 ? group.template.name : group.section.section_name}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {group.section.run_type ?? group.template.run_type ?? '—'}
                </td>
                {group.weeks.map((week) => (
                  <td
                    key={week.weekNumber}
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-center text-xs',
                      week.isDeload && 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400'
                    )}
                  >
                    {formatRunningCell(week)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MmaSection({
  groups,
  startDate,
  workWeeks,
  hasDeload,
  isCompleted,
  onMmaClick,
}: {
  groups: MmaGroup[]
  startDate: string
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  onMmaClick: (group: MmaGroup, workWeeks: number, hasDeload: boolean, isCompleted: boolean) => void
}) {
  if (groups.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">MMA</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground">Template</th>
              <DateHeaders startDate={startDate} workWeeks={workWeeks} hasDeload={hasDeload} />
            </tr>
          </thead>
          <tbody>
            {groups.map((group, idx) => (
              <tr
                key={`${group.template.id}-${group.section.id}-${idx}`}
                className={cn(
                  'border-b transition-colors',
                  !isCompleted && 'cursor-pointer hover:bg-muted/40'
                )}
                onClick={() => !isCompleted && onMmaClick(group, workWeeks, hasDeload, isCompleted)}
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {group.section.id === 0 ? group.template.name : group.section.section_name}
                </td>
                {group.weeks.map((week) => (
                  <td
                    key={week.weekNumber}
                    className={cn(
                      'whitespace-nowrap px-3 py-2 text-center text-xs',
                      week.isDeload && 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400'
                    )}
                  >
                    {formatMmaCell(week)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type SlotModalState = { slot: SlotWithExercise; workWeeks: number; hasDeload: boolean; isCompleted: boolean }
type RunningModalState = { group: RunningGroup; workWeeks: number; hasDeload: boolean; isCompleted: boolean }
type MmaModalState = { group: MmaGroup; workWeeks: number; hasDeload: boolean; isCompleted: boolean }

export function ProjectedTable({ data }: Props) {
  const router = useRouter()

  const [selectedSlot, setSelectedSlot] = useState<SlotModalState | null>(null)
  const [selectedRunning, setSelectedRunning] = useState<RunningModalState | null>(null)
  const [selectedMma, setSelectedMma] = useState<MmaModalState | null>(null)

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setSelectedSlot(null)
      setSelectedRunning(null)
      setSelectedMma(null)
      router.refresh()
    }
  }

  const hasAnyData = data.some(
    (p) => p.resistanceGroups.length > 0 || p.runningGroups.length > 0 || p.mmaGroups.length > 0
  )

  if (!hasAnyData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-muted-foreground shadow-sm">
        <Dumbbell className="h-10 w-10 opacity-30" />
        <p>No templates with exercises</p>
        <p className="text-sm">Add templates and exercises to see projected progressions</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {data.map((projection) => {
        const { mesocycle, resistanceGroups, runningGroups, mmaGroups } = projection
        const isCompleted = mesocycle.status === 'completed'
        const hasData = resistanceGroups.length > 0 || runningGroups.length > 0 || mmaGroups.length > 0

        if (!hasData) return null

        return (
          <div key={mesocycle.id} className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">{mesocycle.name}</h2>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                mesocycle.status === 'active' && 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
                mesocycle.status === 'planned' && 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
              )}>
                {mesocycle.status}
              </span>
              <span className="text-sm text-muted-foreground">
                {mesocycle.workWeeks} weeks{mesocycle.hasDeload ? ' + deload' : ''}
              </span>
            </div>

            <ResistanceSection
              groups={resistanceGroups}
              startDate={mesocycle.startDate}
              workWeeks={mesocycle.workWeeks}
              hasDeload={mesocycle.hasDeload}
              isCompleted={isCompleted}
              onSlotClick={(slot, ww, hd, ic) => setSelectedSlot({ slot, workWeeks: ww, hasDeload: hd, isCompleted: ic })}
            />

            <RunningSection
              groups={runningGroups}
              startDate={mesocycle.startDate}
              workWeeks={mesocycle.workWeeks}
              hasDeload={mesocycle.hasDeload}
              isCompleted={isCompleted}
              onRunningClick={(group, ww, hd, ic) => setSelectedRunning({ group, workWeeks: ww, hasDeload: hd, isCompleted: ic })}
            />

            <MmaSection
              groups={mmaGroups}
              startDate={mesocycle.startDate}
              workWeeks={mesocycle.workWeeks}
              hasDeload={mesocycle.hasDeload}
              isCompleted={isCompleted}
              onMmaClick={(group, ww, hd, ic) => setSelectedMma({ group, workWeeks: ww, hasDeload: hd, isCompleted: ic })}
            />
          </div>
        )
      })}

      {selectedSlot && (
        <WeekProgressionGrid
          slot={selectedSlot.slot}
          workWeeks={selectedSlot.workWeeks}
          hasDeload={selectedSlot.hasDeload}
          isCompleted={selectedSlot.isCompleted}
          open={true}
          onOpenChange={handleModalClose}
        />
      )}

      {selectedRunning && (
        <TemplateWeekGrid
          templateId={selectedRunning.group.template.id}
          sectionId={selectedRunning.group.section.id === 0 ? null : selectedRunning.group.section.id}
          workWeeks={selectedRunning.workWeeks}
          hasDeload={selectedRunning.hasDeload}
          isCompleted={selectedRunning.isCompleted}
          open={true}
          onOpenChange={handleModalClose}
          title={selectedRunning.group.section.section_name}
          modality="running"
          runningBase={{
            distance: selectedRunning.group.section.target_distance ?? selectedRunning.group.template.target_distance ?? null,
            duration: selectedRunning.group.section.target_duration ?? selectedRunning.group.template.target_duration ?? null,
            pace: selectedRunning.group.section.target_pace ?? selectedRunning.group.template.target_pace ?? null,
            run_type: selectedRunning.group.section.run_type ?? selectedRunning.group.template.run_type ?? null,
            interval_count: selectedRunning.group.section.interval_count ?? selectedRunning.group.template.interval_count ?? null,
            interval_rest: selectedRunning.group.section.interval_rest ?? selectedRunning.group.template.interval_rest ?? null,
          }}
        />
      )}

      {selectedMma && (
        <TemplateWeekGrid
          templateId={selectedMma.group.template.id}
          sectionId={selectedMma.group.section.id === 0 ? null : selectedMma.group.section.id}
          workWeeks={selectedMma.workWeeks}
          hasDeload={selectedMma.hasDeload}
          isCompleted={selectedMma.isCompleted}
          open={true}
          onOpenChange={handleModalClose}
          title={selectedMma.group.section.section_name}
          modality="mma"
          mmaBase={{
            planned_duration: selectedMma.group.section.planned_duration ?? selectedMma.group.template.planned_duration ?? null,
          }}
        />
      )}
    </div>
  )
}
