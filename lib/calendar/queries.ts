import { and, gte, lte, eq, inArray } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  mesocycles,
  weekly_schedule,
  workout_templates,
  logged_workouts,
  schedule_week_overrides,
} from '@/lib/db/schema'

export type CalendarDay = {
  date: string
  template_name: string | null
  modality: 'resistance' | 'running' | 'mma' | 'mixed' | null
  mesocycle_id: number | null
  is_deload: boolean
  status: 'completed' | 'projected' | 'rest'
  period: 'morning' | 'afternoon' | 'evening' | null
  time_slot: string | null
}

export type CalendarProjection = {
  days: CalendarDay[]
}

const PERIOD_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
}

// Returns 0=Monday..6=Sunday from a YYYY-MM-DD string
function isoDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  // JS getDay: 0=Sun..6=Sat -> convert to 0=Mon..6=Sun
  return (d.getDay() + 6) % 7
}

// Number of days between two YYYY-MM-DD dates
function daysBetween(startDate: string, date: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(date + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

// Generate all YYYY-MM-DD strings for a given YYYY-MM month
function daysInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number)
  const days: string[] = []
  // Last day: day 0 of next month
  const lastDay = new Date(year, mon, 0).getDate()
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

type MesocycleRow = {
  id: number
  start_date: string
  end_date: string
  work_weeks: number
  has_deload: boolean | number
}

type ScheduleRow = {
  mesocycle_id: number
  day_of_week: number
  template_id: number | null
  week_type: string
  template_name: string | null
  modality: string | null
  period: string
  time_slot: string | null
}

type OverrideRow = {
  mesocycle_id: number
  week_number: number
  day_of_week: number
  period: string
  template_id: number | null
  template_name: string | null
  modality: string | null
  time_slot: string | null
}

export async function getCalendarProjection(
  database: AppDb,
  month: string
): Promise<CalendarProjection> {
  const dates = daysInMonth(month)
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]

  // Fetch mesocycles overlapping this month
  const mesoRows = database
    .select({
      id: mesocycles.id,
      start_date: mesocycles.start_date,
      end_date: mesocycles.end_date,
      work_weeks: mesocycles.work_weeks,
      has_deload: mesocycles.has_deload,
    })
    .from(mesocycles)
    .where(and(lte(mesocycles.start_date, lastDate), gte(mesocycles.end_date, firstDate)))
    .all() as MesocycleRow[]

  // Build schedule lookup: mesocycle_id -> Map<`${day_of_week}-${week_type}`, ScheduleRow[]>
  const scheduleLookup = new Map<number, Map<string, ScheduleRow[]>>()

  if (mesoRows.length > 0) {
    const mesoIds = mesoRows.map((m) => m.id)

    const scheduleRows = database
      .select({
        mesocycle_id: weekly_schedule.mesocycle_id,
        day_of_week: weekly_schedule.day_of_week,
        template_id: weekly_schedule.template_id,
        week_type: weekly_schedule.week_type,
        template_name: workout_templates.name,
        modality: workout_templates.modality,
        period: weekly_schedule.period,
        time_slot: weekly_schedule.time_slot,
      })
      .from(weekly_schedule)
      .leftJoin(workout_templates, eq(weekly_schedule.template_id, workout_templates.id))
      .where(inArray(weekly_schedule.mesocycle_id, mesoIds))
      .all() as ScheduleRow[]

    for (const row of scheduleRows) {
      if (!scheduleLookup.has(row.mesocycle_id)) {
        scheduleLookup.set(row.mesocycle_id, new Map())
      }
      const key = `${row.day_of_week}-${row.week_type}`
      const mesoMap = scheduleLookup.get(row.mesocycle_id)!
      if (!mesoMap.has(key)) {
        mesoMap.set(key, [])
      }
      mesoMap.get(key)!.push(row)
    }
  }

  // Batch-load schedule_week_overrides for overlapping mesocycles
  // Key: `${mesocycle_id}-${week_number}-${day_of_week}-${period}`
  const overrideLookup = new Map<string, OverrideRow>()

  if (mesoRows.length > 0) {
    const mesoIds = mesoRows.map((m) => m.id)

    const overrideRows = database
      .select({
        mesocycle_id: schedule_week_overrides.mesocycle_id,
        week_number: schedule_week_overrides.week_number,
        day_of_week: schedule_week_overrides.day_of_week,
        period: schedule_week_overrides.period,
        template_id: schedule_week_overrides.template_id,
        template_name: workout_templates.name,
        modality: workout_templates.modality,
        time_slot: schedule_week_overrides.time_slot,
      })
      .from(schedule_week_overrides)
      .leftJoin(workout_templates, eq(schedule_week_overrides.template_id, workout_templates.id))
      .where(inArray(schedule_week_overrides.mesocycle_id, mesoIds))
      .all() as OverrideRow[]

    for (const row of overrideRows) {
      const key = `${row.mesocycle_id}-${row.week_number}-${row.day_of_week}-${row.period}`
      overrideLookup.set(key, row)
    }
  }

  // Fetch logged workout dates in this month
  const loggedRows = database
    .select({ log_date: logged_workouts.log_date })
    .from(logged_workouts)
    .where(
      and(gte(logged_workouts.log_date, firstDate), lte(logged_workouts.log_date, lastDate))
    )
    .all()

  const loggedDates = new Set(loggedRows.map((r) => r.log_date))

  // Build projection — flatMap to support multiple entries per date
  const days: CalendarDay[] = dates.flatMap((date): CalendarDay[] => {
    // Find which mesocycle contains this date
    const meso = mesoRows.find((m) => date >= m.start_date && date <= m.end_date)

    if (!meso) {
      return [{
        date,
        template_name: null,
        modality: null,
        mesocycle_id: null,
        is_deload: false,
        status: 'rest' as const,
        period: null,
        time_slot: null,
      }]
    }

    // Compute week number (1-based) from mesocycle start
    const daysFromStart = daysBetween(meso.start_date, date)
    const weekNumber = Math.floor(daysFromStart / 7) + 1

    // Determine if this is a deload week
    const hasDeload = meso.has_deload === true || meso.has_deload === 1
    const isDeload = hasDeload && weekNumber > meso.work_weeks
    const weekType = isDeload ? 'deload' : 'normal'

    // Look up base schedule entries for this day (may be multiple)
    const dow = isoDayOfWeek(date)
    const schedMap = scheduleLookup.get(meso.id)
    const baseEntries = schedMap?.get(`${dow}-${weekType}`) ?? []

    // Merge base schedule with per-week overrides
    const periods = ['morning', 'afternoon', 'evening'] as const
    type ResolvedEntry = { template_name: string | null; modality: string | null; period: string; time_slot: string | null }
    const resolved: ResolvedEntry[] = []
    const seenPeriods = new Set<string>()

    // Process base entries, applying overrides where they exist
    for (const entry of baseEntries) {
      seenPeriods.add(entry.period)
      const overrideKey = `${meso.id}-${weekNumber}-${dow}-${entry.period}`
      const override = overrideLookup.get(overrideKey)

      if (override) {
        resolved.push({
          template_name: override.template_name ?? null,
          modality: override.modality ?? null,
          period: override.period,
          time_slot: override.time_slot,
        })
      } else {
        resolved.push({
          template_name: entry.template_name ?? null,
          modality: entry.modality ?? null,
          period: entry.period,
          time_slot: entry.time_slot,
        })
      }
    }

    // Add override-only entries (periods with no base schedule)
    for (const period of periods) {
      if (seenPeriods.has(period)) continue
      const overrideKey = `${meso.id}-${weekNumber}-${dow}-${period}`
      const override = overrideLookup.get(overrideKey)
      if (override) {
        resolved.push({
          template_name: override.template_name ?? null,
          modality: override.modality ?? null,
          period: override.period,
          time_slot: override.time_slot,
        })
      }
    }

    if (resolved.length === 0) {
      return [{
        date,
        template_name: null,
        modality: null,
        mesocycle_id: meso.id,
        is_deload: isDeload,
        status: 'rest' as const,
        period: null,
        time_slot: null,
      }]
    }

    // Sort by period order: morning → afternoon → evening
    const sorted = resolved.sort(
      (a, b) => (PERIOD_ORDER[a.period] ?? 99) - (PERIOD_ORDER[b.period] ?? 99)
    )

    return sorted.map((entry) => {
      const templateName = entry.template_name ?? null
      const modality = (entry.modality as CalendarDay['modality']) ?? null

      let status: CalendarDay['status']
      if (templateName === null) {
        status = 'rest'
      } else if (loggedDates.has(date)) {
        status = 'completed'
      } else {
        status = 'projected'
      }

      return {
        date,
        template_name: templateName,
        modality,
        mesocycle_id: meso.id,
        is_deload: isDeload,
        status,
        period: entry.period as CalendarDay['period'],
        time_slot: entry.time_slot,
      }
    })
  })

  return { days }
}
