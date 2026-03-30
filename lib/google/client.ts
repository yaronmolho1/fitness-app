import { google } from 'googleapis'
import { OAuth2Client, Credentials } from 'google-auth-library'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { google_credentials, athlete_profile } from '@/lib/db/schema'
import crypto from 'crypto'

export const SCOPES = ['https://www.googleapis.com/auth/calendar']

// Create a bare OAuth2 client from env vars (no credentials loaded)
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID environment variable is required')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
  if (!redirectUri) throw new Error('GOOGLE_REDIRECT_URI environment variable is required')

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

// Generate consent URL + CSRF state token
export function getAuthUrl(): { url: string; state: string } {
  const client = createOAuth2Client()
  const state = crypto.randomBytes(32).toString('hex')
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
  })
  return { url, state }
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

// Get the user's primary calendar timezone
export async function getPrimaryTimezone(tokens: { access_token: string | null | undefined }) {
  const client = createOAuth2Client()
  client.setCredentials(tokens)
  const calendar = google.calendar({ version: 'v3', auth: client })
  const res = await calendar.calendarList.get({ calendarId: 'primary' })
  return res.data.timeZone ?? 'UTC'
}

// Create a "Fitness" calendar and return its ID
export async function createFitnessCalendar(tokens: { access_token: string | null | undefined }) {
  const client = createOAuth2Client()
  client.setCredentials(tokens)
  const calendar = google.calendar({ version: 'v3', auth: client })
  const res = await calendar.calendars.insert({
    requestBody: {
      summary: 'Fitness',
      description: 'Workout schedule synced from fitness tracker',
      timeZone: 'UTC',
    },
  })
  return res.data.id ?? null
}

// Persist OAuth credentials + calendar_id to google_credentials table
export async function storeCredentials(data: {
  access_token: string
  refresh_token: string
  expiry_date: number
  token_type?: string
  scope?: string
  calendar_id: string | null
}) {
  const now = new Date()

  // Upsert: delete existing then insert fresh (transactional to avoid data loss on crash)
  db.transaction((tx) => {
    tx.delete(google_credentials).run()
    tx.insert(google_credentials).values({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type ?? 'Bearer',
      expiry_date: new Date(data.expiry_date),
      scope: data.scope ?? SCOPES.join(' '),
      calendar_id: data.calendar_id,
      created_at: now,
      updated_at: now,
    }).run()
  })
}

// Update timezone in athlete_profile
export async function updateTimezone(timezone: string) {
  const existing = await db.select().from(athlete_profile)
  const now = new Date()
  if (existing.length === 0) {
    await db.insert(athlete_profile).values({
      timezone,
      created_at: now,
      updated_at: now,
    })
  } else {
    await db
      .update(athlete_profile)
      .set({ timezone, updated_at: now })
      .where(eq(athlete_profile.id, existing[0].id))
  }
}

// Load credentials from DB and return an authenticated OAuth2 client.
// Sets up a token refresh listener to persist new tokens automatically (AC9-10).
// Returns null if no credentials exist.
export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const rows = await db.select().from(google_credentials)
  if (rows.length === 0) return null

  const creds = rows[0]
  const client = createOAuth2Client()
  client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    token_type: creds.token_type,
    expiry_date: creds.expiry_date.getTime(),
    scope: creds.scope ?? undefined,
  })

  // Persist refreshed tokens automatically
  client.on('tokens', async (tokens: Credentials) => {
    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (tokens.access_token) updates.access_token = tokens.access_token
    if (tokens.expiry_date) updates.expiry_date = new Date(tokens.expiry_date)
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token

    await db
      .update(google_credentials)
      .set(updates)
      .where(eq(google_credentials.id, creds.id))
  })

  return client
}
