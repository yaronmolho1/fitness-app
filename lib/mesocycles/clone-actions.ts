'use server'

import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  workout_templates,
  exercise_slots,
  weekly_schedule,
  template_sections,
  slot_week_overrides,
  template_week_overrides,
} from '@/lib/db/schema'
import { calculateEndDate } from './utils'
import { mergeSlotWithOverride } from '@/lib/progression/week-overrides'

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

// Override → template/section field mapping (override names differ from schema column names)
const TEMPLATE_OVERRIDE_FIELD_MAP: Record<string, string> = {
  pace: 'target_pace',
  distance: 'target_distance',
  duration: 'target_duration',
  elevation_gain: 'target_elevation_gain',
  interval_count: 'interval_count',
  interval_rest: 'interval_rest',
  planned_duration: 'planned_duration',
}

// Merge non-null override fields into a values object using the field mapping
function applyTemplateOverride<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown> | null
): T {
  if (!override) return { ...base }
  const merged = { ...base }
  for (const [overrideKey, templateKey] of Object.entries(TEMPLATE_OVERRIDE_FIELD_MAP)) {
    if (overrideKey in override && override[overrideKey] !== null && override[overrideKey] !== undefined) {
      ;(merged as Record<string, unknown>)[templateKey] = override[overrideKey]
    }
  }
  return merged
}

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
        status: 'draft',
        created_at: new Date(),
      })
      .returning({ id: mesocycles.id })
      .get()

    // Map source template IDs to new template IDs
    const templateIdMap = new Map<number, number>()

    for (const tmpl of sourceTemplates) {
      // T223: query template-level override at source's last work week (section_id IS NULL, non-deload)
      const tmplOverride = source.work_weeks > 0
        ? tx
            .select()
            .from(template_week_overrides)
            .where(
              and(
                eq(template_week_overrides.template_id, tmpl.id),
                eq(template_week_overrides.week_number, source.work_weeks),
                eq(template_week_overrides.is_deload, 0)
              )
            )
            .all()
            .find((o) => o.section_id === null) ?? null
        : null

      const tmplBase = {
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
        target_distance: tmpl.target_distance,
        target_duration: tmpl.target_duration,
        target_elevation_gain: tmpl.target_elevation_gain,
        display_order: tmpl.display_order,
      }

      const newTmpl = tx
        .insert(workout_templates)
        .values(applyTemplateOverride(tmplBase, tmplOverride))
        .returning({ id: workout_templates.id })
        .get()

      templateIdMap.set(tmpl.id, newTmpl.id)

      // Clone template_sections and build section ID mapping
      const sectionIdMap = new Map<number, number>()
      const sections = tx
        .select()
        .from(template_sections)
        .where(eq(template_sections.template_id, tmpl.id))
        .all()

      // T223: batch-query per-section overrides at source's last work week
      const sectionOverrides = source.work_weeks > 0
        ? tx
            .select()
            .from(template_week_overrides)
            .where(
              and(
                eq(template_week_overrides.template_id, tmpl.id),
                eq(template_week_overrides.week_number, source.work_weeks),
                eq(template_week_overrides.is_deload, 0)
              )
            )
            .all()
        : []

      for (const section of sections) {
        const sectionOverride = sectionOverrides.find((o) => o.section_id === section.id) ?? null

        const sectionBase = {
          template_id: newTmpl.id,
          modality: section.modality,
          section_name: section.section_name,
          order: section.order,
          run_type: section.run_type,
          target_pace: section.target_pace,
          hr_zone: section.hr_zone,
          interval_count: section.interval_count,
          interval_rest: section.interval_rest,
          coaching_cues: section.coaching_cues,
          planned_duration: section.planned_duration,
          target_distance: section.target_distance,
          target_duration: section.target_duration,
          target_elevation_gain: section.target_elevation_gain,
        }

        const newSection = tx
          .insert(template_sections)
          .values(applyTemplateOverride(sectionBase, sectionOverride))
          .returning({ id: template_sections.id })
          .get()

        sectionIdMap.set(section.id, newSection.id)
      }

      // Clone exercise slots for this template, merging last-week overrides into base
      const slots = tx
        .select()
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, tmpl.id))
        .all()

      for (const slot of slots) {
        const newSectionId = slot.section_id
          ? sectionIdMap.get(slot.section_id) ?? null
          : null

        // T222: query override at source's last work week
        const lastWeekOverride = source.work_weeks > 0
          ? tx
              .select()
              .from(slot_week_overrides)
              .where(
                and(
                  eq(slot_week_overrides.exercise_slot_id, slot.id),
                  eq(slot_week_overrides.week_number, source.work_weeks)
                )
              )
              .get() ?? null
          : null

        const merged = mergeSlotWithOverride(slot, lastWeekOverride)

        tx.insert(exercise_slots)
          .values({
            template_id: newTmpl.id,
            exercise_id: slot.exercise_id,
            section_id: newSectionId,
            sets: merged.sets,
            reps: merged.reps,
            weight: merged.weight,
            rpe: merged.rpe,
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
          period: row.period,
          time_slot: row.time_slot,
          duration: row.duration,
          cycle_length: row.cycle_length,
          cycle_position: row.cycle_position,
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
