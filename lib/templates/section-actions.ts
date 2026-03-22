'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql, asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import {
  workout_templates,
  mesocycles,
  template_sections,
  exercise_slots,
} from '@/lib/db/schema'
import { generateCanonicalName } from './utils'

type TemplateRow = typeof workout_templates.$inferSelect
type SectionRow = typeof template_sections.$inferSelect

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'race'] as const
const SECTION_MODALITIES = ['resistance', 'running', 'mma'] as const

// Checks if the template's mesocycle is completed
function checkCompletedMesocycle(templateId: number): string | null {
  const template = db
    .select({ mesocycle_id: workout_templates.mesocycle_id })
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!template) return null

  const meso = db
    .select({ status: mesocycles.status })
    .from(mesocycles)
    .where(eq(mesocycles.id, template.mesocycle_id))
    .get()

  if (meso?.status === 'completed') {
    return 'Cannot modify template on a completed mesocycle'
  }

  return null
}

// ============================================================================
// createMixedTemplate
// ============================================================================

const sectionInputSchema = z.object({
  section_name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Section name is required')),
  modality: z.enum(SECTION_MODALITIES),
  order: z.number().int().positive(),
  // Running fields
  run_type: z.enum(RUN_TYPES).optional(),
  target_pace: z.string().optional().transform((v) => v || null),
  hr_zone: z.number().int().min(1).max(5).nullable().optional().transform((v) => v ?? null),
  interval_count: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
  interval_rest: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
  coaching_cues: z.string().optional().transform((v) => v || null),
  target_distance: z.number().positive('Distance must be positive').nullable().optional().transform((v) => v ?? null),
  target_duration: z.number().int().positive('Duration must be positive').nullable().optional().transform((v) => v ?? null),
  // MMA fields
  planned_duration: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
})

const createMixedTemplateSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Name is required')),
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  sections: z.array(sectionInputSchema).min(2, 'Mixed templates require at least 2 sections'),
})

type SectionInput = {
  section_name: string
  modality: 'resistance' | 'running' | 'mma'
  order: number
  run_type?: 'easy' | 'tempo' | 'interval' | 'long' | 'race'
  target_pace?: string
  hr_zone?: number | null
  interval_count?: number | null
  interval_rest?: number | null
  coaching_cues?: string
  target_distance?: number | null
  target_duration?: number | null
  planned_duration?: number | null
}

export type CreateMixedTemplateInput = {
  name: string
  mesocycle_id: number
  sections: SectionInput[]
}

type CreateMixedTemplateResult =
  | { success: true; data: { template: TemplateRow; sections: SectionRow[] } }
  | { success: false; error: string }

