/**
 * Pure date projection helpers for Google Calendar sync.
 * No DB or API dependencies — safe to import anywhere.
 */

/**
 * Project all calendar dates for a given day_of_week within a date range.
 * day_of_week uses ISO convention: 0=Monday, 6=Sunday.
 */
export function projectAffectedDates(
  startDate: string,
  endDate: string,
  dayOfWeek: number
): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')

  const current = new Date(start)
  const currentDow = (current.getUTCDay() + 6) % 7
  let diff = dayOfWeek - currentDow
  if (diff < 0) diff += 7
  current.setUTCDate(current.getUTCDate() + diff)

  while (current <= end) {
    const y = current.getUTCFullYear()
    const m = String(current.getUTCMonth() + 1).padStart(2, '0')
    const d = String(current.getUTCDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setUTCDate(current.getUTCDate() + 7)
  }

  return dates
}

/**
 * Get all 7 dates for a specific week number within a mesocycle.
 * Week 1 starts at startDate, each week is 7 days.
 */
export function projectWeekDates(startDate: string, weekNumber: number): string[] {
  const start = new Date(startDate + 'T00:00:00Z')
  const weekStart = new Date(start)
  weekStart.setUTCDate(start.getUTCDate() + (weekNumber - 1) * 7)

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${day}`)
  }

  return dates
}

/**
 * Compute the calendar date for a given week + day within a mesocycle.
 * start_date is a Monday (day 0 = Monday). day_of_week 0-6.
 */
export function getDateForWeekDay(startDate: string, weekNumber: number, dayOfWeek: number): string {
  const start = new Date(startDate + 'T00:00:00Z')
  const daysOffset = (weekNumber - 1) * 7 + dayOfWeek
  const target = new Date(start)
  target.setUTCDate(start.getUTCDate() + daysOffset)
  const y = target.getUTCFullYear()
  const m = String(target.getUTCMonth() + 1).padStart(2, '0')
  const d = String(target.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
