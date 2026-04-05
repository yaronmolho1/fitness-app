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

// -- Column structure types --

type ColumnGroup = {
  mesocycle: MesocycleProjection['mesocycle']
  weekCount: number
  isCompleted: boolean
}

// -- Unified resistance types --

type SlotCellData = {
  slot: SlotWithExercise
  weeks: MergedResistanceWeek[]
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
}

type UnifiedExerciseRow = {
  exerciseId: number
  exerciseName: string
  isMain: boolean
  cells: (SlotCellData | null)[]
}

type UnifiedTemplateGroup = {
  templateName: string
  canonicalName: string
  exercises: UnifiedExerciseRow[]
}

// -- Unified running/mma types --

type RunningCellData = {
  group: RunningGroup
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
}

type UnifiedRunningRow = {
  templateName: string
  sectionName: string
  runType: string | null
  cells: (RunningCellData | null)[]
}

type MmaCellData = {
  group: MmaGroup
  workWeeks: number
  hasDeload: boolean
  isCompleted: boolean
}

type UnifiedMmaRow = {
  templateName: string
  sectionName: string
  cells: (MmaCellData | null)[]
}

// -- Helpers --

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

// -- Data transformation --

function buildColumnGroups(data: ProjectedData): ColumnGroup[] {
  return data.map((p) => ({
    mesocycle: p.mesocycle,
    weekCount: p.mesocycle.workWeeks + (p.mesocycle.hasDeload ? 1 : 0),
    isCompleted: p.mesocycle.status === 'completed',
  }))
}

function buildUnifiedResistanceData(data: ProjectedData): UnifiedTemplateGroup[] {
  const groups: UnifiedTemplateGroup[] = []
  const seen = new Set<string>()

  for (let mesoIdx = 0; mesoIdx < data.length; mesoIdx++) {
    const projection = data[mesoIdx]
    for (const rg of projection.resistanceGroups) {
      const cn = rg.template.canonical_name
      if (seen.has(cn)) continue
      seen.add(cn)

      // Collect this template across all mesocycles
      const exerciseMap = new Map<number, UnifiedExerciseRow>()

      for (let mi = 0; mi < data.length; mi++) {
        const matchingGroup = data[mi].resistanceGroups.find(
          (g) => g.template.canonical_name === cn
        )
        if (!matchingGroup) continue

        for (const { slot, weeks } of matchingGroup.slots) {
          let row = exerciseMap.get(slot.exercise_id)
          if (!row) {
            row = {
              exerciseId: slot.exercise_id,
              exerciseName: slot.exercise_name,
              isMain: slot.is_main,
              cells: Array(data.length).fill(null),
            }
            exerciseMap.set(slot.exercise_id, row)
          }
          row.cells[mi] = {
            slot,
            weeks,
            workWeeks: data[mi].mesocycle.workWeeks,
            hasDeload: data[mi].mesocycle.hasDeload,
            isCompleted: data[mi].mesocycle.status === 'completed',
          }
        }
      }

      if (exerciseMap.size > 0) {
        groups.push({
          templateName: rg.template.name,
          canonicalName: cn,
          exercises: Array.from(exerciseMap.values()),
        })
      }
    }
  }

  return groups
}

function buildUnifiedRunningData(data: ProjectedData): UnifiedRunningRow[] {
  const rows: UnifiedRunningRow[] = []
  const seen = new Set<string>()

  for (let mesoIdx = 0; mesoIdx < data.length; mesoIdx++) {
    for (const rg of data[mesoIdx].runningGroups) {
      const key = `${rg.template.canonical_name}::${rg.section.id === 0 ? '__standalone__' : rg.section.section_name}`
      if (seen.has(key)) continue
      seen.add(key)

      const cells: (RunningCellData | null)[] = data.map((p, mi) => {
        const match = p.runningGroups.find(
          (g) =>
            g.template.canonical_name === rg.template.canonical_name &&
            (rg.section.id === 0
              ? g.section.id === 0
              : g.section.section_name === rg.section.section_name)
        )
        if (!match) return null
        return {
          group: match,
          workWeeks: p.mesocycle.workWeeks,
          hasDeload: p.mesocycle.hasDeload,
          isCompleted: p.mesocycle.status === 'completed',
        }
      })

      rows.push({
        templateName: rg.template.name,
        sectionName: rg.section.id === 0 ? rg.template.name : rg.section.section_name,
        runType: rg.section.run_type ?? rg.template.run_type ?? null,
        cells,
      })
    }
  }

  return rows
}

