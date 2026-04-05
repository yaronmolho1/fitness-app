'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, asc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { workout_templates, mesocycles, exercise_slots, weekly_schedule } from '@/lib/db/schema'
import { generateCanonicalName } from './utils'
import { estimateRunningDuration, estimateMmaDuration } from './estimate-duration'

function getNextDisplayOrder(mesocycleId: number): number {
  const row = db
    .select({ max: sql<number>`coalesce(max(${workout_templates.display_order}), -1)` })
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, mesocycleId))
    .get()
  return (row?.max ?? -1) + 1
}

const createResistanceTemplateSchema = z.object({
  name: z.string().transform((s) => s.trim()).pipe(z.string().min(1, 'Name is required')),
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
})

type CreateResistanceTemplateInput = {
  name: string
  mesocycle_id: number
}

type TemplateRow = typeof workout_templates.$inferSelect

type CreateResistanceTemplateResult =
  | { success: true; data: TemplateRow }
  | { success: false; error: string }

export async function createResistanceTemplate(
  input: CreateResistanceTemplateInput
): Promise<CreateResistanceTemplateResult> {
  const parsed = createResistanceTemplateSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { name, mesocycle_id } = parsed.data

  const canonicalName = generateCanonicalName(name)
  if (!canonicalName) {
    return { success: false, error: 'Name produces an empty canonical_name after slug conversion' }
  }

  // Check mesocycle exists
  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return { success: false, error: 'Cannot create template on a completed mesocycle' }
  }

  // Check canonical_name uniqueness within mesocycle
  const existing = db
    .select()
    .from(workout_templates)
    .where(
      and(
        eq(workout_templates.mesocycle_id, mesocycle_id),
        eq(workout_templates.canonical_name, canonicalName)
      )
    )
    .get()

  if (existing) {
    return {
      success: false,
      error: `A template with duplicate canonical name "${canonicalName}" already exists in this mesocycle`,
    }
  }

  try {
    const created = db
      .insert(workout_templates)
      .values({
        mesocycle_id,
        name,
        canonical_name: canonicalName,
        modality: 'resistance',
        display_order: getNextDisplayOrder(mesocycle_id),
        created_at: new Date(),
      })
      .returning()
      .get()

    revalidatePath('/mesocycles')
    return { success: true, data: created }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: `A template with this name already exists in this mesocycle` }
    }
    return { success: false, error: 'Failed to create template' }
  }
}

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'race'] as const
type RunType = (typeof RUN_TYPES)[number]

const createRunningTemplateSchema = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, 'Name is required')),
    mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
    run_type: z.enum(RUN_TYPES, { message: 'Invalid run type' }),
    target_pace: z
      .string()
      .transform((s) => s.trim())
      .optional()
      .transform((v) => v || null),
    hr_zone: z
      .number()
      .int()
      .min(1, 'HR zone must be 1-5')
      .max(5, 'HR zone must be 1-5')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    interval_count: z
      .number()
      .int()
      .positive('Interval count must be positive')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    interval_rest: z
      .number()
      .int()
      .min(0, 'Interval rest cannot be negative')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    coaching_cues: z
      .string()
      .transform((s) => s.trim())
      .optional()
      .transform((v) => v || null),
    target_distance: z
      .number()
      .positive('Distance must be positive')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    target_duration: z
      .number()
      .int()
      .positive('Duration must be positive')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    target_elevation_gain: z
      .number()
      .int()
      .min(0, 'Elevation gain must be non-negative')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .transform((data) => ({
    ...data,
    interval_count: data.run_type === 'interval' ? data.interval_count : null,
    interval_rest: data.run_type === 'interval' ? data.interval_rest : null,
  }))

export type CreateRunningTemplateInput = {
  name: string
  mesocycle_id: number
  run_type: RunType
  target_pace?: string
  hr_zone?: number | null
  interval_count?: number | null
  interval_rest?: number | null
  coaching_cues?: string
  target_distance?: number | null
  target_duration?: number | null
  target_elevation_gain?: number | null
}

type CreateRunningTemplateResult =
  | { success: true; data: TemplateRow }
  | { success: false; error: string }

const createMmaBjjTemplateSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Name is required')),
  mesocycle_id: z.number().int().positive('Invalid mesocycle ID'),
  planned_duration: z
    .number()
    .int()
    .positive('Duration must be a positive number of minutes')
    .nullable()
    .optional()
    .transform((v) => v ?? null),
})

