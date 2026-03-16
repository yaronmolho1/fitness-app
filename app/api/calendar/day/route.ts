import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDayDetail } from '@/lib/calendar/day-detail'

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date || !DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: 'date query parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const result = await getDayDetail(db, date)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
