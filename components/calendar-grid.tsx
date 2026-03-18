'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarDay } from '@/lib/calendar/queries'
import { DayDetailPanel } from '@/components/day-detail-panel'
import { getModalityClasses } from '@/lib/ui/modality-colors'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Ring-only treatment avoids bg-* conflicts with modality colors and bg-card
const DELOAD_RING = 'ring-2 ring-inset ring-purple-400 dark:ring-purple-500'
const DELOAD_CLASS = `deload ${DELOAD_RING}`

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// 0=Mon..6=Sun for a given date
function isoDow(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day)
  return (d.getDay() + 6) % 7
}

interface CalendarGridProps {
  /** Override initial month for testing (YYYY-MM) */
  initialMonth?: string
}

export function CalendarGrid({ initialMonth }: CalendarGridProps = {}) {
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
  }, [year, month, fetchMonth])

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

  // Build grid: pad leading empty cells for days before first of month
  const firstDow = isoDow(year, month, 1)
  const gridCells: (CalendarDay | null)[] = []
  for (let i = 0; i < firstDow; i++) {
    gridCells.push(null)
  }
  for (const day of days) {
    gridCells.push(day)
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
        <h2 className="text-lg font-semibold">{monthLabel(year, month)}</h2>
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

          const dayNum = parseInt(cell.date.split('-')[2], 10)
          const modalityClass = cell.modality ? getModalityClasses(cell.modality) : ''
          const isRest = !cell.modality
          const deloadClass = cell.is_deload ? DELOAD_CLASS : ''

          return (
            <div
              key={cell.date}
              data-testid={`calendar-day-${cell.date}`}
              data-status={cell.status}
              data-deload={String(cell.is_deload)}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDate(cell.date)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDate(cell.date) }}
              className={`bg-card min-h-[4.5rem] p-1.5 border cursor-pointer hover:bg-accent/50 transition-colors duration-150 ${isRest ? 'border-transparent' : modalityClass} ${deloadClass}`.trim()}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{dayNum}</span>
                {cell.status === 'completed' && (
                  <span
                    data-testid="completed-marker"
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-green-500 dark:bg-green-600"
                  >
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
              </div>
              {cell.template_name && (
                <p className="mt-0.5 text-[0.65rem] leading-tight truncate">
                  {cell.template_name}
                </p>
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
      <DayDetailPanel date={selectedDate} onClose={() => setSelectedDate(null)} />
    </div>
  )
}
