'use server'

import { google } from 'googleapis'
import { db } from '@/lib/db'
import { google_credentials, google_calendar_events } from '@/lib/db/schema'
import { getGoogleCredentials } from './queries'
import { createOAuth2Client } from './client'

type DisconnectResult =
  | { success: true }
  | { success: false; error: string }

// Disconnect Google account: delete credentials and optionally delete the Fitness calendar
export async function disconnectGoogle(
  options?: { deleteCalendar?: boolean }
): Promise<DisconnectResult> {
  const creds = await getGoogleCredentials()
  if (!creds) return { success: false, error: 'not_connected' }

  // Optionally delete the Fitness calendar via Google API (best-effort)
  if (options?.deleteCalendar && creds.calendar_id) {
    try {
      const client = createOAuth2Client()
      client.setCredentials({
        access_token: creds.access_token,
        refresh_token: creds.refresh_token,
      })
      const calendar = google.calendar({ version: 'v3', auth: client })
      await calendar.calendars.delete({ calendarId: creds.calendar_id })
    } catch {
      // Best-effort: calendar deletion failure shouldn't block disconnect
    }
  }

  // Delete local event mappings and credentials
  await db.delete(google_calendar_events)
  await db.delete(google_credentials)

  return { success: true }
}
