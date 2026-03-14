import { NextResponse } from 'next/server'
import { getTodayWorkout } from '@/lib/today/queries'

function todayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET() {
  try {
    const today = todayDateString()
    const result = await getTodayWorkout(today)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
