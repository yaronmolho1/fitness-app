import { eq, and, asc } from 'drizzle-orm'
import type { AppDb } from '@/lib/db'
import { exercise_slots, slot_week_overrides } from '@/lib/db/schema'

type OverrideRow = typeof slot_week_overrides.$inferSelect

type UpsertFields = {
  weight?: number | null
  reps?: string | null
  sets?: number | null
  rpe?: number | null
  distance?: number | null
  duration?: number | null
  pace?: string | null
  is_deload?: boolean
}

type UpsertResult =
  | { success: true; data: OverrideRow }
  | { success: false; error: string }

type DeleteResult = { success: true } | { success: false; error: string }

/**
 * Insert or update a week override for a given slot + week.
 * If an override already exists for the (slot, week) pair, it's replaced.
 */
export async function upsertWeekOverride(
  db: AppDb,
  slotId: number,
  weekNumber: number,
  fields: UpsertFields
): Promise<UpsertResult> {
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return { success: false, error: 'Week number must be a positive integer' }
  }

  // Verify slot exists
  const slot = db
    .select()
    .from(exercise_slots)
    .where(eq(exercise_slots.id, slotId))
    .get()

  if (!slot) {
    return { success: false, error: 'Slot not found' }
  }

  // Build values from provided fields
  const values: Record<string, unknown> = {}
  if (fields.weight !== undefined) values.weight = fields.weight
  if (fields.reps !== undefined) values.reps = fields.reps
  if (fields.sets !== undefined) values.sets = fields.sets
  if (fields.rpe !== undefined) values.rpe = fields.rpe
  if (fields.distance !== undefined) values.distance = fields.distance
  if (fields.duration !== undefined) values.duration = fields.duration
  if (fields.pace !== undefined) values.pace = fields.pace
  if (fields.is_deload !== undefined) values.is_deload = fields.is_deload ? 1 : 0

  const whereClause = and(
    eq(slot_week_overrides.exercise_slot_id, slotId),
    eq(slot_week_overrides.week_number, weekNumber)
  )

  // Check if override already exists
  const existing = db
    .select()
    .from(slot_week_overrides)
    .where(whereClause)
    .get()

  if (existing) {
    const updated = db
      .update(slot_week_overrides)
      .set(values)
      .where(whereClause)
      .returning()
      .get()

    return { success: true, data: updated }
  }

  const created = db
    .insert(slot_week_overrides)
    .values({
      exercise_slot_id: slotId,
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
 * Delete a week override for a given slot + week. No-op if it doesn't exist.
 */
export async function deleteWeekOverride(
  db: AppDb,
  slotId: number,
  weekNumber: number
): Promise<DeleteResult> {
  db.delete(slot_week_overrides)
    .where(
      and(
        eq(slot_week_overrides.exercise_slot_id, slotId),
        eq(slot_week_overrides.week_number, weekNumber)
      )
    )
    .run()

  return { success: true }
}

/**
 * Get all overrides for a slot, ordered by week_number ascending.
 */
export async function getWeekOverrides(
  db: AppDb,
  slotId: number
): Promise<OverrideRow[]> {
  return db
    .select()
    .from(slot_week_overrides)
    .where(eq(slot_week_overrides.exercise_slot_id, slotId))
    .orderBy(asc(slot_week_overrides.week_number))
    .all()
}

// -- Pure helpers (no DB) --

type SlotFields = Record<string, unknown>
type OverrideFields = Record<string, unknown>

// Only merge training-parameter fields from overrides
const MERGE_FIELDS = new Set([
  'weight', 'reps', 'sets', 'rpe', 'distance', 'duration', 'pace',
])

/**
 * Merge a base slot with an override. Override fields take precedence when
 * non-null; null fields fall back to base values. Only training-parameter
 * fields are merged — metadata like id, exercise_slot_id, week_number are ignored.
 */
export function mergeSlotWithOverride<T extends SlotFields>(
  base: T,
  override: OverrideFields | null
): T {
  if (!override) return { ...base }

  const merged = { ...base }
  for (const key of MERGE_FIELDS) {
    if (key in override && override[key] !== null && override[key] !== undefined) {
      ;(merged as Record<string, unknown>)[key] = override[key]
    }
  }
  return merged
}

type DeloadInput = {
  weight: number | null
  sets: number
  rpe: number | null
}

type DeloadResult = {
  weight: number | null
  sets: number
  rpe: number | null
}

/**
 * Compute deload defaults: 60% weight, 50% sets (min 1), RPE -2 (min 1).
 * Reps are preserved at 100% (not included in output).
 */
export function computeDeloadDefaults(base: DeloadInput): DeloadResult {
  return {
    weight: base.weight !== null ? Math.round(base.weight * 0.6 * 100) / 100 : null,
    sets: Math.max(1, Math.floor(base.sets * 0.5)),
    rpe: base.rpe !== null ? Math.max(1, base.rpe - 2) : null,
  }
}
