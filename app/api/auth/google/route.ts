import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google/client'

export async function GET() {
  const { url, state } = getAuthUrl()

  const response = NextResponse.redirect(url)

  // Store state token in httpOnly cookie for CSRF validation on callback
  response.cookies.set('google-oauth-state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — enough for OAuth flow
    path: '/',
  })

  return response
}
