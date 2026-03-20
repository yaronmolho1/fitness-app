import type { routine_items, mesocycles } from '@/lib/db/schema'

export type RoutineItemRow = typeof routine_items.$inferSelect
export type MesocycleRow = typeof mesocycles.$inferSelect

// Add days to a YYYY-MM-DD string, returning YYYY-MM-DD (DST-safe via UTC)
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// True when today falls in the deload week (last week) of a mesocycle with has_deload
export function isDeloadWeek(today: string, meso: MesocycleRow): boolean {
  if (!meso.has_deload) return false
  if (today < meso.start_date || today > meso.end_date) return false

  // Deload starts after all work weeks
  const deloadStart = addDays(meso.start_date, meso.work_weeks * 7)
  return today >= deloadStart
}

function isInDateRange(today: string, start: string, end: string): boolean {
  return today >= start && today <= end
}

// Day-of-week (0=Sunday) from a YYYY-MM-DD string (UTC-safe)
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay()
}

// Check if item passes frequency_mode filter for the given date
function passesFrequencyFilter(item: RoutineItemRow, today: string): boolean {
  if (item.frequency_mode !== 'specific_days') return true
  if (!item.frequency_days || item.frequency_days.length === 0) return false
  return item.frequency_days.includes(getDayOfWeek(today))
}

// Filter routine items to only those active for the given date
export function filterActiveRoutineItems(
  items: RoutineItemRow[],
  allMesocycles: MesocycleRow[],
  today: string
): RoutineItemRow[] {
  const activeMesos = allMesocycles.filter((m) => m.status === 'active')
  const inDeload = activeMesos.some((m) => isDeloadWeek(today, m))

  return items.filter((item) => {
    // Check skip_on_deload first — applies to any scope
    if (item.skip_on_deload && inDeload) return false

    // Scope check
    let scopePass = false
    switch (item.scope) {
      case 'global':
        scopePass = true
        break

      case 'mesocycle': {
        const meso = allMesocycles.find((m) => m.id === item.mesocycle_id)
        if (!meso || meso.status !== 'active') return false
        scopePass = isInDateRange(today, meso.start_date, meso.end_date)
        break
      }

      case 'date_range': {
        if (!item.start_date || !item.end_date) return false
        scopePass = isInDateRange(today, item.start_date, item.end_date)
        break
      }

      default:
        return false
    }

    if (!scopePass) return false

    // Frequency mode filter (after scope passes)
    return passesFrequencyFilter(item, today)
  })
}
