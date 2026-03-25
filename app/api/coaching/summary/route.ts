import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken } from '@/lib/auth/jwt'
import { db } from '@/lib/db'
import { getAthleteProfile, getCurrentPlan, getRecentSessions } from '@/lib/coaching/queries'
import { getProgressionData } from '@/lib/progression/queries'
import { getCalendarProjection } from '@/lib/calendar/queries'
import {
  generateCoachingSummary,
  type SubjectiveState,
  type ProgressionTrend,
} from '@/lib/coaching/summary'

const bodySchema = z.object({
  fatigue: z.number().int().min(1).max(5),
  soreness: z.number().int().min(1).max(5),
  sleep: z.number().int().min(1).max(5),
  injuries: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
  // Auth check
  const token = request.cookies.get('auth-token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await request.json()
    const parsed = bodySchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { fatigue, soreness, sleep, injuries, notes } = parsed.data

    const subjectiveState: SubjectiveState = {
      fatigue,
      soreness,
      sleepQuality: sleep,
      currentInjuries: injuries ?? null,
      additionalNotes: notes ?? null,
    }

    // Gather all data sources in parallel
    const [profile, currentPlan, recentSessions] = await Promise.all([
      getAthleteProfile(),
      getCurrentPlan(db),
      getRecentSessions(db),
    ])

    // Collect progression trends per exercise in the current plan
    const progressionTrends: ProgressionTrend[] = []
    if (currentPlan) {
      const seen = new Set<number>()
      for (const template of currentPlan.templates) {
        for (const slot of template.exercise_slots) {
          if (seen.has(slot.exercise_id)) continue
          seen.add(slot.exercise_id)

          const result = await getProgressionData(db, {
            canonicalName: template.canonical_name,
            exerciseId: slot.exercise_id,
          })
          if (result.data.length > 0) {
            progressionTrends.push({
              canonicalName: template.canonical_name,
              exerciseName: slot.exercise_name,
              dataPoints: result.data.map((d) => ({
                date: d.date,
                actualWeight: d.actualWeight,
                actualVolume: d.actualVolume,
              })),
            })
          }
        }
      }
    }

    // Get upcoming 14 days of calendar projection
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`

    const [currentProjection, nextProjection] = await Promise.all([
      getCalendarProjection(db, currentMonth),
      getCalendarProjection(db, nextMonth),
    ])

    const todayStr = now.toISOString().split('T')[0]
    const futureLimit = new Date(now)
    futureLimit.setDate(futureLimit.getDate() + 14)
    const futureLimitStr = futureLimit.toISOString().split('T')[0]

    const upcomingDays = [...currentProjection.days, ...nextProjection.days]
      .filter((d) => d.date > todayStr && d.date <= futureLimitStr)

    const markdown = generateCoachingSummary({
      profile,
      currentPlan,
      recentSessions,
      progressionTrends,
      subjectiveState,
      upcomingDays,
    })

    return NextResponse.json({ markdown })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