export type CreateMmaBjjTemplateInput = {
  name: string
  mesocycle_id: number
  planned_duration?: number | null
}

type CreateMmaBjjTemplateResult =
  | { success: true; data: TemplateRow }
  | { success: false; error: string }

export async function createMmaBjjTemplate(
  input: CreateMmaBjjTemplateInput
): Promise<CreateMmaBjjTemplateResult> {
  const parsed = createMmaBjjTemplateSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const { name, mesocycle_id, planned_duration } = parsed.data

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

  const existing = db
    .select()
    .from(workout_templates)
    .where(
      and(
        eq(workout_templates.mesocycle_id, mesocycle_id),
        eq(workout_templates.canonical_name, canonicalName)
      )
    )
    .get()

  if (existing) {
    return {
      success: false,
      error: `A template with duplicate canonical name "${canonicalName}" already exists in this mesocycle`,
    }
  }

  try {
    const created = db
      .insert(workout_templates)
      .values({
        mesocycle_id,
        name,
        canonical_name: canonicalName,
        modality: 'mma',
        planned_duration,
        estimated_duration: estimateMmaDuration(planned_duration),
        display_order: getNextDisplayOrder(mesocycle_id),
        created_at: new Date(),
      })
      .returning()
      .get()

    revalidatePath('/mesocycles')
    return { success: true, data: created }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('UNIQUE constraint failed')
    ) {
      return {
        success: false,
        error: 'A template with this name already exists in this mesocycle',
      }
    }
    return { success: false, error: 'Failed to create template' }
  }
}

export async function createRunningTemplate(
  input: CreateRunningTemplateInput
): Promise<CreateRunningTemplateResult> {
  const parsed = createRunningTemplateSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const {
    name,
    mesocycle_id,
    run_type,
    target_pace,
    hr_zone,
    interval_count,
    interval_rest,
    coaching_cues,
    target_distance,
    target_duration,
    target_elevation_gain,
  } = parsed.data

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

  const existing = db
    .select()
    .from(workout_templates)
    .where(
      and(
        eq(workout_templates.mesocycle_id, mesocycle_id),
        eq(workout_templates.canonical_name, canonicalName)
      )
    )
    .get()

  if (existing) {
    return {
      success: false,
      error: `A template with duplicate canonical name "${canonicalName}" already exists in this mesocycle`,
    }
  }

  try {
    const created = db
      .insert(workout_templates)
      .values({
        mesocycle_id,
        name,
        canonical_name: canonicalName,
        modality: 'running',
        run_type,
        target_pace,
        hr_zone,
        interval_count,
        interval_rest,
        coaching_cues,
        target_distance,
        target_duration,
        target_elevation_gain,
        estimated_duration: estimateRunningDuration(target_duration),
        display_order: getNextDisplayOrder(mesocycle_id),
        created_at: new Date(),
      })
      .returning()
      .get()

    revalidatePath('/mesocycles')
    return { success: true, data: created }
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('UNIQUE constraint failed')
    ) {
      return {
        success: false,
        error: 'A template with this name already exists in this mesocycle',
      }
    }
    return { success: false, error: 'Failed to create template' }
  }
}

// ============================================================================
// Update template
// ============================================================================

const updateTemplateSchema = z.object({
  id: z.number().int().positive(),
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Name is required'))
    .optional(),
  canonical_name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Canonical name is required'))
    .optional(),
})

type UpdateTemplateInput = {
  id: number
  name?: string
  canonical_name?: string
}

type UpdateTemplateResult =
  | { success: true; data: TemplateRow }
  | { success: false; error: string }

