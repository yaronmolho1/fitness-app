import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import { eq, and, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  google_calendar_events,
  mesocycles,
  weekly_schedule,
  workout_templates,
  exercise_slots,
  exercises,
} from '@/lib/db/schema'
import { getAuthenticatedClient } from './client'
import { getGoogleCredentials, getEventsByMesocycle, getAthleteTimezone } from './queries'
import { getEndTime } from '@/lib/schedule/time-utils'
import { getEffectiveScheduleForDay } from '@/lib/schedule/override-queries'
import type { GCalEventParams, SyncResult, SyncAction, GCalEventBody } from './types'

// Google Calendar event color IDs by modality
export const MODALITY_COLORS: Record<string, string> = {
  resistance: '9',  // blueberry
  running: '2',     // sage
  mma: '11',        // tomato
  mixed: '3',       // grape
}

const BATCH_SIZE = 5
let failCounter = 0

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getDurationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

// Build a Google Calendar event body from params
export function buildEventBody(params: GCalEventParams): GCalEventBody {
  const startDateTime = `${params.date}T${params.timeSlot}:00`
  const endTime = getEndTime(params.timeSlot, params.duration)
  const endDateTime = `${params.date}T${endTime}:00`
  const prefix = params.completed ? '✅ ' : ''

  const descriptionParts: string[] = []
  if (params.exercises?.length) {
    descriptionParts.push(`Exercises: ${params.exercises.join(', ')}`)
  }
  if (params.appUrl) {
    descriptionParts.push('')
    const viewUrl = `${params.appUrl}/?date=${params.date}`
    const logUrl = `${params.appUrl}/?date=${params.date}&action=log`
    descriptionParts.push(`<a href="${viewUrl}">View workout</a>`)
    descriptionParts.push(`<a href="${logUrl}">Log workout</a>`)
  }

  return {
    summary: `${prefix}${params.templateName} — Week ${params.weekNumber}`,
    description: descriptionParts.join('<br>'),
    start: { dateTime: startDateTime, timeZone: params.timezone },
    end: { dateTime: endDateTime, timeZone: params.timezone },
    source: params.appUrl ? { url: params.appUrl, title: 'Fitness App' } : undefined,
    colorId: MODALITY_COLORS[params.modality] ?? '1',
    extendedProperties: {
      private: {
        mesocycleId: String(params.mesocycleId),
        templateId: String(params.templateId),
        eventDate: params.date,
      },
    },
  }
}

function emptySyncResult(): SyncResult {
  return { created: 0, updated: 0, deleted: 0, failed: 0, errors: [] }
}

// Check if error is a 404/410 (event no longer exists in GCal)
function isGoneError(err: unknown): boolean {
  const code = (err as { code?: number }).code
  return code === 404 || code === 410
}

// Get day_of_week using ISO convention (0=Monday, 6=Sunday)
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z')
  return (d.getUTCDay() + 6) % 7
}

