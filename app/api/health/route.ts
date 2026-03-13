import { NextResponse } from 'next/server'
import { sqlite } from '@/lib/db/index'

export async function GET() {
  try {
    sqlite.prepare('SELECT 1').get()
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'disconnected' },
      { status: 503 }
    )
  }
}
