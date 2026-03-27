import { and, eq, gte, lte, asc, inArray } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  mesocycles,
  workout_templates,
  exercise_slots,
  exercises,
  logged_workouts,
  logged_exercises,
  logged_sets,
  slot_week_overrides,
} from '@/lib/db/schema'
import { mergeSlotWithOverride } from '@/lib/progression/week-overrides'
import { getEffectiveScheduleForDay } from '@/lib/schedule/override-queries'

// Slot target data from live template
export type SlotDetail = {
  id?: number
  exercise_name: string
  sets: number
  reps: string
  weight: number | null
  rpe: number | null
  rest_seconds: number | null
  guidelines: string | null
  order: number
  is_main: boolean
}

export type TemplateDetail = {
  id: number
  name: string
  modality: string
  notes: string | null
  run_type: string | null
  target_pace: string | null
  hr_zone: number | null
  interval_count: number | null
  interval_rest: number | null
  coaching_cues: string | null
  target_elevation_gain: number | null
  planned_duration: number | null
}

export type LoggedSetDetail = {
  set_number: number
  actual_reps: number | null
  actual_weight: number | null
}

export type LoggedExerciseDetail = {
  exercise_name: string
  order: number
  actual_rpe: number | null
  sets: LoggedSetDetail[]
}

export type TemplateSnapshot = {
  version: number
  name?: string
  modality?: string
  notes?: string | null
  slots?: Array<{
    exercise_name: string
    sets: number
    reps: string
    weight: number | null
    rpe: number | null
    rest_seconds: number | null
    guidelines: string | null
    order: number
    is_main: boolean
  }>
  [key: string]: unknown
}

type MesocycleStatus = 'planned' | 'active' | 'completed'

type RestResult = {
  type: 'rest'
  date: string
  mesocycle_id?: number
  mesocycle_status?: MesocycleStatus
}

export type Period = 'morning' | 'afternoon' | 'evening'

type ProjectedResult = {
  type: 'projected'
  date: string
  mesocycle_id: number
  mesocycle_status: MesocycleStatus
  period: Period
  template: TemplateDetail
  slots: SlotDetail[]
  is_deload: boolean
  is_override: boolean
  override_group: string | null
  week_number: number
  day_of_week: number
}

type CompletedResult = {
  type: 'completed'
  date: string
  mesocycle_id: number
  mesocycle_status: MesocycleStatus
  period: Period
  snapshot: TemplateSnapshot
  exercises: LoggedExerciseDetail[]
  rating: number | null
  notes: string | null
  is_deload: boolean
}

export type DayDetailResult = RestResult | ProjectedResult | CompletedResult

// 0=Mon..6=Sun from YYYY-MM-DD
function isoDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

