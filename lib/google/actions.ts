'use server'

import { google } from 'googleapis'
import { db } from '@/lib/db'
import { google_credentials, google_calendar_events } from '@/lib/db/schema'
import { getGoogleCredentials } from './queries'
import { createOAuth2Client } from './client'

type DisconnectResult =
  | { success: true }
  | { success: false; error: string }

// Revoke a token at Google's OAuth endpoint (best-effort)
async function revokeToken(token: string): Promise<void> {
  const res = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  if (!res.ok) throw new Error(`revoke failed: ${res.status}`)
}

// Disconnect Google account: revoke tokens, delete credentials, optionally delete calendar
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

  // Revoke refresh token at Google (best-effort — local cleanup proceeds either way)
  if (creds.refresh_token) {
    try {
      await revokeToken(creds.refresh_token)
    } catch {
      // Best-effort: revocation failure shouldn't block disconnect
    }
  }

  // Delete local event mappings and credentials
  await db.delete(google_calendar_events)
  await db.delete(google_credentials)

  return { success: true }
}
