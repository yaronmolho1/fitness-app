import { eq, and, asc, inArray, lte, gte, isNull } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  workout_templates,
  template_sections,
  exercise_slots,
  exercises,
  logged_workouts,
  routine_items,
  routine_logs,
  logged_exercises,
  logged_sets,
  slot_week_overrides,
  template_week_overrides,
} from '@/lib/db/schema'
import { filterActiveRoutineItems } from '@/lib/routines/scope-filter'
import { getWeeklyCompletionCounts, getStreaks } from '@/lib/routines/queries'
import { mergeSlotWithOverride } from '@/lib/progression/week-overrides'
import { getEffectiveScheduleForDay } from '@/lib/schedule/override-queries'

// Response types

export type SlotData = {
  id: number
  exercise_id: number
  exercise_name: string
  sets: number
  reps: string
  weight: number | null
  rpe: number | null
  rest_seconds: number | null
  group_id: number | null
  group_rest_seconds: number | null
  guidelines: string | null
  order: number
  is_main: boolean
}

export type MesocycleInfo = {
  id: number
  name: string
  start_date: string
  end_date: string
  week_type: 'normal' | 'deload'
  status: 'planned' | 'active' | 'completed'
}

export type TemplateInfo = {
  id: number
  name: string
  modality: string
  notes: string | null
  // Running-specific
  run_type: string | null
  target_pace: string | null
  hr_zone: number | null
  interval_count: number | null
  interval_rest: number | null
  coaching_cues: string | null
  // Distance/duration/elevation
  target_distance: number | null
  target_duration: number | null
  target_elevation_gain: number | null
  // MMA-specific
  planned_duration: number | null
}

export type SectionData = {
  id: number
  section_name: string
  modality: string
  order: number
  // Running-specific
  run_type: string | null
  target_pace: string | null
  hr_zone: number | null
  interval_count: number | null
  interval_rest: number | null
  coaching_cues: string | null
  // Distance/duration/elevation
  target_distance: number | null
  target_duration: number | null
  target_elevation_gain: number | null
  // MMA-specific
  planned_duration: number | null
  // Resistance sections carry their exercise slots
  slots?: SlotData[]
}

export type Period = 'morning' | 'afternoon' | 'evening'

type WorkoutResult = {
  type: 'workout'
  date: string
  mesocycle: MesocycleInfo
  template: TemplateInfo
  slots: SlotData[]
  sections?: SectionData[]
  period: Period
  time_slot: string
  duration: number
}

export type RoutineItemInfo = {
  id: number
  name: string
  category: string | null
  has_weight: boolean
  has_length: boolean
  has_duration: boolean
  has_sets: boolean
  has_reps: boolean
  frequency_target: number
  weeklyCount: number
  streak: number
}

export type RoutineLogInfo = {
  id: number
  routine_item_id: number
  log_date: string
  status: 'done' | 'skipped'
  value_weight: number | null
  value_length: number | null
  value_duration: number | null
  value_sets: number | null
  value_reps: number | null
}

export type RestDayRoutines = {
  items: RoutineItemInfo[]
  logs: RoutineLogInfo[]
}

type RestDayResult = {
  type: 'rest_day'
  date: string
  mesocycle: MesocycleInfo
  routines: RestDayRoutines
}

type NoActiveMesoResult = {
  type: 'no_active_mesocycle'
  date: string
}

export type LoggedSetData = {
  set_number: number
  actual_reps: number | null
  actual_weight: number | null
}

export type LoggedExerciseData = {
  id: number
  exercise_name: string
  order: number
  actual_rpe: number | null
  sets: LoggedSetData[]
}

export type LoggedWorkoutSummary = {
  id: number
  log_date: string
  logged_at: Date
  canonical_name: string | null
  rating: number | null
  notes: string | null
  template_snapshot: { version: number; [key: string]: unknown }
  exercises: LoggedExerciseData[]
}

type AlreadyLoggedResult = {
  type: 'already_logged'
  date: string
  mesocycle: MesocycleInfo
  loggedWorkout: LoggedWorkoutSummary
  period: Period
  time_slot: string
  duration: number
}

export type TodayResult = WorkoutResult | RestDayResult | NoActiveMesoResult | AlreadyLoggedResult

// Determine if the given date falls in the deload week of a mesocycle
export function isDeloadWeek(
  startDate: string,
  workWeeks: number,
  hasDeload: boolean,
  today: string
): boolean {
  if (!hasDeload) return false

  const start = new Date(startDate + 'T00:00:00Z')
  const current = new Date(today + 'T00:00:00Z')
  const diffMs = current.getTime() - start.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  // Deload week starts at day (workWeeks * 7)
  const deloadStartDay = workWeeks * 7
  return diffDays >= deloadStartDay
}

