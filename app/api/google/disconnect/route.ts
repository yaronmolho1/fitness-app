import { NextResponse } from 'next/server'
import { disconnectGoogle } from '@/lib/google/actions'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const deleteCalendar = body?.deleteCalendar === true

    const result = await disconnectGoogle({ deleteCalendar })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'disconnect_failed' }, { status: 500 })
  }
}
