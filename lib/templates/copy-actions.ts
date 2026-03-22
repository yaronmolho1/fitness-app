'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import {
  workout_templates,
  mesocycles,
  exercise_slots,
  template_sections,
} from '@/lib/db/schema'

type TemplateRow = typeof workout_templates.$inferSelect

type CopyTemplateResult =
  | { success: true; data: TemplateRow }
  | { success: false; error: string }

export async function copyTemplateToMesocycle(
  sourceTemplateId: number,
  targetMesocycleId: number
): Promise<CopyTemplateResult> {
  // Validate source template exists
  const source = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, sourceTemplateId))
    .get()

  if (!source) {
    return { success: false, error: 'Source template not found' }
  }

  // Validate target mesocycle exists
  const targetMeso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, targetMesocycleId))
    .get()

  if (!targetMeso) {
    return { success: false, error: 'Target mesocycle not found' }
  }

  if (targetMeso.status === 'completed') {
    return { success: false, error: 'Cannot copy template to a completed mesocycle' }
  }

  // Check canonical_name uniqueness in target meso
  const duplicate = db
    .select()
    .from(workout_templates)
    .where(
      and(
        eq(workout_templates.mesocycle_id, targetMesocycleId),
        eq(workout_templates.canonical_name, source.canonical_name)
      )
    )
    .get()

  if (duplicate) {
    return {
      success: false,
      error: `A template with canonical name "${source.canonical_name}" already exists in the target mesocycle`,
    }
  }

  try {
    const newTemplate = db.transaction((tx) => {
      // Copy template row
      const created = tx
        .insert(workout_templates)
        .values({
          mesocycle_id: targetMesocycleId,
          name: source.name,
          canonical_name: source.canonical_name,
          modality: source.modality,
          notes: source.notes,
          run_type: source.run_type,
          target_pace: source.target_pace,
          hr_zone: source.hr_zone,
          interval_count: source.interval_count,
          interval_rest: source.interval_rest,
          coaching_cues: source.coaching_cues,
          target_distance: source.target_distance,
          target_duration: source.target_duration,
          planned_duration: source.planned_duration,
          created_at: new Date(),
        })
        .returning()
        .get()

      // Copy template_sections and build section ID map
      const sectionIdMap = new Map<number, number>()
      const sections = tx
        .select()
        .from(template_sections)
        .where(eq(template_sections.template_id, source.id))
        .all()

      for (const section of sections) {
        const newSection = tx
          .insert(template_sections)
          .values({
            template_id: created.id,
            modality: section.modality,
            section_name: section.section_name,
            order: section.order,
            run_type: section.run_type,
            target_pace: section.target_pace,
            hr_zone: section.hr_zone,
            interval_count: section.interval_count,
            interval_rest: section.interval_rest,
            coaching_cues: section.coaching_cues,
            target_distance: section.target_distance,
            target_duration: section.target_duration,
            planned_duration: section.planned_duration,
            created_at: new Date(),
          })
          .returning({ id: template_sections.id })
          .get()

        sectionIdMap.set(section.id, newSection.id)
      }

      // Copy exercise slots with remapped section_ids and group_ids
      const slots = tx
        .select()
        .from(exercise_slots)
        .where(eq(exercise_slots.template_id, source.id))
        .all()

      // Build group_id remapping: source group_id -> new group_id
      const groupIdMap = new Map<number, number>()
      let nextGroupId = 1

      for (const slot of slots) {
        if (slot.group_id !== null && !groupIdMap.has(slot.group_id)) {
          groupIdMap.set(slot.group_id, nextGroupId++)
        }
      }

      for (const slot of slots) {
        const newSectionId = slot.section_id
          ? sectionIdMap.get(slot.section_id) ?? null
          : null

        const newGroupId = slot.group_id !== null
          ? groupIdMap.get(slot.group_id) ?? null
          : null

        tx.insert(exercise_slots)
          .values({
            template_id: created.id,
            exercise_id: slot.exercise_id,
            section_id: newSectionId,
            sets: slot.sets,
            reps: slot.reps,
            weight: slot.weight,
            rpe: slot.rpe,
            rest_seconds: slot.rest_seconds,
            group_id: newGroupId,
            group_rest_seconds: slot.group_rest_seconds,
            guidelines: slot.guidelines,
            order: slot.order,
            is_main: slot.is_main,
            created_at: new Date(),
          })
          .run()
      }

      return created
    })

    revalidatePath('/mesocycles')
    return { success: true, data: newTemplate }
  } catch {
    return { success: false, error: 'Failed to copy template' }
  }
}
