import { eq, inArray, asc } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import {
  mesocycles,
  workout_templates,
  template_sections,
} from '@/lib/db/schema'

export type TransferTargetSection = {
  id: number
  section_name: string
  order: number
}

export type TransferTargetTemplate = {
  id: number
  name: string
  modality: string
  sections: TransferTargetSection[]
}

export type TransferTarget = {
  id: number
  name: string
  status: string
  templates: TransferTargetTemplate[]
}

/**
 * Load active/planned mesocycles with their resistance-compatible templates.
 * Mixed templates include only resistance sections.
 * Mesocycles with no compatible templates are excluded.
 */
export function getTransferTargets(): TransferTarget[] {
  // Fetch active/planned mesocycles
  const mesos = db
    .select()
    .from(mesocycles)
    .where(inArray(mesocycles.status, ['active', 'planned']))
    .all()

  if (mesos.length === 0) return []

  const results: TransferTarget[] = []

  for (const meso of mesos) {
    // Get resistance + mixed templates for this meso
    const templates = db
      .select()
      .from(workout_templates)
      .where(eq(workout_templates.mesocycle_id, meso.id))
      .all()
      .filter(t => t.modality === 'resistance' || t.modality === 'mixed')

    if (templates.length === 0) continue

    const mappedTemplates: TransferTargetTemplate[] = templates.map(t => {
      // For mixed templates, include only resistance sections
      let sections: TransferTargetSection[] = []
      if (t.modality === 'mixed') {
        const allSections = db
          .select({
            id: template_sections.id,
            section_name: template_sections.section_name,
            order: template_sections.order,
            modality: template_sections.modality,
          })
          .from(template_sections)
          .where(eq(template_sections.template_id, t.id))
          .orderBy(asc(template_sections.order))
          .all()

        sections = allSections
          .filter(s => s.modality === 'resistance')
          .map(({ id, section_name, order }) => ({ id, section_name, order }))
      }

      return {
        id: t.id,
        name: t.name,
        modality: t.modality,
        sections,
      }
    })

    results.push({
      id: meso.id,
      name: meso.name,
      status: meso.status,
      templates: mappedTemplates,
    })
  }

  return results
}