export async function createMixedTemplate(
  input: CreateMixedTemplateInput
): Promise<CreateMixedTemplateResult> {
  const parsed = createMixedTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { name, mesocycle_id, sections } = parsed.data

  // Validate at least 2 different modalities
  const uniqueModalities = new Set(sections.map((s) => s.modality))
  if (uniqueModalities.size < 2) {
    return {
      success: false,
      error: 'Mixed templates must contain at least 2 different modalities',
    }
  }

  const canonicalName = generateCanonicalName(name)
  if (!canonicalName) {
    return {
      success: false,
      error: 'Name produces an empty canonical_name after slug conversion',
    }
  }

  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return {
      success: false,
      error: 'Cannot create template on a completed mesocycle',
    }
  }

  // Check canonical_name uniqueness
  const existing = db
    .select()
    .from(workout_templates)
    .where(
      sql`${workout_templates.mesocycle_id} = ${mesocycle_id} AND ${workout_templates.canonical_name} = ${canonicalName}`
    )
    .get()

  if (existing) {
    return {
      success: false,
      error: `A template with duplicate canonical name "${canonicalName}" already exists in this mesocycle`,
    }
  }

  // Create template + sections atomically
  const result = db.transaction((tx) => {
    const template = tx
      .insert(workout_templates)
      .values({
        mesocycle_id,
        name,
        canonical_name: canonicalName,
        modality: 'mixed',
        created_at: new Date(),
      })
      .returning()
      .get()

    const createdSections: SectionRow[] = []
    for (const section of sections) {
      const created = tx
        .insert(template_sections)
        .values({
          template_id: template.id,
          modality: section.modality,
          section_name: section.section_name,
          order: section.order,
          run_type: section.run_type ?? null,
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
        .returning()
        .get()
      createdSections.push(created)
    }

    return { template, sections: createdSections }
  })

  revalidatePath('/mesocycles')
  return { success: true, data: result }
}

// ============================================================================
// addSection
// ============================================================================

const addSectionSchema = z.object({
  template_id: z.number().int().positive(),
  section_name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Section name is required')),
  modality: z.enum(SECTION_MODALITIES),
  run_type: z.enum(RUN_TYPES).optional(),
  target_pace: z.string().optional().transform((v) => v || null),
  hr_zone: z.number().int().min(1).max(5).nullable().optional().transform((v) => v ?? null),
  interval_count: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
  interval_rest: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
  coaching_cues: z.string().optional().transform((v) => v || null),
  target_distance: z.number().positive('Distance must be positive').nullable().optional().transform((v) => v ?? null),
  target_duration: z.number().int().positive('Duration must be positive').nullable().optional().transform((v) => v ?? null),
  planned_duration: z.number().int().positive().nullable().optional().transform((v) => v ?? null),
})

export type AddSectionInput = {
  template_id: number
  section_name: string
  modality: 'resistance' | 'running' | 'mma'
  run_type?: 'easy' | 'tempo' | 'interval' | 'long' | 'race'
  target_pace?: string
  hr_zone?: number | null
  interval_count?: number | null
  interval_rest?: number | null
  coaching_cues?: string
  target_distance?: number | null
  target_duration?: number | null
  planned_duration?: number | null
}

type SectionResult =
  | { success: true; data: SectionRow }
  | { success: false; error: string }

export async function addSection(
  input: AddSectionInput
): Promise<SectionResult> {
  const parsed = addSectionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const {
    template_id,
    section_name,
    modality,
    run_type,
    target_pace,
    hr_zone,
    interval_count,
    interval_rest,
    coaching_cues,
    target_distance,
    target_duration,
    planned_duration,
  } = parsed.data

  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, template_id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  if (template.modality !== 'mixed') {
    return { success: false, error: 'Can only add sections to mixed templates' }
  }

  const completedError = checkCompletedMesocycle(template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Auto-assign order
  const maxOrder = db
    .select({
      maxOrder: sql<number>`coalesce(max(${template_sections.order}), 0)`,
    })
    .from(template_sections)
    .where(eq(template_sections.template_id, template_id))
    .get()

  const nextOrder = (maxOrder?.maxOrder ?? 0) + 1

  const created = db
    .insert(template_sections)
    .values({
      template_id,
      modality,
      section_name,
      order: nextOrder,
      run_type: run_type ?? null,
      target_pace,
      hr_zone,
      interval_count,
      interval_rest,
      coaching_cues,
      target_distance,
      target_duration,
      planned_duration,
      created_at: new Date(),
    })
    .returning()
    .get()

  revalidatePath('/mesocycles')
  return { success: true, data: created }
}

// ============================================================================
// removeSection
// ============================================================================

type RemoveResult =
  | { success: true }
  | { success: false; error: string }

export async function removeSection(sectionId: number): Promise<RemoveResult> {
  if (!Number.isInteger(sectionId) || sectionId < 1) {
    return { success: false, error: 'Invalid section ID' }
  }

  const section = db
    .select()
    .from(template_sections)
    .where(eq(template_sections.id, sectionId))
    .get()

  if (!section) {
    return { success: false, error: 'Section not found' }
  }

  const completedError = checkCompletedMesocycle(section.template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  // Get all sections for this template (excluding the one to remove)
  const allSections = db
    .select()
    .from(template_sections)
    .where(eq(template_sections.template_id, section.template_id))
    .all()

  const remaining = allSections.filter((s) => s.id !== sectionId)

  if (remaining.length < 2) {
    return {
      success: false,
      error: 'Mixed templates require at least 2 sections. Cannot remove.',
    }
  }

  // Check remaining have 2+ different modalities
  const remainingModalities = new Set(remaining.map((s) => s.modality))
  if (remainingModalities.size < 2) {
    return {
      success: false,
      error:
        'Removal would leave sections with only one modality. Mixed templates require different modalities.',
    }
  }

  // Delete associated exercise_slots first (section_id FK has no ON DELETE action)
  db.transaction((tx) => {
    tx.delete(exercise_slots)
      .where(eq(exercise_slots.section_id, sectionId))
      .run()
    tx.delete(template_sections)
      .where(eq(template_sections.id, sectionId))
      .run()
  })

  revalidatePath('/mesocycles')
  return { success: true }
}

// ============================================================================
// reorderSections
// ============================================================================

const reorderSchema = z.object({
  template_id: z.number().int().positive(),
  section_ids: z.array(z.number().int().positive()).min(1),
})

type ReorderSectionsInput = {
  template_id: number
  section_ids: number[]
}

type ReorderResult =
  | { success: true; noop?: boolean }
  | { success: false; error: string }

export async function reorderSections(
  input: ReorderSectionsInput
): Promise<ReorderResult> {
  const parsed = reorderSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { template_id, section_ids } = parsed.data

  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, template_id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  if (template.modality !== 'mixed') {
    return { success: false, error: 'Can only reorder sections on mixed templates' }
  }

  const completedError = checkCompletedMesocycle(template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  const currentSections = db
    .select({ id: template_sections.id, order: template_sections.order })
    .from(template_sections)
    .where(eq(template_sections.template_id, template_id))
    .orderBy(asc(template_sections.order))
    .all()

  // Verify IDs match exactly
  const currentIds = new Set(currentSections.map((s) => s.id))
  const inputIds = new Set(section_ids)

  if (
    currentIds.size !== inputIds.size ||
    ![...currentIds].every((id) => inputIds.has(id))
  ) {
    return {
      success: false,
      error: 'Section IDs mismatch: must include all template sections',
    }
  }

  // Check if order unchanged
  const currentOrder = currentSections.map((s) => s.id)
  const isUnchanged = section_ids.every((id, i) => id === currentOrder[i])
  if (isUnchanged) {
    return { success: true, noop: true }
  }

  db.transaction((tx) => {
    for (let i = 0; i < section_ids.length; i++) {
      tx.update(template_sections)
        .set({ order: i + 1 })
        .where(eq(template_sections.id, section_ids[i]))
        .run()
    }
  })

  revalidatePath('/mesocycles')
  return { success: true }
}

// ============================================================================
// updateSection
// ============================================================================

const updateSectionSchema = z.object({
  section_name: z.string().min(1).optional(),
  run_type: z.enum(RUN_TYPES).nullable().optional(),
  target_pace: z.string().nullable().optional(),
  hr_zone: z.number().int().min(1).max(5).nullable().optional(),
  target_distance: z.number().positive().nullable().optional(),
  target_duration: z.number().int().positive().nullable().optional(),
  interval_count: z.number().int().positive().nullable().optional(),
  interval_rest: z.number().int().positive().nullable().optional(),
  coaching_cues: z.string().nullable().optional(),
  planned_duration: z.number().int().positive().nullable().optional(),
})

export async function updateSection(
  sectionId: number,
  input: z.infer<typeof updateSectionSchema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateSectionSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const section = db
    .select()
    .from(template_sections)
    .where(eq(template_sections.id, sectionId))
    .get()

  if (!section) {
    return { success: false, error: 'Section not found' }
  }

  const completedError = checkCompletedMesocycle(section.template_id)
  if (completedError) {
    return { success: false, error: completedError }
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return { success: true }
  }

  db.update(template_sections)
    .set(updates)
    .where(eq(template_sections.id, sectionId))
    .run()

  revalidatePath('/mesocycles')
  return { success: true }
}
