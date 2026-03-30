import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { google_credentials, google_calendar_events, athlete_profile } from '@/lib/db/schema'

// Get stored Google credentials, or null if not connected
export async function getGoogleCredentials() {
  const rows = await db.select().from(google_credentials)
  return rows.length > 0 ? rows[0] : null
}

// Check if a Google account is connected
export async function isGoogleConnected(): Promise<boolean> {
  const creds = await getGoogleCredentials()
  return creds !== null
}

// Get the calendar event mapping for a specific schedule entry + date
export async function getEventMapping(
  mesoId: number,
  scheduleEntryId: number,
  date: string
) {
  const rows = await db
    .select()
    .from(google_calendar_events)
    .where(
      and(
        eq(google_calendar_events.mesocycle_id, mesoId),
        eq(google_calendar_events.schedule_entry_id, scheduleEntryId),
        eq(google_calendar_events.event_date, date)
      )
    )
  return rows.length > 0 ? rows[0] : null
}

// Get timezone from athlete profile (used for settings display)
export async function getAthleteTimezone(): Promise<string | null> {
  const rows = await db.select({ timezone: athlete_profile.timezone }).from(athlete_profile)
  return rows.length > 0 ? rows[0].timezone : null
}

// Get all calendar events for a mesocycle
export async function getEventsByMesocycle(mesoId: number) {
  return db
    .select()
    .from(google_calendar_events)
    .where(eq(google_calendar_events.mesocycle_id, mesoId))
}

// Get sync status counts + last sync timestamp
export type SyncStatusResult = {
  synced: number
  pending: number
  error: number
  lastSyncedAt: string | null
}

export async function getSyncStatus(): Promise<SyncStatusResult> {
  const rows = await db.select().from(google_calendar_events)

  let synced = 0
  let pending = 0
  let error = 0
  let lastSyncedAt: Date | null = null

  for (const row of rows) {
    if (row.sync_status === 'synced') synced++
    else if (row.sync_status === 'pending') pending++
    else if (row.sync_status === 'error') error++

    if (row.last_synced_at) {
      if (!lastSyncedAt || row.last_synced_at > lastSyncedAt) {
        lastSyncedAt = row.last_synced_at
      }
    }
  }

  return {
    synced,
    pending,
    error,
    lastSyncedAt: lastSyncedAt ? lastSyncedAt.toISOString() : null,
  }
}
