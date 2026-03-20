'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { routine_items, routine_logs, mesocycles } from '@/lib/db/schema'

const INPUT_FIELDS = ['weight', 'length', 'duration', 'sets', 'reps'] as const
type InputField = (typeof INPUT_FIELDS)[number]

const scopeTypeEnum = z.enum(['global', 'per_mesocycle', 'date_range', 'skip_on_deload'])
const frequencyModeEnum = z.enum(['daily', 'specific_days', 'weekly_target'])

const baseSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or fewer')),
  category: z.string().optional(),
  input_fields: z
    .array(z.enum(INPUT_FIELDS))
    .min(1, 'At least one input field is required'),
  frequency_target: z
    .number()
    .int('Frequency target must be an integer')
    .min(1, 'Frequency target must be at least 1'),
  frequency_mode: frequencyModeEnum.default('weekly_target'),
  frequency_days: z.array(z.number().int().min(0).max(6)).optional(),
  scope_type: scopeTypeEnum,
  mesocycle_id: z.number().int().positive().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
})

// Scope-specific validation applied after base parse
function validateScope(data: z.infer<typeof baseSchema>): string | null {
  switch (data.scope_type) {
    case 'per_mesocycle':
      if (!data.mesocycle_id) return 'mesocycle_id is required for per_mesocycle scope'
      break
    case 'date_range':
      if (!data.start_date) return 'start_date is required for date_range scope'
      if (!data.end_date) return 'end_date is required for date_range scope'
      if (data.start_date && data.end_date && data.end_date < data.start_date) {
        return 'end_date must be on or after start_date'
      }
      break
    // global and skip_on_deload need no extra fields
  }
  return null
}

function inputFieldsToColumns(fields: InputField[]) {
  return {
    has_weight: fields.includes('weight'),
    has_length: fields.includes('length'),
    has_duration: fields.includes('duration'),
    has_sets: fields.includes('sets'),
    has_reps: fields.includes('reps'),
  }
}

// Map scope_type input to DB scope column + skip_on_deload flag
function scopeToDb(scopeType: z.infer<typeof scopeTypeEnum>) {
  if (scopeType === 'skip_on_deload') {
    return { scope: 'global' as const, skip_on_deload: true }
  }
  const dbScope = scopeType === 'per_mesocycle' ? 'mesocycle' as const : scopeType
  return { scope: dbScope, skip_on_deload: false }
}

type RoutineItemRow = typeof routine_items.$inferSelect

export type CreateRoutineItemInput = {
  name: string
  category?: string
  input_fields: readonly InputField[]
  frequency_target: number
  frequency_mode?: 'daily' | 'specific_days' | 'weekly_target'
  frequency_days?: number[]
  scope_type: 'global' | 'per_mesocycle' | 'date_range' | 'skip_on_deload'
  mesocycle_id?: number
  start_date?: string
  end_date?: string
}

type RoutineItemResult =
  | { success: true; data: RoutineItemRow }
  | { success: false; error: string }

type DeleteResult =
  | { success: true }
  | { success: false; error: string }

export async function createRoutineItem(
  input: CreateRoutineItemInput
): Promise<RoutineItemResult> {
  const parsed = baseSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const scopeError = validateScope(parsed.data)
  if (scopeError) return { success: false, error: scopeError }

  const { name, category, input_fields, frequency_target, frequency_mode, frequency_days, scope_type, mesocycle_id, start_date, end_date } = parsed.data

  // Verify mesocycle exists for per_mesocycle scope
  if (scope_type === 'per_mesocycle' && mesocycle_id) {
    const existing = await db
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.id, mesocycle_id))
    if (existing.length === 0) {
      return { success: false, error: 'Referenced mesocycle not found' }
    }
  }

  const { scope, skip_on_deload } = scopeToDb(scope_type)
  const columns = inputFieldsToColumns([...input_fields])

  try {
    const [created] = await db
      .insert(routine_items)
      .values({
        name,
        category: category || null,
        ...columns,
        frequency_target,
        frequency_mode,
        frequency_days: frequency_mode === 'specific_days' ? (frequency_days ?? null) : null,
        scope,
        mesocycle_id: scope_type === 'per_mesocycle' ? mesocycle_id! : null,
        start_date: scope_type === 'date_range' ? start_date! : null,
        end_date: scope_type === 'date_range' ? end_date! : null,
        skip_on_deload,
        created_at: new Date(),
      })
      .returning()

    revalidatePath('/routines')
    return { success: true, data: created }
  } catch {
    return { success: false, error: 'Failed to create routine item' }
  }
}