function buildUnifiedMmaData(data: ProjectedData): UnifiedMmaRow[] {
  const rows: UnifiedMmaRow[] = []
  const seen = new Set<string>()

  for (let mesoIdx = 0; mesoIdx < data.length; mesoIdx++) {
    for (const mg of data[mesoIdx].mmaGroups) {
      const key = `${mg.template.canonical_name}::${mg.section.id === 0 ? '__standalone__' : mg.section.section_name}`
      if (seen.has(key)) continue
      seen.add(key)

      const cells: (MmaCellData | null)[] = data.map((p) => {
        const match = p.mmaGroups.find(
          (g) =>
            g.template.canonical_name === mg.template.canonical_name &&
            (mg.section.id === 0
              ? g.section.id === 0
              : g.section.section_name === mg.section.section_name)
        )
        if (!match) return null
        return {
          group: match,
          workWeeks: p.mesocycle.workWeeks,
          hasDeload: p.mesocycle.hasDeload,
          isCompleted: p.mesocycle.status === 'completed',
        }
      })

      rows.push({
        templateName: mg.template.name,
        sectionName: mg.section.id === 0 ? mg.template.name : mg.section.section_name,
        cells,
      })
    }
  }

  return rows
}

// -- Table header components --

function MesoHeaders({ columnGroups }: { columnGroups: ColumnGroup[] }) {
  return (
    <tr className="border-b">
      <th
        rowSpan={2}
        className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left text-xs font-medium text-muted-foreground"
      >
        Exercise
      </th>
      {columnGroups.map((g) => (
        <th
          key={g.mesocycle.id}
          colSpan={g.weekCount}
          className="border-l px-3 py-1.5 text-center text-xs font-semibold"
        >
          <span>{g.mesocycle.name}</span>
          <span
            className={cn(
              'ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              g.mesocycle.status === 'active' &&
                'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
              g.mesocycle.status === 'planned' &&
                'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
              g.mesocycle.status === 'draft' &&
                'bg-muted text-muted-foreground'
            )}
          >
            {g.mesocycle.status}
          </span>
        </th>
      ))}
    </tr>
  )
}

function DateRow({ columnGroups }: { columnGroups: ColumnGroup[] }) {
  return (
    <tr className="border-b bg-muted/50">
      {columnGroups.map((g) =>
        Array.from({ length: g.mesocycle.workWeeks }, (_, i) => (
          <th
            key={`${g.mesocycle.id}-w${i + 1}`}
            className="whitespace-nowrap border-l px-3 py-1.5 text-center text-xs font-medium text-muted-foreground first:border-l"
          >
            {weekDate(g.mesocycle.startDate, i + 1)}
          </th>
        )).concat(
          g.mesocycle.hasDeload
            ? [
                <th
                  key={`${g.mesocycle.id}-deload`}
                  className="whitespace-nowrap px-3 py-1.5 text-center text-xs font-medium text-orange-500"
                >
                  {weekDate(g.mesocycle.startDate, g.mesocycle.workWeeks + 1)}
                </th>,
              ]
            : []
        )
      )}
    </tr>
  )
}

// -- Section components --