// Get day_of_week using ISO convention (0=Monday, 6=Sunday) — matches schedule grid + calendar
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z')
  return (d.getUTCDay() + 6) % 7
}

// Compute 1-based week number from mesocycle start
function getWeekNumber(startDate: string, today: string): number {
  const start = new Date(startDate + 'T00:00:00Z')
  const current = new Date(today + 'T00:00:00Z')
  const diffDays = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

// Fetch overrides for a set of slot IDs at a given week, return map by slot ID
async function fetchOverrideMap(
  slotIds: number[],
  weekNumber: number
): Promise<Map<number, typeof slot_week_overrides.$inferSelect>> {
  if (slotIds.length === 0) return new Map()
  try {
    const overrides = await db
      .select()
      .from(slot_week_overrides)
      .where(
        and(
          inArray(slot_week_overrides.exercise_slot_id, slotIds),
          eq(slot_week_overrides.week_number, weekNumber)
        )
      )
      .all()
    const map = new Map<number, typeof slot_week_overrides.$inferSelect>()
    for (const o of overrides) {
      map.set(o.exercise_slot_id, o)
    }
    return map
  } catch {
    // Table may not exist yet (pre-migration); gracefully return empty
    return new Map()
  }
}

// Apply overrides to an array of slots
function applySlotsOverrides<T extends { id: number }>(
  slots: T[],
  overrideMap: Map<number, typeof slot_week_overrides.$inferSelect>
): T[] {
  return slots.map((slot) => mergeSlotWithOverride(slot, overrideMap.get(slot.id) ?? null))
}

// Fetch a template-level week override for running/MMA fields
async function fetchTemplateWeekOverride(
  templateId: number,
  sectionId: number | null,
  weekNumber: number
): Promise<typeof template_week_overrides.$inferSelect | null> {
  try {
    const condition = and(
      eq(template_week_overrides.template_id, templateId),
      sectionId === null
        ? isNull(template_week_overrides.section_id)
        : eq(template_week_overrides.section_id, sectionId),
      eq(template_week_overrides.week_number, weekNumber)
    )
    return await db.select().from(template_week_overrides).where(condition).get() ?? null
  } catch {
    return null
  }
}

// Fetch active routines + logs for a given date
async function getRestDayRoutines(today: string): Promise<RestDayRoutines> {
  const [allItems, allMesos, logs] = await Promise.all([
    db.select().from(routine_items).all(),
    db.select().from(mesocycles).all(),
    db.select().from(routine_logs).where(eq(routine_logs.log_date, today)).all(),
  ])

  const activeItems = filterActiveRoutineItems(allItems, allMesos, today)

  const itemIds = activeItems.map((item) => item.id)

  // Fetch weekly completion counts and streaks for all active items
  const [weeklyCountMap, streakMap] = await Promise.all([
    getWeeklyCompletionCounts(itemIds, today),
    getStreaks(itemIds, today),
  ])

  return {
    items: activeItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      has_weight: item.has_weight,
      has_length: item.has_length,
      has_duration: item.has_duration,
      has_sets: item.has_sets,
      has_reps: item.has_reps,
      frequency_target: item.frequency_target,
      weeklyCount: weeklyCountMap.get(item.id) ?? 0,
      streak: streakMap.get(item.id) ?? 0,
    })),
    logs: logs.map((log) => ({
      id: log.id,
      routine_item_id: log.routine_item_id,
      log_date: log.log_date,
      status: log.status as 'done' | 'skipped',
      value_weight: log.value_weight,
      value_length: log.value_length,
      value_duration: log.value_duration,
      value_sets: log.value_sets,
      value_reps: log.value_reps,
    })),
  }
}

// Build already_logged result for a specific template
async function buildAlreadyLoggedResult(
  existingLog: {
    id: number
    log_date: string
    logged_at: Date
    canonical_name: string | null
    rating: number | null
    notes: string | null
    template_snapshot: { version: number; [key: string]: unknown }
  },
  today: string,
  mesoInfo: MesocycleInfo,
  period: Period,
  timeSlot: string,
  duration: number
): Promise<AlreadyLoggedResult> {
  const loggedExerciseRows = await db
    .select({
      id: logged_exercises.id,
      exercise_name: logged_exercises.exercise_name,
      order: logged_exercises.order,
      actual_rpe: logged_exercises.actual_rpe,
    })
    .from(logged_exercises)
    .where(eq(logged_exercises.logged_workout_id, existingLog.id))
    .orderBy(asc(logged_exercises.order))
    .all()

  const exercisesWithSets: LoggedExerciseData[] = []
  for (const ex of loggedExerciseRows) {
    const sets = await db
      .select({
        set_number: logged_sets.set_number,
        actual_reps: logged_sets.actual_reps,
        actual_weight: logged_sets.actual_weight,
      })
      .from(logged_sets)
      .where(eq(logged_sets.logged_exercise_id, ex.id))
      .orderBy(asc(logged_sets.set_number))
      .all()

    exercisesWithSets.push({ ...ex, sets })
  }

  return {
    type: 'already_logged',
    date: today,
    mesocycle: mesoInfo,
    loggedWorkout: {
      ...existingLog,
      exercises: exercisesWithSets,
    },
    period,
    time_slot: timeSlot,
    duration,
  }
}