export type UpdateRoutineItemInput = CreateRoutineItemInput & { id: number }

export async function updateRoutineItem(
  input: UpdateRoutineItemInput
): Promise<RoutineItemResult> {
  const idSchema = z.number().int().positive('Invalid routine item ID')
  const idResult = idSchema.safeParse(input.id)
  if (!idResult.success) {
    return { success: false, error: idResult.error.issues[0].message }
  }

  const parsed = baseSchema.safeParse(input)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return { success: false, error: firstError.message }
  }

  const scopeError = validateScope(parsed.data)
  if (scopeError) return { success: false, error: scopeError }

  const { name, category, input_fields, frequency_target, frequency_mode, frequency_days, scope_type, mesocycle_id, start_date, end_date } = parsed.data

  // Verify mesocycle exists for per_mesocycle scope
  if (scope_type === 'per_mesocycle' && mesocycle_id) {
    const existing = await db
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.id, mesocycle_id))
    if (existing.length === 0) {
      return { success: false, error: 'Referenced mesocycle not found' }
    }
  }

  const { scope, skip_on_deload } = scopeToDb(scope_type)
  const columns = inputFieldsToColumns([...input_fields])

  try {
    const [updated] = await db
      .update(routine_items)
      .set({
        name,
        category: category || null,
        ...columns,
        frequency_target,
        frequency_mode,
        frequency_days: frequency_mode === 'specific_days' ? (frequency_days ?? null) : null,
        scope,
        mesocycle_id: scope_type === 'per_mesocycle' ? mesocycle_id! : null,
        start_date: scope_type === 'date_range' ? start_date! : null,
        end_date: scope_type === 'date_range' ? end_date! : null,
        skip_on_deload,
      })
      .where(eq(routine_items.id, input.id))
      .returning()

    if (!updated) {
      return { success: false, error: 'Routine item not found' }
    }

    revalidatePath('/routines')
    return { success: true, data: updated }
  } catch {
    return { success: false, error: 'Failed to update routine item' }
  }
}

// ============================================================================
// Mark done / skipped
// ============================================================================

const VALUE_FIELDS = ['weight', 'length', 'duration', 'sets', 'reps'] as const
type ValueField = (typeof VALUE_FIELDS)[number]

const INTEGER_FIELDS: ValueField[] = ['sets', 'reps']

const logDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
const routineItemIdSchema = z.number().int().positive('Invalid routine item ID')

export type MarkDoneInput = {
  routine_item_id: number
  log_date: string
  values: Partial<Record<ValueField, number>>
}

export type MarkSkippedInput = {
  routine_item_id: number
  log_date: string
}

type RoutineLogRow = typeof routine_logs.$inferSelect

type RoutineLogResult =
  | { success: true; data: RoutineLogRow }
  | { success: false; error: string }

async function getItemAndCheckDuplicate(
  routineItemId: number,
  logDate: string
): Promise<
  | { ok: true; item: RoutineItemRow }
  | { ok: false; error: string }
> {
  const [item] = await db
    .select()
    .from(routine_items)
    .where(eq(routine_items.id, routineItemId))

  if (!item) return { ok: false, error: 'Routine item not found' }

  const existing = await db
    .select()
    .from(routine_logs)
    .where(
      and(
        eq(routine_logs.routine_item_id, routineItemId),
        eq(routine_logs.log_date, logDate)
      )
    )

  if (existing.length > 0) {
    return { ok: false, error: 'Already logged for this date' }
  }

  return { ok: true, item }
}