export async function updateTemplate(
  input: UpdateTemplateInput
): Promise<UpdateTemplateResult> {
  const parsed = updateTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { id, name, canonical_name } = parsed.data

  if (!name && !canonical_name) {
    return { success: false, error: 'Nothing to update' }
  }

  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, template.mesocycle_id))
    .get()

  if (meso?.status === 'completed') {
    return { success: false, error: 'Cannot edit template on a completed mesocycle' }
  }

  // Validate and slug canonical_name if provided
  const newCanonical = canonical_name ?? template.canonical_name
  const slugged = generateCanonicalName(newCanonical)
  if (!slugged) {
    return { success: false, error: 'Canonical name produces an empty slug' }
  }

  // Check uniqueness within mesocycle (excluding self)
  if (canonical_name && slugged !== template.canonical_name) {
    const dup = db
      .select()
      .from(workout_templates)
      .where(
        and(
          eq(workout_templates.mesocycle_id, template.mesocycle_id),
          eq(workout_templates.canonical_name, slugged)
        )
      )
      .get()

    if (dup && dup.id !== id) {
      return {
        success: false,
        error: `A template with canonical name "${slugged}" already exists in this mesocycle`,
      }
    }
  }

  try {
    const updated = db
      .update(workout_templates)
      .set({
        ...(name ? { name } : {}),
        ...(canonical_name ? { canonical_name: slugged } : {}),
      })
      .where(eq(workout_templates.id, id))
      .returning()
      .get()

    revalidatePath('/mesocycles')
    return { success: true, data: updated }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'A template with this canonical name already exists' }
    }
    return { success: false, error: 'Failed to update template' }
  }
}

// ============================================================================
// Delete template
// ============================================================================

type DeleteTemplateResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteTemplate(id: number): Promise<DeleteTemplateResult> {
  if (!id || !Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid template ID' }
  }

  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, id))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  const meso = db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, template.mesocycle_id))
    .get()

  if (meso?.status === 'completed') {
    return { success: false, error: 'Cannot delete template on a completed mesocycle' }
  }

  // Block if has exercise slots
  const slots = db
    .select({ id: exercise_slots.id })
    .from(exercise_slots)
    .where(eq(exercise_slots.template_id, id))
    .all()

  if (slots.length > 0) {
    return {
      success: false,
      error: `Cannot delete: template has ${slots.length} exercise slot${slots.length === 1 ? '' : 's'}. Remove slots first.`,
    }
  }

  // Block if has schedule assignments
  const scheduleRefs = db
    .select({ id: weekly_schedule.id })
    .from(weekly_schedule)
    .where(eq(weekly_schedule.template_id, id))
    .all()

  if (scheduleRefs.length > 0) {
    return {
      success: false,
      error: `Cannot delete: template is assigned to ${scheduleRefs.length} schedule slot${scheduleRefs.length === 1 ? '' : 's'}. Remove assignments first.`,
    }
  }

  db.delete(workout_templates).where(eq(workout_templates.id, id)).run()

  revalidatePath('/mesocycles')
  return { success: true }
}

// ============================================================================
// Reorder templates within a mesocycle
// ============================================================================

const reorderTemplatesSchema = z.object({
  mesocycle_id: z.number().int().positive(),
  template_ids: z.array(z.number().int().positive()).min(1),
})

type ReorderTemplatesInput = {
  mesocycle_id: number
  template_ids: number[]
}

type ReorderTemplatesResult =
  | { success: true; noop?: boolean }
  | { success: false; error: string }

export async function reorderTemplates(
  input: ReorderTemplatesInput
): Promise<ReorderTemplatesResult> {
  const parsed = reorderTemplatesSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { mesocycle_id, template_ids } = parsed.data

  const meso = db
    .select({ status: mesocycles.status })
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycle_id))
    .get()

  if (!meso) {
    return { success: false, error: 'Mesocycle not found' }
  }

  if (meso.status === 'completed') {
    return { success: false, error: 'Cannot reorder templates on a completed mesocycle' }
  }

  const current = db
    .select({ id: workout_templates.id, display_order: workout_templates.display_order })
    .from(workout_templates)
    .where(eq(workout_templates.mesocycle_id, mesocycle_id))
    .orderBy(asc(workout_templates.display_order), asc(workout_templates.id))
    .all()

  const currentIds = new Set(current.map((t) => t.id))
  const inputIds = new Set(template_ids)

  if (
    currentIds.size !== inputIds.size ||
    ![...currentIds].every((id) => inputIds.has(id))
  ) {
    return {
      success: false,
      error: 'Template IDs mismatch: must include all mesocycle templates',
    }
  }

  const currentOrder = current.map((t) => t.id)
  const isUnchanged = template_ids.every((id, i) => id === currentOrder[i])
  if (isUnchanged) {
    return { success: true, noop: true }
  }

  db.transaction((tx) => {
    for (let i = 0; i < template_ids.length; i++) {
      tx.update(workout_templates)
        .set({ display_order: i })
        .where(eq(workout_templates.id, template_ids[i]))
        .run()
    }
  })

  revalidatePath('/mesocycles')
  return { success: true }
}