// Compute 1-based week number from mesocycle start
function getWeekNumber(startDate: string, dateStr: string): number {
  const start = new Date(startDate + 'T00:00:00Z')
  const current = new Date(dateStr + 'T00:00:00Z')
  const diffDays = Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

// Project all dates within a mesocycle range for a given day_of_week
function projectDatesForDay(
  startDate: string,
  endDate: string,
  dayOfWeek: number
): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')

  const current = new Date(start)
  // Advance to first occurrence of dayOfWeek
  const currentDow = (current.getUTCDay() + 6) % 7
  let diff = dayOfWeek - currentDow
  if (diff < 0) diff += 7
  current.setUTCDate(current.getUTCDate() + diff)

  while (current <= end) {
    const y = current.getUTCFullYear()
    const m = String(current.getUTCMonth() + 1).padStart(2, '0')
    const d = String(current.getUTCDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    current.setUTCDate(current.getUTCDate() + 7)
  }

  return dates
}

// Load exercise names for a template
async function getExerciseNames(templateId: number): Promise<string[]> {
  const rows = await db
    .select({ name: exercises.name })
    .from(exercise_slots)
    .innerJoin(exercises, eq(exercise_slots.exercise_id, exercises.id))
    .where(eq(exercise_slots.template_id, templateId))
    .orderBy(exercise_slots.order)
    .all()
  return rows.map((r) => r.name)
}

// Create a single event in Google Calendar and store mapping
async function createEvent(
  calendarApi: calendar_v3.Calendar,
  calendarId: string,
  params: GCalEventParams,
  result: SyncResult
): Promise<void> {
  try {
    const body = buildEventBody(params)
    const res = await calendarApi.events.insert({
      calendarId,
      requestBody: body,
    })

    const googleEventId = res.data.id
    if (googleEventId) {
      const now = new Date()
      await db.insert(google_calendar_events).values({
        google_event_id: googleEventId,
        mesocycle_id: params.mesocycleId,
        schedule_entry_id: params.scheduleEntryId,
        event_date: params.date,
        summary: body.summary ?? '',
        start_time: params.timeSlot,
        end_time: getEndTime(params.timeSlot, params.duration),
        sync_status: 'synced',
        last_synced_at: now,
        created_at: now,
        updated_at: now,
      })
    }

    result.created++
  } catch (err) {
    result.failed++
    result.errors.push({
      operation: 'create',
      date: params.date,
      templateId: params.templateId,
      message: err instanceof Error ? err.message : String(err),
    })

    // Record failed mapping for retry (unique placeholder per failure)
    failCounter++
    const now = new Date()
    await db.insert(google_calendar_events).values({
      google_event_id: `pending-${params.date}-${params.templateId}-${failCounter}-${now.getTime()}`,
      mesocycle_id: params.mesocycleId,
      schedule_entry_id: params.scheduleEntryId,
      event_date: params.date,
      summary: `${params.templateName} — Week ${params.weekNumber}`,
      start_time: params.timeSlot,
      end_time: getEndTime(params.timeSlot, params.duration),
      sync_status: 'error',
      created_at: now,
      updated_at: now,
    })
  }
}

// Delete a single event from Google Calendar and remove mapping
async function deleteEvent(
  calendarApi: calendar_v3.Calendar,
  calendarId: string,
  mapping: { id: number; google_event_id: string },
  result: SyncResult
): Promise<void> {
  try {
    await calendarApi.events.delete({
      calendarId,
      eventId: mapping.google_event_id,
    })
  } catch (err) {
    // 404/410 = already gone, treat as success
    if (!isGoneError(err)) {
      result.failed++
      result.errors.push({
        operation: 'delete',
        date: '',
        templateId: 0,
        message: err instanceof Error ? err.message : String(err),
      })
      return
    }
  }

  await db.delete(google_calendar_events).where(eq(google_calendar_events.id, mapping.id))
  result.deleted++
}

// Shared setup: check connection, get calendar API + credentials
export async function getCalendarContext() {
  const creds = await getGoogleCredentials()
  if (!creds?.calendar_id) return null

  const authClient = await getAuthenticatedClient()
  if (!authClient) return null

  const calendarApi = google.calendar({ version: 'v3', auth: authClient })
  const timezone = (await getAthleteTimezone()) ?? 'UTC'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return { creds, calendarApi, calendarId: creds.calendar_id, timezone, appUrl }
}

/**
 * Push all projected workouts for a mesocycle to Google Calendar.
 * Batch-inserts up to 50 events at a time.
 */
export async function syncMesocycle(mesoId: number): Promise<SyncResult> {
  const result = emptySyncResult()
  const ctx = await getCalendarContext()
  if (!ctx) return result

  // Load mesocycle
  const meso = await db
    .select()
    .from(mesocycles)
    .where(eq(mesocycles.id, mesoId))
    .get()
  if (!meso) return result

  // Delete existing Google Calendar events + local mappings for idempotency
  const existingMappings = await db
    .select({ id: google_calendar_events.id, google_event_id: google_calendar_events.google_event_id })
    .from(google_calendar_events)
    .where(eq(google_calendar_events.mesocycle_id, mesoId))
    .all()

  for (const mapping of existingMappings) {
    if (!mapping.google_event_id.startsWith('pending-')) {
      try {
        await ctx.calendarApi.events.delete({
          calendarId: ctx.calendarId,
          eventId: mapping.google_event_id,
        })
      } catch (err) {
        if (!isGoneError(err)) {
          result.failed++
        }
      }
      await sleep(250)
    }
  }
  await db.delete(google_calendar_events).where(
    eq(google_calendar_events.mesocycle_id, mesoId)
  )

  // Build all event params using effective schedule (base + overrides) per date
  const totalWeeks = meso.work_weeks + (meso.has_deload ? 1 : 0)
  const allParams: GCalEventParams[] = []
  const templateCache = new Map<number, { name: string; modality: string }>()
  const exerciseCache = new Map<number, string[]>()

  const startDate = new Date(meso.start_date + 'T00:00:00Z')
  const endDate = new Date(meso.end_date + 'T00:00:00Z')
  const cursor = new Date(startDate)

  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const dayOfWeek = (cursor.getUTCDay() + 6) % 7
    const weekNum = getWeekNumber(meso.start_date, dateStr)
    const isDeloadWeek = meso.has_deload && weekNum === totalWeeks
    const weekType = isDeloadWeek ? 'deload' as const : 'normal' as const

    const entries = await getEffectiveScheduleForDay(
      db, mesoId, weekNum, dayOfWeek, weekType
    )

    for (const entry of entries) {
      if (!entry.template_id) continue

      if (!templateCache.has(entry.template_id)) {
        const t = await db
          .select()
          .from(workout_templates)
          .where(eq(workout_templates.id, entry.template_id))
          .get()
        if (t) templateCache.set(t.id, { name: t.name, modality: t.modality })
      }
      const template = templateCache.get(entry.template_id)
      if (!template) continue

      if (!exerciseCache.has(entry.template_id)) {
        exerciseCache.set(entry.template_id, await getExerciseNames(entry.template_id))
      }

      allParams.push({
        templateName: template.name,
        modality: template.modality,
        date: dateStr,
        timeSlot: entry.time_slot,
        duration: entry.duration,
        weekNumber: weekNum,
        timezone: ctx.timezone,
        appUrl: ctx.appUrl,
        mesocycleId: mesoId,
        templateId: entry.template_id,
        scheduleEntryId: entry.schedule_entry_id,
        exercises: exerciseCache.get(entry.template_id),
      })
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // Sequential insert with throttling to avoid Google API rate limits
  for (const params of allParams) {
    await createEvent(ctx.calendarApi, ctx.calendarId, params, result)
    await sleep(250)
  }

  return result
}

/**
 * Sync schedule changes: diff existing mappings against affected dates,
 * then insert/update/delete as needed.
 */
export async function syncScheduleChange(
  action: SyncAction,
  mesoId: number,
  affectedDates: string[]
): Promise<SyncResult> {
  const result = emptySyncResult()
  const ctx = await getCalendarContext()
  if (!ctx) return result

  const existingEvents = await getEventsByMesocycle(mesoId)
  const eventsByDate = new Map<string, typeof existingEvents>()
  for (const evt of existingEvents) {
    const list = eventsByDate.get(evt.event_date) ?? []
    list.push(evt)
    eventsByDate.set(evt.event_date, list)
  }

  if (action === 'remove') {
    // Delete events for all affected dates
    for (const date of affectedDates) {
      const events = eventsByDate.get(date) ?? []
      for (const evt of events) {
        await deleteEvent(ctx.calendarApi, ctx.calendarId, evt, result)
      }
    }
    return result
  }

  if (action === 'assign' || action === 'move' || action === 'reset') {
    // Load mesocycle for context
    const meso = await db
      .select()
      .from(mesocycles)
      .where(eq(mesocycles.id, mesoId))
      .get()
    if (!meso) return result

    const totalWeeks = meso.work_weeks + (meso.has_deload ? 1 : 0)

    for (const date of affectedDates) {
      // Delete existing events for this date first
      const existing = eventsByDate.get(date) ?? []
      for (const evt of existing) {
        await deleteEvent(ctx.calendarApi, ctx.calendarId, evt, result)
      }

      // Create new events based on effective schedule (base + overrides)
      const dayOfWeek = getDayOfWeek(date)
      const weekNum = getWeekNumber(meso.start_date, date)
      const isDeloadWeek = meso.has_deload && weekNum === totalWeeks
      const weekType = isDeloadWeek ? 'deload' as const : 'normal' as const

      const entries = await getEffectiveScheduleForDay(
        db, mesoId, weekNum, dayOfWeek, weekType
      )

      for (const entry of entries) {
        if (!entry.template_id) continue

        const template = await db
          .select()
          .from(workout_templates)
          .where(eq(workout_templates.id, entry.template_id))
          .get()
        if (!template) continue

        const exerciseNames = await getExerciseNames(template.id)

        await createEvent(ctx.calendarApi, ctx.calendarId, {
          templateName: template.name,
          modality: template.modality,
          date,
          timeSlot: entry.time_slot,
          duration: entry.duration,
          weekNumber: weekNum,
          timezone: ctx.timezone,
          appUrl: ctx.appUrl,
          mesocycleId: mesoId,
          templateId: template.id,
          scheduleEntryId: entry.schedule_entry_id,
          exercises: exerciseNames,
        }, result)
      }
    }
    return result
  }

  return result
}

/**
 * Update event title with completion checkmark when a workout is logged.
 * Handles 404/410 by recreating the event.
 */
export async function syncCompletion(
  mesoId: number,
  templateId: number,
  date: string
): Promise<SyncResult> {
  const result = emptySyncResult()
  const ctx = await getCalendarContext()
  if (!ctx) return result

  // Find schedule entries for this mesocycle + template to get schedule_entry_ids
  const scheduleEntries = await db
    .select({ id: weekly_schedule.id })
    .from(weekly_schedule)
    .where(
      and(
        eq(weekly_schedule.mesocycle_id, mesoId),
        eq(weekly_schedule.template_id, templateId)
      )
    )
    .all()

  const entryIds = scheduleEntries.map((e) => e.id)

  // Find existing event mapping for this mesocycle + date + template's schedule entries
  const events = await db
    .select()
    .from(google_calendar_events)
    .where(
      and(
        eq(google_calendar_events.mesocycle_id, mesoId),
        eq(google_calendar_events.event_date, date)
      )
    )
    .all()

  // Filter to the event matching this template's schedule entries
  const mapping = events.find((e) =>
    e.schedule_entry_id !== null && entryIds.includes(e.schedule_entry_id)
  ) ?? events[0]

  if (!mapping) return result
  const completedSummary = mapping.summary.startsWith('✅ ')
    ? mapping.summary
    : `✅ ${mapping.summary}`

  try {
    await ctx.calendarApi.events.update({
      calendarId: ctx.calendarId,
      eventId: mapping.google_event_id,
      requestBody: { summary: completedSummary },
    })

    // Update local mapping
    await db
      .update(google_calendar_events)
      .set({
        summary: completedSummary,
        last_synced_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(google_calendar_events.id, mapping.id))

    result.updated++
  } catch (err) {
    if (isGoneError(err)) {
      // Event was deleted from GCal — recreate with full body + completion prefix
      try {
        const template = await db
          .select({ name: workout_templates.name, modality: workout_templates.modality })
          .from(workout_templates)
          .where(eq(workout_templates.id, templateId))
          .get()
        const meso = await db
          .select({ start_date: mesocycles.start_date })
          .from(mesocycles)
          .where(eq(mesocycles.id, mesoId))
          .get()
        const exerciseNames = await getExerciseNames(templateId)

        const body = template && meso
          ? buildEventBody({
              templateName: template.name,
              modality: template.modality,
              date,
              timeSlot: mapping.start_time,
              duration: getDurationMinutes(mapping.start_time, mapping.end_time),
              weekNumber: getWeekNumber(meso.start_date, date),
              timezone: ctx.timezone,
              appUrl: ctx.appUrl,
              mesocycleId: mesoId,
              templateId,
              scheduleEntryId: mapping.schedule_entry_id,
              exercises: exerciseNames,
              completed: true,
            })
          : {
              summary: completedSummary,
              start: {
                dateTime: `${date}T${mapping.start_time}:00`,
                timeZone: ctx.timezone,
              },
              end: {
                dateTime: `${date}T${mapping.end_time}:00`,
                timeZone: ctx.timezone,
              },
            }

        const res = await ctx.calendarApi.events.insert({
          calendarId: ctx.calendarId,
          requestBody: body,
        })

        if (res.data.id) {
          await db
            .update(google_calendar_events)
            .set({
              google_event_id: res.data.id,
              summary: completedSummary,
              sync_status: 'synced',
              last_synced_at: new Date(),
              updated_at: new Date(),
            })
            .where(eq(google_calendar_events.id, mapping.id))
        }

        result.updated++
      } catch (recreateErr) {
        result.failed++
        result.errors.push({
          operation: 'update',
          date,
          templateId,
          message: recreateErr instanceof Error ? recreateErr.message : String(recreateErr),
        })
      }
    } else {
      result.failed++
      result.errors.push({
        operation: 'update',
        date,
        templateId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

/**
 * Retry all events with 'error' sync_status.
 * For each failed mapping, re-attempt the GCal insert and update the mapping on success.
 */
export async function retryFailedSyncs(): Promise<SyncResult> {
  const result = emptySyncResult()
  const ctx = await getCalendarContext()
  if (!ctx) return result

  const failedEvents = await db
    .select()
    .from(google_calendar_events)
    .where(eq(google_calendar_events.sync_status, 'error'))
    .all()

  if (failedEvents.length === 0) return result

  for (const mapping of failedEvents) {
    // Extract templateId from placeholder: pending-YYYY-MM-DD-{templateId}-{counter}-{ts}
    const parts = mapping.google_event_id.split('-')
    const templateId = parts.length >= 5 ? Number(parts[4]) : null
    let template: { name: string; modality: string } | undefined
    let exerciseNames: string[] = []

    if (templateId) {
      template = await db
        .select({ name: workout_templates.name, modality: workout_templates.modality })
        .from(workout_templates)
        .where(eq(workout_templates.id, templateId))
        .get()
      if (template) {
        exerciseNames = await getExerciseNames(templateId)
      }
    }

    try {
      const meso = await db
        .select({ start_date: mesocycles.start_date })
        .from(mesocycles)
        .where(eq(mesocycles.id, mapping.mesocycle_id))
        .get()

      const body = template && meso
        ? buildEventBody({
            templateName: template.name,
            modality: template.modality,
            date: mapping.event_date,
            timeSlot: mapping.start_time,
            duration: getDurationMinutes(mapping.start_time, mapping.end_time),
            weekNumber: getWeekNumber(meso.start_date, mapping.event_date),
            timezone: ctx.timezone,
            appUrl: ctx.appUrl,
            mesocycleId: mapping.mesocycle_id,
            templateId: templateId!,
            scheduleEntryId: mapping.schedule_entry_id,
            exercises: exerciseNames,
          })
        : {
            summary: mapping.summary,
            start: {
              dateTime: `${mapping.event_date}T${mapping.start_time}:00`,
              timeZone: ctx.timezone,
            },
            end: {
              dateTime: `${mapping.event_date}T${mapping.end_time}:00`,
              timeZone: ctx.timezone,
            },
          }

      const res = await ctx.calendarApi.events.insert({
        calendarId: ctx.calendarId,
        requestBody: body,
      })

      if (res.data.id) {
        const now = new Date()
        await db
          .update(google_calendar_events)
          .set({
            google_event_id: res.data.id,
            sync_status: 'synced',
            last_synced_at: now,
            updated_at: now,
          })
          .where(eq(google_calendar_events.id, mapping.id))
      }

      result.created++
    } catch (err) {
      result.failed++
      result.errors.push({
        operation: 'create',
        date: mapping.event_date,
        templateId: templateId ?? 0,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    await sleep(200)
  }

  return result
}

/**
 * Full re-sync: delete and recreate all events for non-completed mesocycles.
 * Uses syncMesocycle which handles overrides correctly.
 */
export async function fullResync(): Promise<SyncResult> {
  const result = emptySyncResult()
  const ctx = await getCalendarContext()
  if (!ctx) return result

  const nonCompleted = await db
    .select()
    .from(mesocycles)
    .where(ne(mesocycles.status, 'completed'))
    .all()

  for (const meso of nonCompleted) {
    const mesoResult = await syncMesocycle(meso.id)
    result.created += mesoResult.created
    result.updated += mesoResult.updated
    result.deleted += mesoResult.deleted
    result.failed += mesoResult.failed
    result.errors.push(...mesoResult.errors)
  }

  return result
}

/**
 * Delete all Google Calendar events mapped to a mesocycle.
 * Used when a mesocycle is deleted.
 */
// Collect Google event IDs before cascade delete wipes local mappings
export async function collectEventIdsForMesocycle(mesoId: number): Promise<string[]> {
  const events = await db
    .select({ google_event_id: google_calendar_events.google_event_id })
    .from(google_calendar_events)
    .where(eq(google_calendar_events.mesocycle_id, mesoId))
    .all()
  return events
    .map(e => e.google_event_id)
    .filter(id => !id.startsWith('pending-'))
}

// Delete events from Google Calendar by pre-collected event IDs
export async function deleteEventsByIds(eventIds: string[]): Promise<SyncResult> {
  const result = emptySyncResult()
  if (eventIds.length === 0) return result

  const ctx = await getCalendarContext()
  if (!ctx) return result

  for (const eventId of eventIds) {
    try {
      await ctx.calendarApi.events.delete({
        calendarId: ctx.calendarId,
        eventId,
      })
      result.deleted++
    } catch (err) {
      if (!isGoneError(err)) {
        result.failed++
      } else {
        result.deleted++
      }
    }
    await sleep(250)
  }

  return result
}

export async function deleteEventsForMesocycle(mesoId: number): Promise<SyncResult> {
  const eventIds = await collectEventIdsForMesocycle(mesoId)
  return deleteEventsByIds(eventIds)
}
