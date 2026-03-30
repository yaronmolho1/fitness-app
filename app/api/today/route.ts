import { NextRequest, NextResponse } from 'next/server'
import { getTodayWorkout } from '@/lib/today/queries'

function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get('date')

    let date: string
    if (!dateParam) {
      date = todayDateString()
    } else {
      if (!isValidDate(dateParam)) {
        return NextResponse.json(
          { error: 'Invalid date format. Expected YYYY-MM-DD.' },
          { status: 400 }
        )
      }
      date = dateParam
    }

    const results = await getTodayWorkout(date)
    return NextResponse.json(results)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
