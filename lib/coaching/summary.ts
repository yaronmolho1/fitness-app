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

export type SummaryInput = {
  profile: {
    age: number | null
    weight_kg: number | null
    height_cm: number | null
    gender: string | null
    training_age_years: number | null
    primary_goal: string | null
    injury_history: string | null
  } | null
  currentPlan: CurrentPlan | null
  recentSessions: RecentSession[]
  progressionTrends: ProgressionTrend[]
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

  const trendsSection = buildProgressionTrendsSection(input.progressionTrends)
  if (trendsSection) sections.push(trendsSection)

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
      for (const slot of tpl.exercise_slots) {
        const parts = [`${slot.sets}×${slot.reps}`]
        if (slot.weight !== null) parts.push(`${slot.weight}kg`)
        if (slot.rpe !== null) parts.push(`RPE ${slot.rpe}`)
        lines.push(`  - ${slot.exercise_name}: ${parts.join(', ')}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function buildRecentSessionsSection(sessions: RecentSession[]): string {
  const lines: string[] = ['## Recent Sessions', '']

  if (sessions.length === 0) {
    lines.push('No recent sessions')
    return lines.join('\n')
  }

  for (const session of sessions) {
    const snapshot = session.templateSnapshot as { name?: string }
    const templateName = snapshot?.name ?? session.canonicalName ?? 'Unknown'
    lines.push(`### ${formatDateDisplay(session.logDate)} — ${templateName}`)

    if (session.rating !== null) {
      lines.push(`Rating: ${session.rating}/5`)
    }
    if (session.notes) {
      lines.push(`Notes: ${session.notes}`)
    }
    lines.push('')

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
    lines.push('')
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