function UnifiedResistanceSection({
  groups,
  columnGroups,
  totalColumns,
  onSlotClick,
}: {
  groups: UnifiedTemplateGroup[]
  columnGroups: ColumnGroup[]
  totalColumns: number
  onSlotClick: (cell: SlotCellData) => void
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
            <MesoHeaders columnGroups={columnGroups} />
            <DateRow columnGroups={columnGroups} />
          </thead>
          <tbody>
            {groups.map((group) => (
              <>
                <tr key={`hdr-${group.canonicalName}`} className="bg-muted/30">
                  <td
                    colSpan={totalColumns}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    {group.templateName}
                  </td>
                </tr>
                {group.exercises.map((exercise) => (
                  <tr key={`${group.canonicalName}-${exercise.exerciseId}`} className="border-b">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-2 font-medium">
                      {exercise.exerciseName}
                      {exercise.isMain ? '' : (
                        <span className="ml-1 text-xs text-muted-foreground">(acc)</span>
                      )}
                    </td>
                    {exercise.cells.map((cell, mesoIdx) =>
                      cell
                        ? cell.weeks.map((week) => (
                            <td
                              key={`${columnGroups[mesoIdx].mesocycle.id}-w${week.weekNumber}`}
                              className={cn(
                                'whitespace-nowrap px-3 py-2 text-center text-xs transition-colors',
                                mesoIdx > 0 && week.weekNumber === 1 && 'border-l',
                                week.isDeload &&
                                  'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
                                !cell.isCompleted && 'cursor-pointer hover:bg-muted/40'
                              )}
                              onClick={() => !cell.isCompleted && onSlotClick(cell)}
                            >
                              {formatResistanceCell(week)}
                            </td>
                          ))
                        : Array.from(
                            { length: columnGroups[mesoIdx].weekCount },
                            (_, wi) => (
                              <td
                                key={`${columnGroups[mesoIdx].mesocycle.id}-empty-${wi}`}
                                className={cn(
                                  'whitespace-nowrap px-3 py-2 text-center text-xs text-muted-foreground',
                                  mesoIdx > 0 && wi === 0 && 'border-l'
                                )}
                              >
                                —
                              </td>
                            )
                          )
                    )}
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

function UnifiedRunningSection({
  rows,
  columnGroups,
  totalColumns,
  onRunningClick,
}: {
  rows: UnifiedRunningRow[]
  columnGroups: ColumnGroup[]
  totalColumns: number
  onRunningClick: (cell: RunningCellData) => void
}) {
  if (rows.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Footprints className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Running</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <MesoHeaders columnGroups={columnGroups} />
            <DateRow columnGroups={columnGroups} />
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-2 font-medium">
                  {row.sectionName}
                  {row.runType && (
                    <span className="ml-2 text-xs text-muted-foreground">{row.runType}</span>
                  )}
                </td>
                {row.cells.map((cell, mesoIdx) =>
                  cell
                    ? cell.group.weeks.map((week) => (
                        <td
                          key={`${columnGroups[mesoIdx].mesocycle.id}-w${week.weekNumber}`}
                          className={cn(
                            'whitespace-nowrap px-3 py-2 text-center text-xs transition-colors',
                            mesoIdx > 0 && week.weekNumber === 1 && 'border-l',
                            week.isDeload &&
                              'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
                            !cell.isCompleted && 'cursor-pointer hover:bg-muted/40'
                          )}
                          onClick={() => !cell.isCompleted && onRunningClick(cell)}
                        >
                          {formatRunningCell(week)}
                        </td>
                      ))
                    : Array.from(
                        { length: columnGroups[mesoIdx].weekCount },
                        (_, wi) => (
                          <td
                            key={`${columnGroups[mesoIdx].mesocycle.id}-empty-${wi}`}
                            className={cn(
                              'whitespace-nowrap px-3 py-2 text-center text-xs text-muted-foreground',
                              mesoIdx > 0 && wi === 0 && 'border-l'
                            )}
                          >
                            —
                          </td>
                        )
                      )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UnifiedMmaSection({
  rows,
  columnGroups,
  totalColumns,
  onMmaClick,
}: {
  rows: UnifiedMmaRow[]
  columnGroups: ColumnGroup[]
  totalColumns: number
  onMmaClick: (cell: MmaCellData) => void
}) {
  if (rows.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">MMA</h3>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <MesoHeaders columnGroups={columnGroups} />
            <DateRow columnGroups={columnGroups} />
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-2 font-medium">
                  {row.sectionName}
                </td>
                {row.cells.map((cell, mesoIdx) =>
                  cell
                    ? cell.group.weeks.map((week) => (
                        <td
                          key={`${columnGroups[mesoIdx].mesocycle.id}-w${week.weekNumber}`}
                          className={cn(
                            'whitespace-nowrap px-3 py-2 text-center text-xs transition-colors',
                            mesoIdx > 0 && week.weekNumber === 1 && 'border-l',
                            week.isDeload &&
                              'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
                            !cell.isCompleted && 'cursor-pointer hover:bg-muted/40'
                          )}
                          onClick={() => !cell.isCompleted && onMmaClick(cell)}
                        >
                          {formatMmaCell(week)}
                        </td>
                      ))
                    : Array.from(
                        { length: columnGroups[mesoIdx].weekCount },
                        (_, wi) => (
                          <td
                            key={`${columnGroups[mesoIdx].mesocycle.id}-empty-${wi}`}
                            className={cn(
                              'whitespace-nowrap px-3 py-2 text-center text-xs text-muted-foreground',
                              mesoIdx > 0 && wi === 0 && 'border-l'
                            )}
                          >
                            —
                          </td>
                        )
                      )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -- Modal state types --

type SlotModalState = { slot: SlotWithExercise; workWeeks: number; hasDeload: boolean; isCompleted: boolean }
type RunningModalState = { group: RunningGroup; workWeeks: number; hasDeload: boolean; isCompleted: boolean }
type MmaModalState = { group: MmaGroup; workWeeks: number; hasDeload: boolean; isCompleted: boolean }

// -- Main component --

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

  const columnGroups = buildColumnGroups(data)
  const totalColumns = 1 + columnGroups.reduce((sum, g) => sum + g.weekCount, 0)

  const resistanceGroups = buildUnifiedResistanceData(data)
  const runningRows = buildUnifiedRunningData(data)
  const mmaRows = buildUnifiedMmaData(data)

  const hasAnyData = resistanceGroups.length > 0 || runningRows.length > 0 || mmaRows.length > 0

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
    <div className="space-y-8">
      <UnifiedResistanceSection
        groups={resistanceGroups}
        columnGroups={columnGroups}
        totalColumns={totalColumns}
        onSlotClick={(cell) =>
          setSelectedSlot({
            slot: cell.slot,
            workWeeks: cell.workWeeks,
            hasDeload: cell.hasDeload,
            isCompleted: cell.isCompleted,
          })
        }
      />

      <UnifiedRunningSection
        rows={runningRows}
        columnGroups={columnGroups}
        totalColumns={totalColumns}
        onRunningClick={(cell) =>
          setSelectedRunning({
            group: cell.group,
            workWeeks: cell.workWeeks,
            hasDeload: cell.hasDeload,
            isCompleted: cell.isCompleted,
          })
        }
      />

      <UnifiedMmaSection
        rows={mmaRows}
        columnGroups={columnGroups}
        totalColumns={totalColumns}
        onMmaClick={(cell) =>
          setSelectedMma({
            group: cell.group,
            workWeeks: cell.workWeeks,
            hasDeload: cell.hasDeload,
            isCompleted: cell.isCompleted,
          })
        }
      />

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