function daysBetween(startDate: string, date: string): number {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(date + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

// Period sort order for deterministic output
const PERIOD_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 }

export async function getDayDetail(
  database: AppDb,
  date: string
): Promise<DayDetailResult[]> {
  // Find mesocycle covering this date
  const meso = database
    .select({
      id: mesocycles.id,
      start_date: mesocycles.start_date,
      end_date: mesocycles.end_date,
      work_weeks: mesocycles.work_weeks,
      has_deload: mesocycles.has_deload,
      status: mesocycles.status,
    })
    .from(mesocycles)
    .where(and(lte(mesocycles.start_date, date), gte(mesocycles.end_date, date)))
    .get()

  if (!meso) {
    return [{ type: 'rest', date }]
  }

  // Determine week type (normal vs deload)
  const daysFromStart = daysBetween(meso.start_date, date)
  const weekNumber = Math.floor(daysFromStart / 7) + 1
  const hasDeload = meso.has_deload === true || (meso.has_deload as unknown) === 1
  const isDeload = hasDeload && weekNumber > meso.work_weeks
  const weekType = isDeload ? 'deload' : 'normal'

  const dow = isoDayOfWeek(date)

  // Resolve effective schedule (base + overrides) for this day
  const effectiveEntries = await getEffectiveScheduleForDay(
    database, meso.id, weekNumber, dow, weekType
  )
  const schedEntries = effectiveEntries.filter(e => e.template_id != null)

  const mesoStatus = meso.status as MesocycleStatus

  if (schedEntries.length === 0) {
    return [{ type: 'rest', date, mesocycle_id: meso.id, mesocycle_status: mesoStatus }]
  }

  // Get all logged workouts for this date
  const loggedWorkouts = database
    .select({
      id: logged_workouts.id,
      template_id: logged_workouts.template_id,
      rating: logged_workouts.rating,
      notes: logged_workouts.notes,
      template_snapshot: logged_workouts.template_snapshot,
    })
    .from(logged_workouts)
    .where(eq(logged_workouts.log_date, date))
    .all()

  // Index logged workouts by template_id for matching
  const loggedByTemplateId = new Map<number, typeof loggedWorkouts[number]>()
  for (const lw of loggedWorkouts) {
    if (lw.template_id != null) {
      loggedByTemplateId.set(lw.template_id, lw)
    }
  }

  const results: DayDetailResult[] = []

  for (const entry of schedEntries) {
    const period = (entry.period ?? 'morning') as Period
    const templateId = entry.template_id!

    // Check if this schedule entry has a logged workout
    const loggedWorkout = loggedByTemplateId.get(templateId)

    if (loggedWorkout) {
      const completedResult = buildCompletedResult(
        database, loggedWorkout, date, meso.id, mesoStatus, period, isDeload
      )
      if (completedResult) {
        results.push(completedResult)
        continue
      }
    }

    // Projected — load live template
    const template = database
      .select({
        id: workout_templates.id,
        name: workout_templates.name,
        modality: workout_templates.modality,
        notes: workout_templates.notes,
        run_type: workout_templates.run_type,
        target_pace: workout_templates.target_pace,
        hr_zone: workout_templates.hr_zone,
        interval_count: workout_templates.interval_count,
        interval_rest: workout_templates.interval_rest,
        coaching_cues: workout_templates.coaching_cues,
        target_elevation_gain: workout_templates.target_elevation_gain,
        planned_duration: workout_templates.planned_duration,
      })
      .from(workout_templates)
      .where(eq(workout_templates.id, templateId))
      .get()

    if (!template) continue

    // Load exercise slots
    const rawSlots = database
      .select({
        id: exercise_slots.id,
        exercise_name: exercises.name,
        sets: exercise_slots.sets,
        reps: exercise_slots.reps,
        weight: exercise_slots.weight,
        rpe: exercise_slots.rpe,
        rest_seconds: exercise_slots.rest_seconds,
        guidelines: exercise_slots.guidelines,
        order: exercise_slots.order,
        is_main: exercise_slots.is_main,
      })
      .from(exercise_slots)
      .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
      .where(eq(exercise_slots.template_id, template.id))
      .orderBy(asc(exercise_slots.order))
      .all()
      .map((row) => ({ ...row, is_main: Boolean(row.is_main) })) as SlotDetail[]

    // Merge week overrides into projected slots
    const slotIds = rawSlots.map((s) => s.id).filter((id): id is number => id != null)
    let overrides: (typeof slot_week_overrides.$inferSelect)[] = []
    if (slotIds.length > 0) {
      try {
        overrides = database
          .select()
          .from(slot_week_overrides)
          .where(
            and(
              inArray(slot_week_overrides.exercise_slot_id, slotIds),
              eq(slot_week_overrides.week_number, weekNumber)
            )
          )
          .all()
      } catch {
        // Table may not exist yet (pre-migration); gracefully skip
      }
    }
    const overrideMap = new Map(overrides.map((o) => [o.exercise_slot_id, o]))
    const slots = rawSlots.map((slot) =>
      mergeSlotWithOverride(slot, slot.id != null ? (overrideMap.get(slot.id) ?? null) : null)
    )

    results.push({
      type: 'projected',
      date,
      mesocycle_id: meso.id,
      mesocycle_status: mesoStatus,
      period,
      template,
      slots,
      is_deload: isDeload,
      is_override: entry.is_override,
      override_group: entry.override_group,
      week_number: weekNumber,
      day_of_week: dow,
    })
  }

  // Sort by period order
  results.sort((a, b) => {
    const pa = 'period' in a ? PERIOD_ORDER[a.period] ?? 0 : 0
    const pb = 'period' in b ? PERIOD_ORDER[b.period] ?? 0 : 0
    return pa - pb
  })

  return results.length > 0 ? results : [{ type: 'rest', date, mesocycle_id: meso.id, mesocycle_status: mesoStatus }]
}

function buildCompletedResult(
  database: AppDb,
  loggedWorkout: { id: number; rating: number | null; notes: string | null; template_snapshot: unknown },
  date: string,
  mesoId: number,
  mesoStatus: MesocycleStatus,
  period: Period,
  isDeload: boolean,
): CompletedResult | null {
  const loggedExerciseRows = database
    .select({
      id: logged_exercises.id,
      exercise_name: logged_exercises.exercise_name,
      order: logged_exercises.order,
      actual_rpe: logged_exercises.actual_rpe,
    })
    .from(logged_exercises)
    .where(eq(logged_exercises.logged_workout_id, loggedWorkout.id))
    .orderBy(asc(logged_exercises.order))
    .all()

  const exercisesWithSets: LoggedExerciseDetail[] = []
  for (const ex of loggedExerciseRows) {
    const sets = database
      .select({
        set_number: logged_sets.set_number,
        actual_reps: logged_sets.actual_reps,
        actual_weight: logged_sets.actual_weight,
      })
      .from(logged_sets)
      .where(eq(logged_sets.logged_exercise_id, ex.id))
      .orderBy(asc(logged_sets.set_number))
      .all()

    exercisesWithSets.push({
      exercise_name: ex.exercise_name,
      order: ex.order,
      actual_rpe: ex.actual_rpe,
      sets,
    })
  }

  const snapshot = loggedWorkout.template_snapshot as unknown
  if (
    typeof snapshot !== 'object' ||
    snapshot === null ||
    !('version' in snapshot) ||
    typeof (snapshot as Record<string, unknown>).version !== 'number'
  ) {
    return null
  }

  return {
    type: 'completed',
    date,
    mesocycle_id: mesoId,
    mesocycle_status: mesoStatus,
    period,
    snapshot: snapshot as TemplateSnapshot,
    exercises: exercisesWithSets,
    rating: loggedWorkout.rating,
    notes: loggedWorkout.notes,
    is_deload: isDeload,
  }
}
