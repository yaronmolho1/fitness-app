import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProgressionData } from '@/lib/progression/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const exerciseIdParam = searchParams.get('exercise_id')

    if (!exerciseIdParam) {
      return NextResponse.json(
        { error: 'exercise_id query parameter is required' },
        { status: 400 }
      )
    }

    const exerciseId = parseInt(exerciseIdParam, 10)
    if (isNaN(exerciseId) || exerciseId < 1) {
      return NextResponse.json(
        { error: 'exercise_id must be a positive integer' },
        { status: 400 }
      )
    }

    const result = await getProgressionData(db, { exerciseId })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
