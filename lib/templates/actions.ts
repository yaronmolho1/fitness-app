'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/index'
import { workout_templates, mesocycles } from '@/lib/db/schema'
import { generateCanonicalName } from './utils'

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
