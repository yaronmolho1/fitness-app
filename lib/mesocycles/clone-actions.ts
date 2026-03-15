'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  workout_templates,
  exercise_slots,
  weekly_schedule,
} from '@/lib/db/schema'
import { calculateEndDate } from './utils'

type CloneInput = {
  source_id: number
  name: string
  start_date: string
  work_weeks?: number
  has_deload?: boolean
}

type CloneResult =
  | { success: true; id: number }
  | { success: false; error: string }

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function cloneMesocycle(input: CloneInput): Promise<CloneResult> {
  const name = input.name.trim()
  if (!name) {
    return { success: false, error: 'Name is required' }
  }

  if (!input.start_date || !DATE_REGEX.test(input.start_date)) {
    return { success: false, error: 'Valid start date (YYYY-MM-DD) is required' }
  }

  const source = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, input.source_id))
    .get()

  if (!source) {
    return { success: false, error: 'Source mesocycle not found' }
  }

  const sourceTemplates = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, source.id))
    .all()

  if (sourceTemplates.length === 0) {
    return { success: false, error: 'Cannot clone a mesocycle with no templates' }
  }

  const workWeeks = input.work_weeks ?? source.work_weeks
  const hasDeload = input.has_deload ?? source.has_deload
  const endDate = calculateEndDate(input.start_date, workWeeks, hasDeload)

  let result: { success: true; id: number }
  try {
    result = db.transaction((tx) => {
    // Create new mesocycle
    const newMeso = tx
      .insert(mesocycles)
      .values({
        name,
        start_date: input.start_date,
        end_date: endDate,
        work_weeks: workWeeks,
        has_deload: hasDeload,
        status: 'planned',
      })
      .returning({ id: mesocycles.id })
      .get()

    // Map source template IDs to new template IDs
    const templateIdMap = new Map<number, number>()

    for (const tmpl of sourceTemplates) {
      const newTmpl = tx
        .insert(workout_templates)
        .values({
          mesocycle_id: newMeso.id,
          name: tmpl.name,
          canonical_name: tmpl.canonical_name,
          modality: tmpl.modality,
          notes: tmpl.notes,
          run_type: tmpl.run_type,
          target_pace: tmpl.target_pace,
          hr_zone: tmpl.hr_zone,
          interval_count: tmpl.interval_count,
          interval_rest: tmpl.interval_rest,
          coaching_cues: tmpl.coaching_cues,
          planned_duration: tmpl.planned_duration,
        })
        .returning({ id: workout_templates.id })
        .get()

      templateIdMap.set(tmpl.id, newTmpl.id)

      // Clone exercise slots for this template
      const slots = tx
        .select()
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, tmpl.id))
        .all()

      for (const slot of slots) {
        tx.insert(exercise_slots)
          .values({
            template_id: newTmpl.id,
            exercise_id: slot.exercise_id,
            sets: slot.sets,
            reps: slot.reps,
            weight: slot.weight,
            rpe: slot.rpe,
            rest_seconds: slot.rest_seconds,
            guidelines: slot.guidelines,
            order: slot.order,
            is_main: slot.is_main,
          })
          .run()
      }
    }

    // Clone weekly schedule rows
    const sourceSchedule = tx
      .select()
      .from(weekly_schedule)
      .where(eq(weekly_schedule.mesocycle_id, source.id))
      .all()

    for (const row of sourceSchedule) {
      // Skip deload rows if new mesocycle doesn't have deload
      if (row.week_type === 'deload' && !hasDeload) continue

      const newTemplateId = row.template_id
        ? templateIdMap.get(row.template_id) ?? null
        : null

      tx.insert(weekly_schedule)
        .values({
          mesocycle_id: newMeso.id,
          day_of_week: row.day_of_week,
          template_id: newTemplateId,
          week_type: row.week_type,
        })
        .run()
    }

    return { success: true as const, id: newMeso.id }
    })
  } catch {
    return { success: false, error: 'Failed to clone mesocycle' }
  }

  revalidatePath('/mesocycles')
  return result
}
