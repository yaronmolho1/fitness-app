import { NextResponse } from 'next/server'
import { isGoogleConnected, getSyncStatus } from '@/lib/google/queries'

export async function GET() {
  try {
    const connected = await isGoogleConnected()

    if (!connected) {
      return NextResponse.json({
        connected: false,
        synced: 0,
        pending: 0,
        error: 0,
        lastSyncedAt: null,
      })
    }

    const status = await getSyncStatus()
    return NextResponse.json({ connected: true, ...status })
  } catch {
    return NextResponse.json({ error: 'status_failed' }, { status: 500 })
  }
}
