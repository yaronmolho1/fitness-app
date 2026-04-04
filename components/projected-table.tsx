'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { WeekProgressionGrid } from '@/components/week-progression-grid'
import { TemplateWeekGrid } from '@/components/template-week-grid'
import { Dumbbell, Footprints, Swords } from 'lucide-react'
import type {
  ProjectedData,
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
  isCompleted: boolean
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

function WeekHeader({ workWeeks, hasDeload }: { workWeeks: number; hasDeload: boolean }) {
  return (
    <>
      {Array.from({ length: workWeeks }, (_, i) => (
        <th key={i + 1} className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-muted-foreground">
          W{i + 1}
        </th>
      ))}
      {hasDeload && (
        <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-orange-500">
          Deload
        </th>
      )}
    </>
  )
}

function ResistanceSection({
  groups,
  workWeeks,
  hasDeload,
  isCompleted,
  onSlotClick,
}: {
  groups: ResistanceGroup[]
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  onSlotClick: (slot: SlotWithExercise) => void
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
              <WeekHeader workWeeks={workWeeks} hasDeload={hasDeload} />
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
                    onClick={() => !isCompleted && onSlotClick(slot)}
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
  workWeeks,
  hasDeload,
  isCompleted,
  onRunningClick,
}: {
  groups: RunningGroup[]
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  onRunningClick: (group: RunningGroup) => void
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
              <WeekHeader workWeeks={workWeeks} hasDeload={hasDeload} />
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
                onClick={() => !isCompleted && onRunningClick(group)}
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
  workWeeks,
  hasDeload,
  isCompleted,
  onMmaClick,
}: {
  groups: MmaGroup[]
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
  onMmaClick: (group: MmaGroup) => void
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
              <WeekHeader workWeeks={workWeeks} hasDeload={hasDeload} />
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
                onClick={() => !isCompleted && onMmaClick(group)}
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

export function ProjectedTable({ data, isCompleted }: Props) {
  const router = useRouter()
  const { mesocycle, resistanceGroups, runningGroups, mmaGroups } = data

  // Resistance modal state
  const [selectedSlot, setSelectedSlot] = useState<SlotWithExercise | null>(null)

  // Running modal state
  const [selectedRunning, setSelectedRunning] = useState<RunningGroup | null>(null)

  // MMA modal state
  const [selectedMma, setSelectedMma] = useState<MmaGroup | null>(null)

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setSelectedSlot(null)
      setSelectedRunning(null)
      setSelectedMma(null)
      router.refresh()
    }
  }

  const hasNoData = resistanceGroups.length === 0 && runningGroups.length === 0 && mmaGroups.length === 0

  if (hasNoData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-muted-foreground shadow-sm">
        <Dumbbell className="h-10 w-10 opacity-30" />
        <p>No templates in {mesocycle.name}</p>
        <p className="text-sm">Add templates and exercises to see projected progressions</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-sm text-muted-foreground">
        {mesocycle.name} — {mesocycle.workWeeks} weeks{mesocycle.hasDeload ? ' + deload' : ''}
      </div>

      <ResistanceSection
        groups={resistanceGroups}
        workWeeks={mesocycle.workWeeks}
        hasDeload={mesocycle.hasDeload}
        isCompleted={isCompleted}
        onSlotClick={setSelectedSlot}
      />

      <RunningSection
        groups={runningGroups}
        workWeeks={mesocycle.workWeeks}
        hasDeload={mesocycle.hasDeload}
        isCompleted={isCompleted}
        onRunningClick={setSelectedRunning}
      />

      <MmaSection
        groups={mmaGroups}
        workWeeks={mesocycle.workWeeks}
        hasDeload={mesocycle.hasDeload}
        isCompleted={isCompleted}
        onMmaClick={setSelectedMma}
      />

      {/* Resistance edit modal */}
      {selectedSlot && (
        <WeekProgressionGrid
          slot={selectedSlot}
          workWeeks={mesocycle.workWeeks}
          hasDeload={mesocycle.hasDeload}
          isCompleted={isCompleted}
          open={true}
          onOpenChange={handleModalClose}
        />
      )}

      {/* Running edit modal */}
      {selectedRunning && (
        <TemplateWeekGrid
          templateId={selectedRunning.template.id}
          sectionId={selectedRunning.section.id === 0 ? null : selectedRunning.section.id}
          workWeeks={mesocycle.workWeeks}
          hasDeload={mesocycle.hasDeload}
          isCompleted={isCompleted}
          open={true}
          onOpenChange={handleModalClose}
          title={selectedRunning.section.section_name}
          modality="running"
          runningBase={{
            distance: selectedRunning.section.target_distance ?? selectedRunning.template.target_distance ?? null,
            duration: selectedRunning.section.target_duration ?? selectedRunning.template.target_duration ?? null,
            pace: selectedRunning.section.target_pace ?? selectedRunning.template.target_pace ?? null,
            run_type: selectedRunning.section.run_type ?? selectedRunning.template.run_type ?? null,
            interval_count: selectedRunning.section.interval_count ?? selectedRunning.template.interval_count ?? null,
            interval_rest: selectedRunning.section.interval_rest ?? selectedRunning.template.interval_rest ?? null,
          }}
        />
      )}

      {/* MMA edit modal */}
      {selectedMma && (
        <TemplateWeekGrid
          templateId={selectedMma.template.id}
          sectionId={selectedMma.section.id === 0 ? null : selectedMma.section.id}
          workWeeks={mesocycle.workWeeks}
          hasDeload={mesocycle.hasDeload}
          isCompleted={isCompleted}
          open={true}
          onOpenChange={handleModalClose}
          title={selectedMma.section.section_name}
          modality="mma"
          mmaBase={{
            planned_duration: selectedMma.section.planned_duration ?? selectedMma.template.planned_duration ?? null,
          }}
        />
      )}
    </div>
  )
}
