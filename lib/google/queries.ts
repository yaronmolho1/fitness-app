import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { google_credentials, google_calendar_events } from '@/lib/db/schema'

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

// Get all calendar events for a mesocycle
export async function getEventsByMesocycle(mesoId: number) {
  return db
    .select()
    .from(google_calendar_events)
    .where(eq(google_calendar_events.mesocycle_id, mesoId))
}
