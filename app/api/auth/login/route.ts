import { NextResponse } from 'next/server'
import { validateCredentials } from '../../../../lib/auth/config'
import { issueToken } from '../../../../lib/auth/jwt'
import { parseExpiresIn } from '../../../../lib/auth/utils'
import { authConfig } from '../../../../lib/auth/config'

export async function POST(request: Request) {
  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { username, password } = body

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    )
  }

  const valid = await validateCredentials(username, password)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await issueToken(username)
  const maxAge = parseExpiresIn(authConfig.jwtExpiresIn)

  const response = NextResponse.json({ success: true })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge,
    path: '/',
  })

  return response
}
