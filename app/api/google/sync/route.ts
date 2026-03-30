import { NextResponse } from 'next/server'
import { retryFailedSyncs } from '@/lib/google/sync'

export async function POST(_req: Request) {
  try {
    const result = await retryFailedSyncs()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 })
  }
}
