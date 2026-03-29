import { eq, asc } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import {
  logged_workouts,
  logged_exercises,
  logged_sets,
  workout_templates,
  template_sections,
  exercise_slots,
  exercises,
} from '@/lib/db/schema'
import { hasExistingLog } from './duplicate-check'

// Per-section input types

export type MixedSetInput = {
  reps: number | null
  weight: number | null
}

export type MixedExerciseInput = {
  slotId: number
  exerciseId: number
  exerciseName: string
  order: number
  rpe: number | null
  sets: MixedSetInput[]
}

export type ResistanceSectionInput = {
  sectionId: number
  modality: 'resistance'
  exercises: MixedExerciseInput[]
}

export type RunningSectionInput = {
  sectionId: number
  modality: 'running'
  actualDistance?: number | null
  actualAvgPace?: string | null
  actualAvgHr?: number | null
}

export type MmaSectionInput = {
  sectionId: number
  modality: 'mma'
  actualDurationMinutes?: number | null
  feeling?: number | null
}

export type MixedSectionInput = ResistanceSectionInput | RunningSectionInput | MmaSectionInput

export type SaveMixedWorkoutInput = {
  templateId: number
  logDate: string
  sections: MixedSectionInput[]
  rating: number | null
  notes: string | null
}

export type SaveMixedWorkoutResult =
  | { success: true; data: { workoutId: number } }
  | { success: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateInput(input: SaveMixedWorkoutInput): string | null {
  if (!DATE_RE.test(input.logDate)) {
    return 'Invalid date format (expected YYYY-MM-DD)'
  }

  if (!input.sections || input.sections.length === 0) {
    return 'At least one section is required'
  }

  if (input.rating !== null && (input.rating < 1 || input.rating > 5)) {
    return 'Rating must be between 1 and 5'
  }

  for (const section of input.sections) {
    if (section.modality === 'resistance') {
      for (const ex of section.exercises) {
        if (ex.rpe !== null && (ex.rpe < 1 || ex.rpe > 10)) {
          return 'RPE must be between 1 and 10'
        }
        for (const set of ex.sets) {
          if (set.weight !== null && set.weight < 0) {
            return 'Weight must be non-negative'
          }
        }
      }
    }
  }

  return null
}

export async function saveMixedWorkoutCore(
  database: AppDb,
  input: SaveMixedWorkoutInput
): Promise<SaveMixedWorkoutResult> {
  const validationError = validateInput(input)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const normalizedNotes = input.notes?.trim() || null

  // Load template
  const template = await database
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, input.templateId))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  if (template.modality !== 'mixed') {
    return { success: false, error: 'Template is not a mixed workout' }
  }

  // Duplicate check
  const duplicate = await hasExistingLog(database, input.logDate, input.templateId)
  if (duplicate) {
    return { success: false, error: 'This workout is already logged for this date' }
  }

  // Load template sections for snapshot
  const sectionRows = await database
    .select()
    .from(template_sections)
    .where(eq(template_sections.template_id, template.id))
    .orderBy(asc(template_sections.order))
    .all()

  // Load exercise slots for resistance sections
  const slotRows = await database
    .select({
      id: exercise_slots.id,
      section_id: exercise_slots.section_id,
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

  // Build slot lookup by section_id
  const slotsBySectionId = new Map<number, typeof slotRows>()
  for (const slot of slotRows) {
    if (slot.section_id !== null) {
      const existing = slotsBySectionId.get(slot.section_id) ?? []
      existing.push(slot)
      slotsBySectionId.set(slot.section_id, existing)
    }
  }

  // Build input section lookup by sectionId
  const inputSectionMap = new Map<number, MixedSectionInput>()
  for (const sec of input.sections) {
    inputSectionMap.set(sec.sectionId, sec)
  }

  // Build v2 template snapshot with sections array
  const snapshotSections = sectionRows.map((sec) => {
    const inputSec = inputSectionMap.get(sec.id)
    const base = {
      section_name: sec.section_name,
      modality: sec.modality,
      order: sec.order,
    }

    if (sec.modality === 'resistance') {
      const sectionSlots = slotsBySectionId.get(sec.id) ?? []
      return {
        ...base,
        slots: sectionSlots.map((slot) => ({
          exercise_name: slot.exercise_name,
          target_sets: slot.sets,
          target_reps: slot.reps,
          target_weight: slot.weight,
          target_rpe: slot.rpe,
          rest_seconds: slot.rest_seconds,
          group_id: slot.group_id ?? null,
          group_rest_seconds: slot.group_rest_seconds ?? null,
          guidelines: slot.guidelines,
          sort_order: slot.order,
          is_main: slot.is_main,
        })),
      }
    }

    if (sec.modality === 'running') {
      const runningSec = inputSec as RunningSectionInput | undefined
      return {
        ...base,
        run_type: sec.run_type,
        target_pace: sec.target_pace,
        hr_zone: sec.hr_zone,
        interval_count: sec.interval_count,
        interval_rest: sec.interval_rest,
        coaching_cues: sec.coaching_cues,
        target_distance: sec.target_distance,
        target_duration: sec.target_duration,
        actual_distance: runningSec?.actualDistance ?? null,
        actual_avg_pace: runningSec?.actualAvgPace ?? null,
        actual_avg_hr: runningSec?.actualAvgHr ?? null,
      }
    }

    if (sec.modality === 'mma') {
      const mmaSec = inputSec as MmaSectionInput | undefined
      return {
        ...base,
        planned_duration: sec.planned_duration,
        actual_duration_minutes: mmaSec?.actualDurationMinutes ?? null,
        feeling: mmaSec?.feeling ?? null,
      }
    }

    return base
  })

  const templateSnapshot = {
    version: 2 as const,
    name: template.name,
    modality: template.modality,
    notes: template.notes,
    sections: snapshotSections,
  }

  try {
    const result = database.transaction((tx) => {
      const workout = tx
        .insert(logged_workouts)
        .values({
          template_id: input.templateId,
          canonical_name: template.canonical_name,
          log_date: input.logDate,
          logged_at: new Date(),
          rating: input.rating,
          notes: normalizedNotes,
          template_snapshot: templateSnapshot,
          created_at: new Date(),
        })
        .returning()
        .get()

      // Insert logged_exercises and logged_sets for resistance sections
      for (const section of input.sections) {
        if (section.modality !== 'resistance') continue

        for (const ex of section.exercises) {
          const loggedEx = tx
            .insert(logged_exercises)
            .values({
              logged_workout_id: workout.id,
              exercise_id: ex.exerciseId,
              exercise_name: ex.exerciseName,
              order: ex.order,
              actual_rpe: ex.rpe,
              created_at: new Date(),
            })
            .returning()
            .get()

          for (let i = 0; i < ex.sets.length; i++) {
            const set = ex.sets[i]
            tx.insert(logged_sets)
              .values({
                logged_exercise_id: loggedEx.id,
                set_number: i + 1,
                actual_reps: set.reps,
                actual_weight: set.weight,
                created_at: new Date(),
              })
              .run()
          }
        }
      }

      return { workoutId: workout.id }
    })

    return { success: true, data: result }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `Failed to save mixed workout: ${message}` }
  }
}
