import { NextResponse } from 'next/server'
import { retryFailedSyncs, fullResync } from '@/lib/google/sync'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const mode = (body as { mode?: string }).mode

    const result = mode === 'full'
      ? await fullResync()
      : await retryFailedSyncs()

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 })
  }
}
