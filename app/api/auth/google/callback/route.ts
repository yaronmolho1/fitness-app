import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  getPrimaryTimezone,
  createFitnessCalendar,
  storeCredentials,
  updateTimezone,
} from '@/lib/google/client'

function redirectToSettings(error?: string): NextResponse {
  const url = new URL('/settings', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000')
  if (error) url.searchParams.set('error', error)
  const response = NextResponse.redirect(url, 302)
  // Clear the state cookie
  response.cookies.set('google-oauth-state', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const storedState = request.cookies.get('google-oauth-state')?.value

  // AC18: CSRF validation
  if (!storedState || !state || storedState !== state) {
    return redirectToSettings('state_mismatch')
  }

  // AC15: user denied consent
  if (error) {
    return redirectToSettings(error)
  }

  if (!code) {
    return redirectToSettings('missing_code')
  }

  // AC3: exchange code for tokens
  let tokens: {
    access_token?: string | null
    refresh_token?: string | null
    expiry_date?: number | null
    token_type?: string | null
    scope?: string | null
  }
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    console.error('[google-callback] token exchange failed:', err)
    return redirectToSettings('token_exchange_failed')
  }

  if (!tokens.access_token || !tokens.refresh_token) {
    return redirectToSettings('incomplete_tokens')
  }

  // AC4: read primary calendar timezone
  let timezone = 'UTC'
  try {
    timezone = await getPrimaryTimezone({ access_token: tokens.access_token })
  } catch {
    // Non-fatal: fall back to UTC
  }

  // AC5: create Fitness calendar
  let calendarId: string | null = null
  try {
    calendarId = await createFitnessCalendar({ access_token: tokens.access_token })
  } catch {
    // Non-fatal: partial state — calendar_id stays null, can retry later
  }

  // AC6: store credentials + calendar_id
  await storeCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600000,
    token_type: tokens.token_type ?? 'Bearer',
    scope: tokens.scope ?? undefined,
    calendar_id: calendarId,
  })

  // AC4: update timezone in athlete profile
  await updateTimezone(timezone)

  // AC7: redirect to settings on success
  return redirectToSettings()
}
