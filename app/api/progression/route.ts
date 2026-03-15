import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProgressionData } from '@/lib/progression/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const canonicalName = searchParams.get('canonical_name')

    if (!canonicalName) {
      return NextResponse.json(
        { error: 'canonical_name query parameter is required' },
        { status: 400 }
      )
    }

    const exerciseIdParam = searchParams.get('exercise_id')
    const exerciseId = exerciseIdParam ? parseInt(exerciseIdParam, 10) : undefined

    if (exerciseIdParam && (isNaN(exerciseId!) || exerciseId! < 1)) {
      return NextResponse.json(
        { error: 'exercise_id must be a positive integer' },
        { status: 400 }
      )
    }

    const result = await getProgressionData(db, { canonicalName, exerciseId })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
