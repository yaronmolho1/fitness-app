import { formatDateDisplay } from '@/lib/date-format'
import type { CurrentPlan, RecentSession } from './queries'
import type { CalendarDay } from '@/lib/calendar/queries'

export type SubjectiveState = {
  fatigue: number | null
  soreness: number | null
  sleepQuality: number | null
  currentInjuries: string | null
  additionalNotes: string | null
}

export type ProgressionTrendPoint = {
  date: string
  actualWeight: number | null
  actualVolume: number | null
}

export type ProgressionTrend = {
  canonicalName: string
  exerciseName: string
  dataPoints: ProgressionTrendPoint[]
}

export type RunningTrendPoint = {
  date: string
  distance: number | null
  avgPace: string | null
  avgHr: number | null
  elevationGain: number | null
}

export type RunningProgressionTrend = {
  canonicalName: string
  templateName: string
  runType: string | null
  dataPoints: RunningTrendPoint[]
}

export type SummaryInput = {
  profile: {
    age: number | null
    weight_kg: number | null
    height_cm: number | null
    gender: string | null
    training_age_years: number | null
    primary_goal: string | null
    injury_history: string | null
    athletic_background: string | null
  } | null
  currentPlan: CurrentPlan | null
  recentSessions: RecentSession[]
  progressionTrends: ProgressionTrend[]
  runningProgressionTrends: RunningProgressionTrend[]
  subjectiveState: SubjectiveState
  upcomingDays: CalendarDay[]
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function generateCoachingSummary(input: SummaryInput): string {
  const sections: string[] = []

  const profileSection = buildProfileSection(input.profile)
  if (profileSection) sections.push(profileSection)

  sections.push(buildCurrentPlanSection(input.currentPlan))

  sections.push(buildRecentSessionsSection(input.recentSessions))

  const weeklySection = buildWeeklySummarySection(input.recentSessions)
  if (weeklySection) sections.push(weeklySection)

  const trendsSection = buildProgressionTrendsSection(input.progressionTrends)
  if (trendsSection) sections.push(trendsSection)

  const runningTrendsSection = buildRunningProgressionTrendsSection(input.runningProgressionTrends)
  if (runningTrendsSection) sections.push(runningTrendsSection)

  const subjectiveSection = buildSubjectiveStateSection(input.subjectiveState)
  if (subjectiveSection) sections.push(subjectiveSection)

  const upcomingSection = buildUpcomingPlanSection(input.upcomingDays, input.currentPlan)
  if (upcomingSection) sections.push(upcomingSection)

  return sections.join('\n\n')
}

function buildProfileSection(
  profile: SummaryInput['profile']
): string | null {
  if (!profile) return null

  const lines: string[] = ['## Athlete Profile', '']
  const fields: [string, string | null][] = [
    ['Age', profile.age !== null ? String(profile.age) : null],
    ['Weight', profile.weight_kg !== null ? `${profile.weight_kg} kg` : null],
    ['Height', profile.height_cm !== null ? `${profile.height_cm} cm` : null],
    ['Gender', profile.gender],
    ['Training Age', profile.training_age_years !== null ? `${profile.training_age_years} years` : null],
    ['Athletic Background', profile.athletic_background],
    ['Primary Goal', profile.primary_goal],
    ['Injury History', profile.injury_history],
  ]

  let hasAny = false
  for (const [label, value] of fields) {
    if (value !== null) {
      lines.push(`- **${label}:** ${value}`)
      hasAny = true
    }
  }

  if (!hasAny) return null
  return lines.join('\n')
}

function buildCurrentPlanSection(plan: CurrentPlan | null): string {
  const lines: string[] = ['## Current Plan', '']

  if (!plan) {
    lines.push('No active mesocycle')
    return lines.join('\n')
  }

  const { mesocycle, templates, schedule } = plan
  lines.push(`**${mesocycle.name}** (${formatDateDisplay(mesocycle.start_date)} – ${formatDateDisplay(mesocycle.end_date)})`)
  lines.push(`- ${mesocycle.work_weeks} work weeks${mesocycle.has_deload ? ' + deload' : ''}`)
  lines.push('')

  // Weekly schedule
  if (schedule.length > 0) {
    lines.push('### Weekly Schedule')
    lines.push('')
    for (const entry of schedule) {
      const dayName = DAY_NAMES[entry.day_of_week] ?? `Day ${entry.day_of_week}`
      const templateName = entry.template_name ?? 'Rest'
      lines.push(`- **${dayName}** (${entry.period}): ${templateName}`)
    }
    lines.push('')
  }

  // Templates with exercises
  if (templates.length > 0) {
    lines.push('### Templates')
    lines.push('')
    for (const tpl of templates) {
      lines.push(`**${tpl.name}** (${tpl.modality})`)

      // Exercise slots (resistance, mixed)
      if (tpl.exercise_slots.length > 0) {
        for (const slot of tpl.exercise_slots) {
          const parts = [`${slot.sets}×${slot.reps}`]
          if (slot.weight !== null) parts.push(`${slot.weight}kg`)
          if (slot.rpe !== null) parts.push(`RPE ${slot.rpe}`)
          lines.push(`  - ${slot.exercise_name}: ${parts.join(', ')}`)
        }
      }

      // Running fields (running, mixed)
      if (tpl.modality === 'running' || tpl.modality === 'mixed') {
        if (tpl.run_type) lines.push(`  - Run type: ${tpl.run_type}`)
        if (tpl.target_distance !== null) lines.push(`  - Target distance: ${tpl.target_distance} km`)
        if (tpl.target_pace) lines.push(`  - Target pace: ${tpl.target_pace}`)
        if (tpl.hr_zone !== null) lines.push(`  - HR zone: ${tpl.hr_zone}`)
        if (tpl.target_elevation_gain !== null) lines.push(`  - Target elevation: ${tpl.target_elevation_gain} m`)
        if (tpl.target_duration !== null) lines.push(`  - Target duration: ${tpl.target_duration} min`)
        if (tpl.interval_count !== null) {
          let intervalLine = `  - Intervals: ${tpl.interval_count} reps`
          if (tpl.interval_rest !== null) intervalLine += `, ${tpl.interval_rest}s rest`
          lines.push(intervalLine)
        }
        if (tpl.coaching_cues) lines.push(`  - Cues: ${tpl.coaching_cues}`)
      }

      // MMA/mixed duration
      if (tpl.modality === 'mma' || tpl.modality === 'mixed') {
        if (tpl.planned_duration !== null) lines.push(`  - Planned duration: ${tpl.planned_duration} min`)
      }

      lines.push('')
    }
  }

  return lines.join('\n')
}

type RunningSnapshot = {
  version: number
  name?: string
  modality: 'running'
  run_type?: string | null
  target_pace?: string | null
  target_distance?: number | null
  target_elevation_gain?: number | null
  hr_zone?: number | null
  actual_distance?: number | null
  actual_avg_pace?: string | null
  actual_avg_hr?: number | null
  actual_elevation_gain?: number | null
  interval_data?: Array<{
    rep_number: number
    interval_pace: string | null
    interval_avg_hr: number | null
    interval_notes: string | null
    interval_elevation_gain: number | null
  }> | null
}

function isRunningSnapshot(snapshot: Record<string, unknown>): snapshot is RunningSnapshot {
  return snapshot.modality === 'running'
}

function buildRecentSessionsSection(sessions: RecentSession[]): string {
  const lines: string[] = ['## Recent Sessions', '']

  if (sessions.length === 0) {
    lines.push('No recent sessions')
    return lines.join('\n')
  }

  // Resistance sessions: only last 2 weeks (progression trends cover the rest)
  const now = new Date()
  const resistanceCutoff = new Date(now)
  resistanceCutoff.setDate(resistanceCutoff.getDate() - 14)
  const resistanceCutoffStr = resistanceCutoff.toISOString().split('T')[0]

  for (const session of sessions) {
    const snapshot = session.templateSnapshot as Record<string, unknown>
    const templateName = (snapshot?.name as string) ?? session.canonicalName ?? 'Unknown'
    const isRunning = isRunningSnapshot(snapshot)

    // Skip old resistance/mma/mixed sessions
    if (!isRunning && session.logDate < resistanceCutoffStr) continue

    lines.push(`### ${formatDateDisplay(session.logDate)} — ${templateName}`)

    if (session.rating !== null) {
      lines.push(`Rating: ${session.rating}/5`)
    }
    if (session.notes) {
      lines.push(`Notes: ${session.notes}`)
    }
    lines.push('')

    if (isRunning) {
      if (snapshot.run_type) lines.push(`- **Run type:** ${snapshot.run_type}`)

      // Total run metrics (includes warmup/cooldown)
      if (snapshot.actual_distance != null) {
        let line = `- **Total distance:** ${snapshot.actual_distance} km`
        if (snapshot.target_distance != null) line += ` (target: ${snapshot.target_distance} km)`
        lines.push(line)
      }
      if (snapshot.actual_avg_pace) {
        let line = `- **Overall avg pace:** ${snapshot.actual_avg_pace}`
        if (snapshot.target_pace) line += ` (target: ${snapshot.target_pace})`
        lines.push(line)
      }
      if (snapshot.actual_avg_hr != null) {
        let line = `- **Overall avg HR:** ${snapshot.actual_avg_hr} bpm`
        if (snapshot.hr_zone != null) line += ` (target zone ${snapshot.hr_zone})`
        lines.push(line)
      }
      if (snapshot.actual_elevation_gain != null) {
        let line = `- **Total elevation gain:** ${snapshot.actual_elevation_gain} m`
        if (snapshot.target_elevation_gain != null) line += ` (target: ${snapshot.target_elevation_gain} m)`
        lines.push(line)
      }

      // Interval reps (work portions only, separate from warmup/cooldown)
      if (snapshot.interval_data && snapshot.interval_data.length > 0) {
        lines.push(`- **Interval reps** (${snapshot.interval_data.length}):`)
        for (const rep of snapshot.interval_data) {
          const parts: string[] = [`Rep ${rep.rep_number}`]
          if (rep.interval_pace) parts.push(`pace ${rep.interval_pace}`)
          if (rep.interval_avg_hr != null) parts.push(`HR ${rep.interval_avg_hr}`)
          if (rep.interval_elevation_gain != null) parts.push(`elev ${rep.interval_elevation_gain}m`)
          if (rep.interval_notes) parts.push(`"${rep.interval_notes}"`)
          lines.push(`  - ${parts.join(' | ')}`)
        }
      }
    } else {
      for (const ex of session.exercises) {
        const setDescs = ex.sets.map((s) => {
          const parts: string[] = []
          if (s.actualReps !== null) parts.push(`${s.actualReps} reps`)
          if (s.actualWeight !== null) parts.push(`${s.actualWeight}kg`)
          return parts.join(' × ')
        })
        let exLine = `- **${ex.exerciseName}**: ${setDescs.join(' | ')}`
        if (ex.actualRpe !== null) exLine += ` (RPE ${ex.actualRpe})`
        lines.push(exLine)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildWeeklySummarySection(sessions: RecentSession[]): string | null {
  if (sessions.length === 0) return null

  // Group sessions by ISO week
  const weeks = new Map<string, {
    weekStart: string
    sessions: number
    runningKm: number
    runningElevation: number
    resistanceSets: number
    resistanceVolume: number
  }>()

  for (const session of sessions) {
    const date = new Date(session.logDate + 'T00:00:00')
    const day = date.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(monday.getDate() + mondayOffset)
    const weekKey = monday.toISOString().split('T')[0]

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, { weekStart: weekKey, sessions: 0, runningKm: 0, runningElevation: 0, resistanceSets: 0, resistanceVolume: 0 })
    }
    const week = weeks.get(weekKey)!
    week.sessions++

    const snapshot = session.templateSnapshot as Record<string, unknown>
    if (isRunningSnapshot(snapshot)) {
      if (snapshot.actual_distance != null) week.runningKm += snapshot.actual_distance
      if (snapshot.actual_elevation_gain != null) week.runningElevation += snapshot.actual_elevation_gain
    } else {
      for (const ex of session.exercises) {
        for (const set of ex.sets) {
          week.resistanceSets++
          if (set.actualReps != null && set.actualWeight != null) {
            week.resistanceVolume += set.actualReps * set.actualWeight
          }
        }
      }
    }
  }

  if (weeks.size === 0) return null

  const sorted = [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  const lines: string[] = ['## Weekly Summary', '']
  lines.push('| Week | Sessions | Running km | Elevation m | Sets | Load (kg) |')
  lines.push('|------|----------|-----------|-------------|------|-----------|')

  for (const week of sorted) {
    const weekLabel = formatDateDisplay(week.weekStart)
    const km = week.runningKm > 0 ? week.runningKm.toFixed(1) : '—'
    const elev = week.runningElevation > 0 ? String(week.runningElevation) : '—'
    const sets = week.resistanceSets > 0 ? String(week.resistanceSets) : '—'
    const vol = week.resistanceVolume > 0 ? week.resistanceVolume.toLocaleString() : '—'
    lines.push(`| ${weekLabel} | ${week.sessions} | ${km} | ${elev} | ${sets} | ${vol} |`)
  }

  return lines.join('\n')
}

function buildProgressionTrendsSection(trends: ProgressionTrend[]): string | null {
  if (trends.length === 0) return null

  const lines: string[] = ['## Progression Trends', '']

  for (const trend of trends) {
    lines.push(`### ${trend.exerciseName}`)
    lines.push('')
    lines.push('| Date | Weight | Volume |')
    lines.push('|------|--------|--------|')
    for (const dp of trend.dataPoints) {
      const weight = dp.actualWeight !== null ? `${dp.actualWeight}kg` : '—'
      const volume = dp.actualVolume !== null ? String(dp.actualVolume) : '—'
      lines.push(`| ${formatDateDisplay(dp.date)} | ${weight} | ${volume} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildRunningProgressionTrendsSection(trends: RunningProgressionTrend[]): string | null {
  if (trends.length === 0) return null

  const lines: string[] = ['## Running Progression', '']

  for (const trend of trends) {
    lines.push(`### ${trend.templateName}${trend.runType ? ` (${trend.runType})` : ''}`)
    lines.push('')
    lines.push('| Date | Distance | Pace | Avg HR | Elevation |')
    lines.push('|------|----------|------|--------|-----------|')
    for (const dp of trend.dataPoints) {
      const dist = dp.distance !== null ? `${dp.distance} km` : '—'
      const pace = dp.avgPace ?? '—'
      const hr = dp.avgHr !== null ? String(dp.avgHr) : '—'
      const elev = dp.elevationGain !== null ? `${dp.elevationGain} m` : '—'
      lines.push(`| ${formatDateDisplay(dp.date)} | ${dist} | ${pace} | ${hr} | ${elev} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildSubjectiveStateSection(state: SubjectiveState): string | null {
  const fields: [string, string | null][] = [
    ['Fatigue', state.fatigue !== null ? `${state.fatigue}/5` : null],
    ['Soreness', state.soreness !== null ? `${state.soreness}/5` : null],
    ['Sleep Quality', state.sleepQuality !== null ? `${state.sleepQuality}/5` : null],
    ['Current Injuries', state.currentInjuries],
    ['Additional Notes', state.additionalNotes],
  ]

  const present = fields.filter(([, v]) => v !== null)
  if (present.length === 0) return null

  const lines: string[] = ['## Subjective State', '']
  for (const [label, value] of present) {
    lines.push(`- **${label}:** ${value}`)
  }

  return lines.join('\n')
}

function buildUpcomingPlanSection(
  days: CalendarDay[],
  plan: CurrentPlan | null
): string | null {
  if (days.length === 0 || !plan) return null

  const lines: string[] = ['## Upcoming Plan', '']

  for (const day of days) {
    const dateStr = formatDateDisplay(day.date)
    if (day.template_name) {
      lines.push(`- **${dateStr}**: ${day.template_name} (${day.modality ?? 'unknown'})`)
    } else {
      lines.push(`- **${dateStr}**: Rest`)
    }
  }

  return lines.join('\n')
}
