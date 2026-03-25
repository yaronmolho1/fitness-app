import { eq, and, asc, isNull } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { template_week_overrides, workout_templates } from '@/lib/db/schema'

type OverrideRow = typeof template_week_overrides.$inferSelect

type UpsertFields = {
  distance?: number | null
  duration?: number | null
  pace?: string | null
  planned_duration?: number | null
  is_deload?: boolean
}

type UpsertResult =
  | { success: true; data: OverrideRow }
  | { success: false; error: string }

type DeleteResult = { success: true } | { success: false; error: string }

// Build the section_id part of a where clause, handling null correctly
function sectionCondition(sectionId: number | null) {
  return sectionId === null
    ? isNull(template_week_overrides.section_id)
    : eq(template_week_overrides.section_id, sectionId)
}

/**
 * Insert or update a week override for a given template + section + week.
 * If an override already exists for the (template, section, week) triple, it's replaced.
 */
export async function upsertTemplateWeekOverride(
  db: AppDb,
  templateId: number,
  sectionId: number | null,
  weekNumber: number,
  fields: UpsertFields
): Promise<UpsertResult> {
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return { success: false, error: 'Week number must be a positive integer' }
  }

  // Verify template exists
  const template = db
    .select()
    .from(workout_templates)
    .where(eq(workout_templates.id, templateId))
    .get()

  if (!template) {
    return { success: false, error: 'Template not found' }
  }

  // Build values from provided fields
  const values: Record<string, unknown> = {}
  if (fields.distance !== undefined) values.distance = fields.distance
  if (fields.duration !== undefined) values.duration = fields.duration
  if (fields.pace !== undefined) values.pace = fields.pace
  if (fields.planned_duration !== undefined) values.planned_duration = fields.planned_duration
  if (fields.is_deload !== undefined) values.is_deload = fields.is_deload ? 1 : 0

  const whereClause = and(
    eq(template_week_overrides.template_id, templateId),
    sectionCondition(sectionId),
    eq(template_week_overrides.week_number, weekNumber)
  )

  // Check if override already exists
  const existing = db
    .select()
    .from(template_week_overrides)
    .where(whereClause)
    .get()

  if (existing) {
    const updated = db
      .update(template_week_overrides)
      .set(values)
      .where(whereClause)
      .returning()
      .get()

    return { success: true, data: updated }
  }

  const created = db
    .insert(template_week_overrides)
    .values({
      template_id: templateId,
      section_id: sectionId,
      week_number: weekNumber,
      ...values,
      is_deload: (values.is_deload as number) ?? 0,
      created_at: new Date(),
    })
    .returning()
    .get()

  return { success: true, data: created }
}

/**
 * Delete a week override for a given template + section + week. No-op if it doesn't exist.
 */
export async function deleteTemplateWeekOverride(
  db: AppDb,
  templateId: number,
  sectionId: number | null,
  weekNumber: number
): Promise<DeleteResult> {
  db.delete(template_week_overrides)
    .where(
      and(
        eq(template_week_overrides.template_id, templateId),
        sectionCondition(sectionId),
        eq(template_week_overrides.week_number, weekNumber)
      )
    )
    .run()

  return { success: true }
}

/**
 * Get all overrides for a template + section, ordered by week_number ascending.
 */
export async function getTemplateWeekOverrides(
  db: AppDb,
  templateId: number,
  sectionId: number | null
): Promise<OverrideRow[]> {
  return db
    .select()
    .from(template_week_overrides)
    .where(
      and(
        eq(template_week_overrides.template_id, templateId),
        sectionCondition(sectionId)
      )
    )
    .orderBy(asc(template_week_overrides.week_number))
    .all()
}
