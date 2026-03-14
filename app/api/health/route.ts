import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Avoid importing lib/db here — in E2E, the health check runs before
  // globalSetup migrates the DB. Opening the DB file prematurely creates
  // an empty file whose connection persists after globalSetup recreates it.
  if (process.env.E2E_TEST === 'true') {
    return NextResponse.json({ status: 'ok' })
  }

  try {
    const { sqlite } = await import('@/lib/db/index')
    sqlite.prepare('SELECT 1').get()
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'disconnected' },
      { status: 503 }
    )
  }
}
