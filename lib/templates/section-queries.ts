import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { template_sections } from '@/lib/db/schema'

export type TemplateSectionRow = {
  id: number
  section_name: string
  modality: 'resistance' | 'running' | 'mma'
  order: number
  run_type: string | null
  target_pace: string | null
  hr_zone: number | null
  target_distance: number | null
  target_duration: number | null
  planned_duration: number | null
}

export function getSectionsForTemplate(templateId: number): TemplateSectionRow[] {
  return db
    .select({
      id: template_sections.id,
      section_name: template_sections.section_name,
      modality: template_sections.modality,
      order: template_sections.order,
      run_type: template_sections.run_type,
      target_pace: template_sections.target_pace,
      hr_zone: template_sections.hr_zone,
      target_distance: template_sections.target_distance,
      target_duration: template_sections.target_duration,
      planned_duration: template_sections.planned_duration,
    })
    .from(template_sections)
    .where(eq(template_sections.template_id, templateId))
    .orderBy(asc(template_sections.order))
    .all()
}
