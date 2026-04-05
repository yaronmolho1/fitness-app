import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { workout_templates, exercise_slots, template_sections } from '@/lib/db/schema'
import {
  estimateTemplateDuration,
  type SlotForEstimate,
  type SectionForEstimate,
} from './estimate-duration'

export function recomputeEstimatedDuration(templateId: number): void {
  const template = db
    .select({
      modality: workout_templates.modality,
      target_duration: workout_templates.target_duration,
      planned_duration: workout_templates.planned_duration,
    })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!template) return

  const slots = db
    .select({
      id: exercise_slots.id,
      sets: exercise_slots.sets,
      rest_seconds: exercise_slots.rest_seconds,
      group_id: exercise_slots.group_id,
      group_rest_seconds: exercise_slots.group_rest_seconds,
      section_id: exercise_slots.section_id,
    })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, templateId))
    .all()

  let estimated: number | null = null

  if (template.modality === 'mixed') {
    const sections = db
      .select({
        id: template_sections.id,
        modality: template_sections.modality,
        target_duration: template_sections.target_duration,
        planned_duration: template_sections.planned_duration,
      })
      .from(template_sections)
      .where(eq(template_sections.template_id, templateId))
      .all()

    const sectionIds = sections.map(s => s.id)
    const sectionsForEstimate: SectionForEstimate[] = sections.map(s => ({
      modality: s.modality,
      target_duration: s.target_duration,
      planned_duration: s.planned_duration,
    }))

    const slotsBySection = new Map<number, SlotForEstimate[]>()
    for (const slot of slots) {
      if (slot.section_id != null) {
        const list = slotsBySection.get(slot.section_id) ?? []
        list.push(slot)
        slotsBySection.set(slot.section_id, list)
      }
    }

    estimated = estimateTemplateDuration(
      template, slots, sectionsForEstimate, sectionIds, slotsBySection
    )
  } else {
    estimated = estimateTemplateDuration(template, slots)
  }

  db.update(workout_templates)
    .set({ estimated_duration: estimated })
    .where(eq(workout_templates.id, templateId))
    .run()
}