export async function markRoutineDone(
  input: MarkDoneInput
): Promise<RoutineLogResult> {
  const idResult = routineItemIdSchema.safeParse(input.routine_item_id)
  if (!idResult.success) return { success: false, error: idResult.error.issues[0].message }

  const dateResult = logDateSchema.safeParse(input.log_date)
  if (!dateResult.success) return { success: false, error: dateResult.error.issues[0].message }

  const { values } = input

  // Must provide at least one value
  const providedFields = VALUE_FIELDS.filter(
    (f) => values[f] !== undefined && values[f] !== null
  )
  if (providedFields.length === 0) {
    return { success: false, error: 'At least one field value is required' }
  }

  // Validate no negative values
  for (const field of providedFields) {
    const v = values[field]!
    if (v < 0) {
      return { success: false, error: `Negative values are not allowed (${field})` }
    }
    if (INTEGER_FIELDS.includes(field) && !Number.isInteger(v)) {
      return { success: false, error: `${field} must be an integer` }
    }
  }

  const check = await getItemAndCheckDuplicate(input.routine_item_id, input.log_date)
  if (!check.ok) return { success: false, error: check.error }

  const { item } = check

  // Only persist values for fields the item has enabled
  const fieldToFlag: Record<ValueField, keyof RoutineItemRow> = {
    weight: 'has_weight',
    length: 'has_length',
    duration: 'has_duration',
    sets: 'has_sets',
    reps: 'has_reps',
  }

  try {
    const [log] = await db
      .insert(routine_logs)
      .values({
        routine_item_id: input.routine_item_id,
        log_date: input.log_date,
        status: 'done',
        value_weight: item[fieldToFlag.weight] ? (values.weight ?? null) : null,
        value_length: item[fieldToFlag.length] ? (values.length ?? null) : null,
        value_duration: item[fieldToFlag.duration] ? (values.duration ?? null) : null,
        value_sets: item[fieldToFlag.sets] ? (values.sets ?? null) : null,
        value_reps: item[fieldToFlag.reps] ? (values.reps ?? null) : null,
        created_at: new Date(),
      })
      .returning()

    revalidatePath('/routines')
    return { success: true, data: log }
  } catch {
    return { success: false, error: 'Failed to create routine log' }
  }
}

export async function markRoutineSkipped(
  input: MarkSkippedInput
): Promise<RoutineLogResult> {
  const idResult = routineItemIdSchema.safeParse(input.routine_item_id)
  if (!idResult.success) return { success: false, error: idResult.error.issues[0].message }

  const dateResult = logDateSchema.safeParse(input.log_date)
  if (!dateResult.success) return { success: false, error: dateResult.error.issues[0].message }

  const check = await getItemAndCheckDuplicate(input.routine_item_id, input.log_date)
  if (!check.ok) return { success: false, error: check.error }

  try {
    const [log] = await db
      .insert(routine_logs)
      .values({
        routine_item_id: input.routine_item_id,
        log_date: input.log_date,
        status: 'skipped',
        value_weight: null,
        value_length: null,
        value_duration: null,
        value_sets: null,
        value_reps: null,
        created_at: new Date(),
      })
      .returning()

    revalidatePath('/routines')
    return { success: true, data: log }
  } catch {
    return { success: false, error: 'Failed to create routine log' }
  }
}

export async function deleteRoutineItem(id: number): Promise<DeleteResult> {
  if (!Number.isInteger(id) || id < 1) {
    return { success: false, error: 'Invalid routine item ID' }
  }

  try {
    const existing = await db
      .select()
      .from(routine_items)
      .where(eq(routine_items.id, id))

    if (existing.length === 0) {
      return { success: false, error: 'Routine item not found' }
    }

    // Check for existing logs — routine_logs are immutable
    const logs = await db
      .select()
      .from(routine_logs)
      .where(eq(routine_logs.routine_item_id, id))

    if (logs.length > 0) {
      return { success: false, error: 'Cannot delete routine item with existing logs' }
    }

    await db.delete(routine_items).where(eq(routine_items.id, id))

    revalidatePath('/routines')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete routine item' }
  }
}
