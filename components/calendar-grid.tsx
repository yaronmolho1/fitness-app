'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarDay } from '@/lib/calendar/queries'
import { DayDetailPanel } from '@/components/day-detail-panel'
import { SectionHeading } from '@/components/layout/section-heading'
import { getModalityClasses, getModalityBadgeClasses, getModalityAccentClass } from '@/lib/ui/modality-colors'
import { DAY_LABELS } from '@/lib/day-mapping'

const DAY_HEADERS = DAY_LABELS

// Ring-only treatment avoids bg-* conflicts with modality colors and bg-card
const DELOAD_RING = 'ring-2 ring-inset ring-purple-400 dark:ring-purple-500'
const DELOAD_CLASS = `deload ${DELOAD_RING}`

const PERIOD_LABELS: Record<string, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
}

type DayGroup = {
  date: string
  entries: CalendarDay[]
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// 0=Sun..6=Sat for grid offset (matches Sun-start display)
function gridDow(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay()
}

// Sort entries chronologically by time_slot, template name as tiebreaker
function sortChronologically(entries: CalendarDay[]): CalendarDay[] {
  return [...entries].sort((a, b) => {
    const aSlot = a.time_slot ?? ''
    const bSlot = b.time_slot ?? ''
    if (aSlot !== bSlot) return aSlot.localeCompare(bSlot)
    return (a.template_name ?? '').localeCompare(b.template_name ?? '')
  })
}

// Format pill prefix: prefer time_slot, fall back to period label
function pillPrefix(entry: CalendarDay): string {
  if (entry.time_slot) return entry.time_slot
  if (entry.period) return PERIOD_LABELS[entry.period] ?? ''
  return ''
}

// Group flat CalendarDay[] into one group per unique date, preserving order
function groupByDate(days: CalendarDay[]): DayGroup[] {
  const map = new Map<string, CalendarDay[]>()
  for (const d of days) {
    if (!map.has(d.date)) {
      map.set(d.date, [])
    }
    map.get(d.date)!.push(d)
  }
  return Array.from(map.entries()).map(([date, entries]) => ({
    date,
    entries: sortChronologically(entries),
  }))
}

interface CalendarGridProps {
  /** Override initial month for testing (YYYY-MM) */
  initialMonth?: string
  /** Bump to trigger a refetch (e.g. after logging/moving workouts) */
  refreshKey?: number
}

export function CalendarGrid({ initialMonth, refreshKey }: CalendarGridProps = {}) {
  const now = new Date()
  const initYear = initialMonth ? parseInt(initialMonth.split('-')[0], 10) : now.getFullYear()
  const initMonth = initialMonth ? parseInt(initialMonth.split('-')[1], 10) : now.getMonth() + 1
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const [days, setDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const fetchMonth = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendar?month=${formatMonth(y, m)}`)
      const data = await res.json()
      setDays(data.days ?? [])
    } catch {
      setDays([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMonth(year, month)
  }, [year, month, fetchMonth, refreshKey])

  function goPrev() {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  function goNext() {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  const hasDeloadDays = days.some((d) => d.is_deload)

  // Group entries by date for multi-workout rendering
  const dayGroups = useMemo(() => groupByDate(days), [days])

  // Build grid: pad leading empty cells for days before first of month
  const firstDow = gridDow(year, month, 1)
  const gridCells: (DayGroup | null)[] = []
  for (let i = 0; i < firstDow; i++) {
    gridCells.push(null)
  }
  for (const group of dayGroups) {
    gridCells.push(group)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goPrev} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <SectionHeading className="mt-0 mb-0">{monthLabel(year, month)}</SectionHeading>
        <Button variant="outline" size="icon" onClick={goNext} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {/* Day headers */}
        {DAY_HEADERS.map((h) => (
          <div key={h} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {h}
          </div>
        ))}

        {/* Day cells */}
        {gridCells.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className="bg-card min-h-[4.5rem]" />
          }

          const { date, entries } = cell
          const dayNum = parseInt(date.split('-')[2], 10)
          const first = entries[0]
          const hasWorkouts = entries.some((e) => e.template_name !== null)
          const hasCompleted = entries.some((e) => e.status === 'completed')
          const isRest = !hasWorkouts
          const deloadClass = first.is_deload ? DELOAD_CLASS : ''

          // Status: use first entry for data attribute (backward compat)
          const cellStatus = hasWorkouts
            ? (hasCompleted ? 'completed' : 'projected')
            : 'rest'

          return (
            <div
              key={date}
              data-testid={`calendar-day-${date}`}
              data-status={cellStatus}
              data-deload={String(first.is_deload)}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDate(date)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDate(date) }}
              className={`bg-card min-h-[5.5rem] p-1.5 border border-transparent cursor-pointer hover:bg-accent/50 transition-colors duration-150 ${deloadClass}`.trim()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{dayNum}</span>
                {hasCompleted && (
                  <span
                    data-testid="completed-marker"
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-green-500 dark:bg-green-600"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
              </div>

              {hasWorkouts && (
                <div className="mt-1 flex flex-col gap-0.5">
                  {entries
                    .filter((e) => e.template_name !== null)
                    .map((entry, idx) => {
                      const prefix = entry.time_slot
                        ? entry.time_slot
                        : entry.period
                          ? PERIOD_LABELS[entry.period]
                          : null
                      return (
                        <div
                          key={entry.time_slot ?? entry.period ?? idx}
                          data-testid="workout-pill"
                          className={`border-l-2 pl-1.5 py-0.5 text-[0.65rem] leading-tight truncate ${
                            entry.modality ? getModalityAccentClass(entry.modality) : ''
                          }`}
                        >
                          {prefix && <span className="font-semibold">{prefix} </span>}
                          {entry.template_name}
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      {hasDeloadDays && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-block h-3 w-3 rounded ${DELOAD_RING}`} />
          <span>Deload week</span>
        </div>
      )}

      {/* Day detail panel */}
      <DayDetailPanel date={selectedDate} onClose={() => setSelectedDate(null)} onMutate={() => fetchMonth(year, month)} />
    </div>
  )
}
