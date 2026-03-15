import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCalendarProjection } from '@/lib/calendar/queries'

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    if (!month || !MONTH_REGEX.test(month)) {
      return NextResponse.json(
        { error: 'month query parameter is required (format: YYYY-MM)' },
        { status: 400 }
      )
    }

    const result = await getCalendarProjection(db, month)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