// Main lookup chain — returns array of sessions for the day
export async function getTodayWorkout(today: string): Promise<TodayResult[]> {
  // Step 1: find mesocycle covering this date (prefer active for overlaps)
  let activeMeso = await db
    .select()
    .from(mesocycles)
    .where(and(
      eq(mesocycles.status, 'active'),
      lte(mesocycles.start_date, today),
      gte(mesocycles.end_date, today)
    ))
    .get()

  // Fallback: completed mesocycle covering this date (retroactive logging)
  if (!activeMeso) {
    activeMeso = await db
      .select()
      .from(mesocycles)
      .where(and(
        eq(mesocycles.status, 'completed'),
        lte(mesocycles.start_date, today),
        gte(mesocycles.end_date, today)
      ))
      .get()
  }

  if (!activeMeso) {
    return [{ type: 'no_active_mesocycle', date: today }]
  }

  // Step 2: determine day_of_week
  const dayOfWeek = getDayOfWeek(today)

  // Step 3: determine variant (normal vs deload)
  const deload = isDeloadWeek(
    activeMeso.start_date,
    activeMeso.work_weeks,
    activeMeso.has_deload,
    today
  )
  const weekType = deload ? 'deload' : 'normal'

  const mesoInfo: MesocycleInfo = {
    id: activeMeso.id,
    name: activeMeso.name,
    start_date: activeMeso.start_date,
    end_date: activeMeso.end_date,
    week_type: weekType,
    status: activeMeso.status as 'planned' | 'active' | 'completed',
  }

  // Step 4: compute week number and resolve effective schedule (base + overrides)
  const weekNumber = getWeekNumber(activeMeso.start_date, today)

  const effectiveEntries = await getEffectiveScheduleForDay(
    db, activeMeso.id, weekNumber, dayOfWeek, weekType
  )

  // Filter to entries with valid template_id
  const validRows = effectiveEntries.filter((e) => e.template_id !== null)

  // Step 5: no schedule = rest day
  if (validRows.length === 0) {
    const routines = await getRestDayRoutines(today)
    return [{ type: 'rest_day', date: today, mesocycle: mesoInfo, routines }]
  }

  // Step 6: build result for each scheduled session
  const results: TodayResult[] = []

  for (const row of validRows) {
    const period = row.period as Period
    const timeSlot = row.time_slot

    // Load template
    const template = await db
      .select()
      .from(workout_templates)
      .where(eq(workout_templates.id, row.template_id!))
      .get()

    if (!template) continue

    // Check if already logged for this specific template
    const existingLog = await db
      .select({
        id: logged_workouts.id,
        log_date: logged_workouts.log_date,
        logged_at: logged_workouts.logged_at,
        canonical_name: logged_workouts.canonical_name,
        rating: logged_workouts.rating,
        notes: logged_workouts.notes,
        template_snapshot: logged_workouts.template_snapshot,
      })
      .from(logged_workouts)
      .where(
        and(
          eq(logged_workouts.log_date, today),
          eq(logged_workouts.template_id, template.id)
        )
      )
      .get()

    if (existingLog) {
      results.push(
        await buildAlreadyLoggedResult(existingLog, today, mesoInfo, period, timeSlot, row.duration)
      )
      continue
    }

    // Load exercise slots
    const slots = await db
      .select({
        id: exercise_slots.id,
        exercise_id: exercise_slots.exercise_id,
        exercise_name: exercises.name,
        sets: exercise_slots.sets,
        reps: exercise_slots.reps,
        weight: exercise_slots.weight,
        rpe: exercise_slots.rpe,
        rest_seconds: exercise_slots.rest_seconds,
        group_id: exercise_slots.group_id,
        group_rest_seconds: exercise_slots.group_rest_seconds,
        guidelines: exercise_slots.guidelines,
        order: exercise_slots.order,
        is_main: exercise_slots.is_main,
      })
      .from(exercise_slots)
      .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
      .where(eq(exercise_slots.template_id, template.id))
      .orderBy(asc(exercise_slots.order))
      .all()

    // Merge week overrides into slots
    const slotIds = slots.map((s) => s.id)
    const overrideMap = await fetchOverrideMap(slotIds, weekNumber)
    const mergedSlots = applySlotsOverrides(slots, overrideMap)

    // Load sections for mixed templates
    let sections: SectionData[] | undefined
    if (template.modality === 'mixed') {
      const sectionRows = await db
        .select({
          id: template_sections.id,
          section_name: template_sections.section_name,
          modality: template_sections.modality,
          order: template_sections.order,
          run_type: template_sections.run_type,
          target_pace: template_sections.target_pace,
          hr_zone: template_sections.hr_zone,
          interval_count: template_sections.interval_count,
          interval_rest: template_sections.interval_rest,
          coaching_cues: template_sections.coaching_cues,
          target_distance: template_sections.target_distance,
          target_duration: template_sections.target_duration,
          target_elevation_gain: template_sections.target_elevation_gain,
          planned_duration: template_sections.planned_duration,
        })
        .from(template_sections)
        .where(eq(template_sections.template_id, template.id))
        .orderBy(asc(template_sections.order))
        .all()

      sections = []
      for (const sec of sectionRows) {
        const sectionSlots = sec.modality === 'resistance'
          ? await db
              .select({
                id: exercise_slots.id,
                exercise_id: exercise_slots.exercise_id,
                exercise_name: exercises.name,
                sets: exercise_slots.sets,
                reps: exercise_slots.reps,
                weight: exercise_slots.weight,
                rpe: exercise_slots.rpe,
                rest_seconds: exercise_slots.rest_seconds,
                group_id: exercise_slots.group_id,
                group_rest_seconds: exercise_slots.group_rest_seconds,
                guidelines: exercise_slots.guidelines,
                order: exercise_slots.order,
                is_main: exercise_slots.is_main,
              })
              .from(exercise_slots)
              .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
              .where(
                and(
                  eq(exercise_slots.template_id, template.id),
                  eq(exercise_slots.section_id, sec.id)
                )
              )
              .orderBy(asc(exercise_slots.order))
              .all()
          : undefined

        // Merge week overrides into section slots
        let mergedSectionSlots = sectionSlots as SlotData[] | undefined
        if (sectionSlots) {
          const secSlotIds = sectionSlots.map((s) => s.id)
          const secOverrideMap = await fetchOverrideMap(secSlotIds, weekNumber)
          mergedSectionSlots = applySlotsOverrides(sectionSlots, secOverrideMap) as SlotData[]
        }

        // Apply section-level week overrides for running/MMA sections
        const secOverride = (sec.modality === 'running' || sec.modality === 'mma')
          ? await fetchTemplateWeekOverride(template.id, sec.id, weekNumber)
          : null

        sections.push({
          ...sec,
          ...(secOverride && {
            target_pace: secOverride.pace ?? sec.target_pace,
            interval_count: secOverride.interval_count ?? sec.interval_count,
            interval_rest: secOverride.interval_rest ?? sec.interval_rest,
            target_distance: secOverride.distance ?? sec.target_distance,
            target_duration: secOverride.duration ?? sec.target_duration,
            target_elevation_gain: secOverride.elevation_gain ?? sec.target_elevation_gain,
            planned_duration: secOverride.planned_duration ?? sec.planned_duration,
          }),
          slots: mergedSectionSlots,
        })
      }
    }

    // Apply template-level week overrides (running/MMA progression fields)
    const tplOverride = await fetchTemplateWeekOverride(template.id, null, weekNumber)

    const workoutResult: WorkoutResult = {
      type: 'workout',
      date: today,
      mesocycle: mesoInfo,
      template: {
        id: template.id,
        name: template.name,
        modality: template.modality,
        notes: template.notes,
        run_type: template.run_type,
        target_pace: tplOverride?.pace ?? template.target_pace,
        hr_zone: template.hr_zone,
        interval_count: tplOverride?.interval_count ?? template.interval_count,
        interval_rest: tplOverride?.interval_rest ?? template.interval_rest,
        coaching_cues: template.coaching_cues,
        target_distance: tplOverride?.distance ?? template.target_distance,
        target_duration: tplOverride?.duration ?? template.target_duration,
        target_elevation_gain: tplOverride?.elevation_gain ?? template.target_elevation_gain,
        planned_duration: tplOverride?.planned_duration ?? template.planned_duration,
      },
      slots: mergedSlots as SlotData[],
      period,
      time_slot: timeSlot,
      duration: row.duration,
    }
    if (sections) {
      workoutResult.sections = sections
    }
    results.push(workoutResult)
  }

  // If all templates were invalid, fall back to rest day
  if (results.length === 0) {
    const routines = await getRestDayRoutines(today)
    return [{ type: 'rest_day', date: today, mesocycle: mesoInfo, routines }]
  }

  // Sort by time_slot ascending (chronological)
  results.sort((a, b) => {
    const aSlot = 'time_slot' in a ? (a.time_slot ?? '') : ''
    const bSlot = 'time_slot' in b ? (b.time_slot ?? '') : ''
    return aSlot.localeCompare(bSlot)
  })

  return results
}
