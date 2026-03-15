'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarDay } from '@/lib/calendar/queries'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MODALITY_CLASSES: Record<string, string> = {
  resistance: 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200 modality-resistance',
  running: 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200 modality-running',
  mma: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200 modality-mma',
}

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
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
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
          const modalityClass = cell.modality ? MODALITY_CLASSES[cell.modality] ?? '' : ''
          const isRest = !cell.modality

          return (
            <div
              key={cell.date}
              data-testid={`calendar-day-${cell.date}`}
              className={`bg-card min-h-[4.5rem] p-1.5 border ${isRest ? 'border-transparent' : modalityClass}`}
            >
              <span className="text-xs font-medium">{dayNum}</span>
              {cell.template_name && (
                <p className="mt-0.5 text-[0.65rem] leading-tight truncate">
                  {cell.template_name}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
